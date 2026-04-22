import type { Difficulty } from "./schemas";

export const INTERVALS = [1, 3, 7, 14, 30] as const;
export const MAX_INTERVAL_INDEX = INTERVALS.length - 1;
export const MAX_MEDIUM_HARD_PER_DAY = 2;

/** UTC midnight for the given date's UTC date components. */
function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Add N days in pure UTC, avoiding DST / local-time drift. */
export function addUTCDays(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + n));
}

export function getNextIntervalIndex(
  currentIndex: number,
  passed: boolean,
  isOverdue: boolean
): number | "finished" {
  if (passed) {
    if (isOverdue) return currentIndex;
    const next = currentIndex + 1;
    if (next > MAX_INTERVAL_INDEX) return "finished";
    return next;
  }
  return Math.max(0, currentIndex - 1);
}

/**
 * Returns UTC midnight of today using LOCAL date components.
 * This produces the same calendar date the user sees, stored as UTC midnight
 * so Postgres DATE comparisons work correctly regardless of server timezone.
 */
export function getToday(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export function calculateDueDate(fromDate: Date, intervalIndex: number): Date {
  return addUTCDays(utcDay(fromDate), INTERVALS[intervalIndex]);
}

/**
 * Returns a canonical YYYY-MM-DD string using UTC components.
 * Since all our dates are stored as UTC midnight (Postgres DATE -> Prisma),
 * this is safe for equality and ordering comparisons.
 */
export function toDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function isMediumOrHard(difficulty: Difficulty): boolean {
  return difficulty === "MEDIUM" || difficulty === "HARD";
}

export function isOverdue(scheduledDate: Date, today?: Date): boolean {
  return toDateKey(scheduledDate) < toDateKey(today ?? getToday());
}

export function isDueToday(scheduledDate: Date, today?: Date): boolean {
  return toDateKey(scheduledDate) === toDateKey(today ?? getToday());
}

export interface SchedulableProblem {
  id: string;
  difficulty: Difficulty;
  nextDueDate: Date;
  scheduledDate: Date;
  createdAt: Date;
}

/**
 * Reschedules problems so that no more than MAX_MEDIUM_HARD_PER_DAY
 * medium/hard problems are on any single day.
 *
 * Easy problems are always left on their nextDueDate.
 * Medium/hard problems that exceed the daily cap are pushed forward.
 * Among conflicts, the most recently submitted (latest createdAt) are pushed first.
 * Pushed problems go to the next available day with remaining capacity.
 *
 * @param initialCapacity  Pre-seeded remaining capacity per date key.
 *   Pass 0 for a date to treat it as fully booked (e.g. today is locked).
 *   Pass MAX_MEDIUM_HARD_PER_DAY - N to reserve N slots for externally-decided
 *   problems (e.g. pulled problems whose original scheduledDate should not be
 *   double-booked). Any date not present defaults to MAX_MEDIUM_HARD_PER_DAY.
 */
export function rescheduleProblems(
  problems: SchedulableProblem[],
  initialCapacity?: Map<string, number>
): SchedulableProblem[] {
  const easy: SchedulableProblem[] = [];
  const medHard: SchedulableProblem[] = [];

  for (const p of problems) {
    if (isMediumOrHard(p.difficulty)) {
      medHard.push(p);
    } else {
      easy.push({ ...p, scheduledDate: utcDay(p.nextDueDate) });
    }
  }

  medHard.sort((a, b) => {
    const keyA = toDateKey(a.nextDueDate);
    const keyB = toDateKey(b.nextDueDate);
    if (keyA !== keyB) return keyA < keyB ? -1 : 1;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  // Start with pre-seeded capacity (e.g. today locked, pulled-problem slots reserved).
  const dayCapacity = new Map<string, number>(initialCapacity);

  function getCapacity(dateKey: string): number {
    return dayCapacity.get(dateKey) ?? MAX_MEDIUM_HARD_PER_DAY;
  }

  function consumeSlot(dateKey: string): void {
    dayCapacity.set(dateKey, getCapacity(dateKey) - 1);
  }

  const scheduled: SchedulableProblem[] = [];

  for (const p of medHard) {
    let targetDate = utcDay(p.nextDueDate);
    let dateKey = toDateKey(targetDate);

    while (getCapacity(dateKey) <= 0) {
      targetDate = addUTCDays(targetDate, 1);
      dateKey = toDateKey(targetDate);
    }

    consumeSlot(dateKey);
    scheduled.push({ ...p, scheduledDate: targetDate });
  }

  return [...easy, ...scheduled];
}

/**
 * Rebalances the schedule after a problem is completed.
 * Tries to move delayed problems as close as possible to their
 * intended due dates, but never earlier than intended.
 *
 * @param initialCapacity  Forwarded to rescheduleProblems — use to lock today
 *   and to reserve slots for any pulled problems whose original scheduledDate
 *   should not be double-booked by this rebalance.
 */
export function rebalanceAfterCompletion(
  problems: SchedulableProblem[],
  initialCapacity?: Map<string, number>
): SchedulableProblem[] {
  return rescheduleProblems(
    problems.map((p) => ({ ...p, scheduledDate: p.nextDueDate })),
    initialCapacity
  );
}
