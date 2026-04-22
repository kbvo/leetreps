"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  addProblemSchema,
  reviewProblemSchema,
  type AddProblemInput,
  type ReviewProblemInput,
} from "@/lib/schemas";
import {
  addUTCDays,
  calculateDueDate,
  toDateKey,
  rescheduleProblems,
  rebalanceAfterCompletion,
  getNextIntervalIndex,
  MAX_MEDIUM_HARD_PER_DAY,
  type SchedulableProblem,
} from "@/lib/scheduler";
import { getEffectiveToday } from "@/lib/dev-date";

async function getUser() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user) throw new Error("Unauthorized");
  return session.user;
}

function toSchedulable(p: {
  id: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  nextDueDate: Date;
  scheduledDate: Date;
  createdAt: Date;
}): SchedulableProblem {
  return {
    id: p.id,
    difficulty: p.difficulty,
    nextDueDate: p.nextDueDate,
    scheduledDate: p.scheduledDate,
    createdAt: p.createdAt,
  };
}

/**
 * Builds the capacity map used by both applySchedule and the post-review
 * rebalance to enforce the rule that today's schedule is immutable.
 *
 * Rules encoded in the returned map:
 *  - today → 0 remaining (fully locked; nothing new may be scheduled today)
 *  - For each medium/hard problem currently pulled into today: its ORIGINAL
 *    scheduledDate has one fewer available slot, so the rebalance won't
 *    double-book that day while the pull is still pending.
 *
 * Also returns `tomorrow` (the earliest date automatic scheduling may target).
 */
async function buildScheduleContext(userId: string, today: Date) {
  const todayKey = toDateKey(today);
  const tomorrow = addUTCDays(today, 1);

  // Medium/hard problems currently pulled into today still hold their original
  // scheduledDate slot in the upcoming queue.  Reserve those slots.
  const pulledTodayMedHard = await prisma.problem.findMany({
    where: {
      userId,
      status: "ACTIVE",
      pulledForDate: today,
      difficulty: { in: ["MEDIUM", "HARD"] },
    },
    select: { scheduledDate: true },
  });

  const initialCapacity = new Map<string, number>([[todayKey, 0]]);
  for (const p of pulledTodayMedHard) {
    const key = toDateKey(p.scheduledDate);
    const remaining = initialCapacity.get(key) ?? MAX_MEDIUM_HARD_PER_DAY;
    initialCapacity.set(key, Math.max(0, remaining - 1));
  }

  return { tomorrow, initialCapacity, todayKey };
}

/**
 * Marks ACTIVE problems as OVERDUE when their scheduled date has passed.
 * Pulled-for-today problems are excluded — they can't become overdue today.
 * Stale pulls (pulled on a previous day but never reviewed) are quietly
 * un-pulled (pulledForDate cleared) and left at their original scheduledDate.
 * Because we never change scheduledDate when pulling, these problems just
 * continue sitting in Upcoming exactly where they were before the pull.
 */
export async function processOverdueProblems() {
  const user = await getUser();
  const today = await getEffectiveToday();

  const active = await prisma.problem.findMany({
    where: { userId: user.id, status: "ACTIVE" },
    select: { id: true, scheduledDate: true, pulledForDate: true },
  });

  const todayKey = toDateKey(today);

  // Clear stale pulls (pulled on a past day, never reviewed) — not overdue.
  const stalePullIds = active
    .filter((p) => p.pulledForDate && toDateKey(p.pulledForDate) < todayKey)
    .map((p) => p.id);

  if (stalePullIds.length > 0) {
    await prisma.problem.updateMany({
      where: { id: { in: stalePullIds } },
      data: { pulledForDate: null },
    });
  }

  // Now mark genuinely overdue: scheduledDate in the past and NOT pulled today.
  const overdueIds = active
    .filter((p) => {
      if (stalePullIds.includes(p.id)) return false; // just cleaned
      if (toDateKey(p.scheduledDate) >= todayKey) return false;
      if (p.pulledForDate && toDateKey(p.pulledForDate) === todayKey) return false;
      return true;
    })
    .map((p) => p.id);

  if (overdueIds.length > 0) {
    await prisma.problem.updateMany({
      where: { id: { in: overdueIds } },
      data: { status: "OVERDUE", pulledForDate: null },
    });
  }
}

/**
 * Re-runs the scheduler for all future-scheduled active problems after a
 * problem is added.  Today's schedule is never touched:
 *  - Problems already scheduled for today are excluded entirely.
 *  - Pulled-for-today problems are excluded (their slot is user-decided).
 *  - Any problem whose nextDueDate has already passed is clamped to tomorrow
 *    so nothing lands on today automatically.
 *  - Today's capacity is pre-seeded as 0 and pulled problems' original
 *    scheduledDate slots are reserved (via initialCapacity).
 */
async function applySchedule(userId: string, today: Date) {
  const { tomorrow, initialCapacity } = await buildScheduleContext(userId, today);
  const tomorrowKey = toDateKey(tomorrow);

  const futureProblems = await prisma.problem.findMany({
    where: {
      userId,
      status: "ACTIVE",
      scheduledDate: { gt: today }, // only future-scheduled; today's slots stay untouched
      OR: [{ pulledForDate: null }, { pulledForDate: { not: today } }],
    },
    select: {
      id: true,
      difficulty: true,
      nextDueDate: true,
      scheduledDate: true,
      createdAt: true,
    },
  });

  const scheduled = rescheduleProblems(
    futureProblems.map((p) => {
      const s = toSchedulable(p);
      // Clamp nextDueDate to tomorrow so the algorithm never targets today.
      return toDateKey(s.nextDueDate) < tomorrowKey
        ? { ...s, nextDueDate: tomorrow }
        : s;
    }),
    initialCapacity
  );

  for (const s of scheduled) {
    await prisma.problem.update({
      where: { id: s.id },
      data: { scheduledDate: s.scheduledDate },
    });
  }
}

export async function addProblem(input: AddProblemInput) {
  const parsed = addProblemSchema.parse(input);
  const user = await getUser();
  const today = await getEffectiveToday();
  const dueDate = calculateDueDate(today, 0);

  await prisma.problem.create({
    data: {
      userId: user.id,
      title: parsed.title,
      difficulty: parsed.difficulty,
      intervalIndex: 0,
      nextDueDate: dueDate,
      scheduledDate: dueDate,
      status: "ACTIVE",
      lastAttemptedAt: today,
      lastResult: "PASS",
    },
  });

  await applySchedule(user.id, today);
}

/**
 * Pulls the next eligible upcoming problem into today's review list.
 *
 * "Eligible" means the problem's best-fit date (nextDueDate) is today or
 * in the past — i.e. the only reason it isn't in Today already is that the
 * medium/hard cap pushed it to a later scheduledDate.
 *
 * The system always picks the problem whose nextDueDate is earliest (most
 * overdue on the intended schedule). Users cannot choose which one.
 *
 * The scheduledDate is intentionally left unchanged. The problem appears in
 * Today only because pulledForDate === today.  If the user never reviews it,
 * processOverdueProblems clears pulledForDate the next day and the problem
 * returns to Upcoming exactly where it was — it does not become overdue.
 */
export async function pullNextProblem() {
  const user = await getUser();
  const today = await getEffectiveToday();
  const todayKey = toDateKey(today);

  // Find all active upcoming problems whose intended date has arrived.
  const candidates = await prisma.problem.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      pulledForDate: null,
    },
    select: { id: true, scheduledDate: true, nextDueDate: true },
  });

  const eligible = candidates
    .filter(
      (p) =>
        toDateKey(p.scheduledDate) > todayKey &&
        toDateKey(p.nextDueDate) <= todayKey
    )
    .sort((a, b) =>
      toDateKey(a.nextDueDate).localeCompare(toDateKey(b.nextDueDate))
    );

  if (eligible.length === 0) {
    throw new Error("No problems available to pull");
  }

  const next = eligible[0];
  await prisma.problem.update({
    where: { id: next.id },
    data: { pulledForDate: today },
  });
}

export async function reviewProblem(input: ReviewProblemInput) {
  const parsed = reviewProblemSchema.parse(input);
  const user = await getUser();
  const today = await getEffectiveToday();

  const problem = await prisma.problem.findFirst({
    where: { id: parsed.problemId, userId: user.id },
  });

  if (!problem) throw new Error("Problem not found");
  if (problem.status === "FINISHED") throw new Error("Problem already finished");

  const isOverdue = problem.status === "OVERDUE";
  const passed = parsed.result === "PASS";
  const nextIndex = getNextIntervalIndex(problem.intervalIndex, passed, isOverdue);

  if (nextIndex === "finished") {
    await prisma.problem.update({
      where: { id: problem.id },
      data: {
        status: "FINISHED",
        pulledForDate: null,
        lastAttemptedAt: today,
        lastResult: passed ? "PASS" : "FAIL",
      },
    });
  } else {
    const newDueDate = calculateDueDate(today, nextIndex);
    await prisma.problem.update({
      where: { id: problem.id },
      data: {
        intervalIndex: nextIndex,
        nextDueDate: newDueDate,
        scheduledDate: newDueDate,
        status: "ACTIVE",
        pulledForDate: null,
        lastAttemptedAt: today,
        lastResult: passed ? "PASS" : "FAIL",
      },
    });
  }

  // Rebalance future problems toward their best-fit dates.
  //
  // Invariants:
  //  - Today's schedule is immutable (today capacity pre-seeded to 0).
  //  - Problems scheduled for today are excluded so they keep their slots.
  //  - Pulled-for-today problems are excluded (user-decided) but their original
  //    scheduledDate slots are reserved in initialCapacity so the rebalance
  //    won't double-book those days before the user reviews them.
  //  - nextDueDates clamped to tomorrow so nothing lands on today automatically.
  const { tomorrow, initialCapacity } = await buildScheduleContext(user.id, today);
  const tomorrowKey = toDateKey(tomorrow);

  const rebalanceable = await prisma.problem.findMany({
    where: {
      userId: user.id,
      status: "ACTIVE",
      scheduledDate: { gt: today }, // exclude today's scheduled problems
      OR: [{ pulledForDate: null }, { pulledForDate: { not: today } }],
    },
    select: {
      id: true,
      difficulty: true,
      nextDueDate: true,
      scheduledDate: true,
      createdAt: true,
    },
  });

  const rebalanced = rebalanceAfterCompletion(
    rebalanceable.map((p) => {
      const s = toSchedulable(p);
      return toDateKey(s.nextDueDate) < tomorrowKey
        ? { ...s, nextDueDate: tomorrow }
        : s;
    }),
    initialCapacity
  );

  for (const s of rebalanced) {
    await prisma.problem.update({
      where: { id: s.id },
      data: { scheduledDate: s.scheduledDate },
    });
  }

  return { success: true };
}

export async function getDashboardData() {
  const user = await getUser();
  const today = await getEffectiveToday();
  const todayKey = toDateKey(today);

  await processOverdueProblems();

  type ProblemRow = Awaited<ReturnType<typeof prisma.problem.findMany>>[number];

  const allProblems: ProblemRow[] = await prisma.problem.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  // Today: regularly scheduled OR explicitly pulled into today.
  const todayProblems = allProblems.filter(
    (p) =>
      p.status === "ACTIVE" &&
      (toDateKey(p.scheduledDate) === todayKey ||
        (p.pulledForDate !== null && toDateKey(p.pulledForDate) === todayKey))
  );

  const overdueProblems = allProblems
    .filter((p) => p.status === "OVERDUE")
    .sort((a, b) => toDateKey(a.scheduledDate).localeCompare(toDateKey(b.scheduledDate)));

  // Upcoming: scheduled for a future date AND not already pulled into today.
  const upcomingProblems = allProblems
    .filter((p) => {
      if (p.status !== "ACTIVE") return false;
      if (toDateKey(p.scheduledDate) <= todayKey) return false;
      if (p.pulledForDate !== null && toDateKey(p.pulledForDate) === todayKey) return false;
      return true;
    })
    .sort((a, b) => toDateKey(a.scheduledDate).localeCompare(toDateKey(b.scheduledDate)));

  // How many upcoming problems are eligible to pull (best-fit date has arrived).
  const pullableCount = upcomingProblems.filter(
    (p) => toDateKey(p.nextDueDate) <= todayKey && p.pulledForDate === null
  ).length;

  const finishedProblems = allProblems
    .filter((p) => p.status === "FINISHED")
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());

  return { todayProblems, overdueProblems, upcomingProblems, finishedProblems, todayKey, pullableCount };
}
