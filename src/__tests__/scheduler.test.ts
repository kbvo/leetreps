import { describe, it, expect } from "vitest";
import {
  INTERVALS,
  MAX_INTERVAL_INDEX,
  getNextIntervalIndex,
  calculateDueDate,
  rescheduleProblems,
  rebalanceAfterCompletion,
  isOverdue,
  isDueToday,
  isMediumOrHard,
  toDateKey,
  type SchedulableProblem,
} from "@/lib/scheduler";

// All test dates are UTC midnight to match how the scheduler and Postgres DATE behave.
function utcDate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(date: Date, n: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + n));
}

const today = utcDate(2025, 6, 1);

function makeProblem(
  overrides: Partial<SchedulableProblem> & { id: string }
): SchedulableProblem {
  return {
    difficulty: "MEDIUM",
    nextDueDate: addDays(today, 1),
    scheduledDate: addDays(today, 1),
    createdAt: today,
    ...overrides,
  };
}

describe("INTERVALS", () => {
  it("has the correct fixed intervals", () => {
    expect(INTERVALS).toEqual([1, 3, 7, 14, 30]);
  });

  it("has MAX_INTERVAL_INDEX = 4", () => {
    expect(MAX_INTERVAL_INDEX).toBe(4);
  });
});

describe("getNextIntervalIndex", () => {
  it("advances on pass (non-overdue)", () => {
    expect(getNextIntervalIndex(0, true, false)).toBe(1);
    expect(getNextIntervalIndex(1, true, false)).toBe(2);
    expect(getNextIntervalIndex(3, true, false)).toBe(4);
  });

  it("returns 'finished' when passing beyond max interval", () => {
    expect(getNextIntervalIndex(4, true, false)).toBe("finished");
  });

  it("decreases on fail", () => {
    expect(getNextIntervalIndex(3, false, false)).toBe(2);
    expect(getNextIntervalIndex(1, false, false)).toBe(0);
  });

  it("does not go below 0 on fail", () => {
    expect(getNextIntervalIndex(0, false, false)).toBe(0);
  });

  it("keeps same interval on overdue pass", () => {
    expect(getNextIntervalIndex(2, true, true)).toBe(2);
    expect(getNextIntervalIndex(0, true, true)).toBe(0);
    expect(getNextIntervalIndex(4, true, true)).toBe(4);
  });

  it("decreases on overdue fail", () => {
    expect(getNextIntervalIndex(3, false, true)).toBe(2);
    expect(getNextIntervalIndex(0, false, true)).toBe(0);
  });
});

describe("calculateDueDate", () => {
  it("calculates correct dates for each interval", () => {
    const base = utcDate(2025, 1, 1);
    expect(toDateKey(calculateDueDate(base, 0))).toBe("2025-01-02");
    expect(toDateKey(calculateDueDate(base, 1))).toBe("2025-01-04");
    expect(toDateKey(calculateDueDate(base, 2))).toBe("2025-01-08");
    expect(toDateKey(calculateDueDate(base, 3))).toBe("2025-01-15");
    expect(toDateKey(calculateDueDate(base, 4))).toBe("2025-01-31");
  });
});

describe("isMediumOrHard", () => {
  it("returns true for MEDIUM and HARD", () => {
    expect(isMediumOrHard("MEDIUM")).toBe(true);
    expect(isMediumOrHard("HARD")).toBe(true);
  });

  it("returns false for EASY", () => {
    expect(isMediumOrHard("EASY")).toBe(false);
  });
});

describe("isOverdue / isDueToday", () => {
  it("detects overdue problems", () => {
    expect(isOverdue(addDays(today, -1), today)).toBe(true);
    expect(isOverdue(today, today)).toBe(false);
    expect(isOverdue(addDays(today, 1), today)).toBe(false);
  });

  it("detects problems due today", () => {
    expect(isDueToday(today, today)).toBe(true);
    expect(isDueToday(addDays(today, -1), today)).toBe(false);
    expect(isDueToday(addDays(today, 1), today)).toBe(false);
  });
});

describe("rescheduleProblems", () => {
  it("does not reschedule when <= 2 medium/hard per day", () => {
    const problems = [
      makeProblem({ id: "1", difficulty: "MEDIUM" }),
      makeProblem({ id: "2", difficulty: "HARD" }),
    ];
    const result = rescheduleProblems(problems);
    const dateMap = new Map(result.map((p) => [p.id, toDateKey(p.scheduledDate)]));
    expect(dateMap.get("1")).toBe(toDateKey(addDays(today, 1)));
    expect(dateMap.get("2")).toBe(toDateKey(addDays(today, 1)));
  });

  it("pushes 3rd medium/hard problem to next day", () => {
    const dueDate = addDays(today, 1);
    const problems = [
      makeProblem({ id: "1", difficulty: "MEDIUM", createdAt: utcDate(2025, 1, 1) }),
      makeProblem({ id: "2", difficulty: "HARD", createdAt: utcDate(2025, 1, 2) }),
      makeProblem({ id: "3", difficulty: "MEDIUM", createdAt: utcDate(2025, 1, 3) }),
    ];
    const result = rescheduleProblems(problems);
    const byId = new Map(result.map((p) => [p.id, p]));
    expect(toDateKey(byId.get("1")!.scheduledDate)).toBe(toDateKey(dueDate));
    expect(toDateKey(byId.get("2")!.scheduledDate)).toBe(toDateKey(dueDate));
    expect(toDateKey(byId.get("3")!.scheduledDate)).toBe(toDateKey(addDays(dueDate, 1)));
  });

  it("pushes most recently created problems first", () => {
    const dueDate = addDays(today, 1);
    const problems = [
      makeProblem({ id: "old", difficulty: "MEDIUM", createdAt: utcDate(2025, 1, 1) }),
      makeProblem({ id: "mid", difficulty: "HARD", createdAt: utcDate(2025, 3, 1) }),
      makeProblem({ id: "new", difficulty: "MEDIUM", createdAt: utcDate(2025, 6, 1) }),
    ];
    const result = rescheduleProblems(problems);
    const byId = new Map(result.map((p) => [p.id, p]));
    expect(toDateKey(byId.get("old")!.scheduledDate)).toBe(toDateKey(dueDate));
    expect(toDateKey(byId.get("mid")!.scheduledDate)).toBe(toDateKey(dueDate));
    expect(toDateKey(byId.get("new")!.scheduledDate)).toBe(toDateKey(addDays(dueDate, 1)));
  });

  it("easy problems are unlimited per day", () => {
    const dueDate = addDays(today, 1);
    const problems = [
      makeProblem({ id: "e1", difficulty: "EASY" }),
      makeProblem({ id: "e2", difficulty: "EASY" }),
      makeProblem({ id: "e3", difficulty: "EASY" }),
      makeProblem({ id: "e4", difficulty: "EASY" }),
      makeProblem({ id: "e5", difficulty: "EASY" }),
    ];
    const result = rescheduleProblems(problems);
    for (const p of result) {
      expect(toDateKey(p.scheduledDate)).toBe(toDateKey(dueDate));
    }
  });

  it("easy problems don't affect medium/hard capacity", () => {
    const dueDate = addDays(today, 1);
    const problems = [
      makeProblem({ id: "e1", difficulty: "EASY" }),
      makeProblem({ id: "e2", difficulty: "EASY" }),
      makeProblem({ id: "e3", difficulty: "EASY" }),
      makeProblem({ id: "m1", difficulty: "MEDIUM", createdAt: utcDate(2025, 1, 1) }),
      makeProblem({ id: "m2", difficulty: "HARD", createdAt: utcDate(2025, 1, 2) }),
    ];
    const result = rescheduleProblems(problems);
    for (const p of result) {
      expect(toDateKey(p.scheduledDate)).toBe(toDateKey(dueDate));
    }
  });

  it("handles cascading pushes across multiple days", () => {
    const day1 = addDays(today, 1);
    const day2 = addDays(today, 2);
    const problems = [
      makeProblem({ id: "1", nextDueDate: day1, scheduledDate: day1, createdAt: utcDate(2025, 1, 1) }),
      makeProblem({ id: "2", nextDueDate: day1, scheduledDate: day1, createdAt: utcDate(2025, 1, 2) }),
      makeProblem({ id: "3", nextDueDate: day1, scheduledDate: day1, createdAt: utcDate(2025, 1, 3) }),
      makeProblem({ id: "4", nextDueDate: day2, scheduledDate: day2, createdAt: utcDate(2025, 1, 4) }),
      makeProblem({ id: "5", nextDueDate: day2, scheduledDate: day2, createdAt: utcDate(2025, 1, 5) }),
    ];
    const result = rescheduleProblems(problems);
    const byId = new Map(result.map((p) => [p.id, p]));
    expect(toDateKey(byId.get("1")!.scheduledDate)).toBe(toDateKey(day1));
    expect(toDateKey(byId.get("2")!.scheduledDate)).toBe(toDateKey(day1));
    expect(toDateKey(byId.get("3")!.scheduledDate)).toBe(toDateKey(day2));
    expect(toDateKey(byId.get("4")!.scheduledDate)).toBe(toDateKey(day2));
    expect(toDateKey(byId.get("5")!.scheduledDate)).toBe(toDateKey(addDays(day2, 1)));
  });

  it("handles empty input", () => {
    expect(rescheduleProblems([])).toEqual([]);
  });
});

describe("rebalanceAfterCompletion", () => {
  it("resets scheduledDate to nextDueDate and reschedules", () => {
    const day1 = addDays(today, 1);
    const day3 = addDays(today, 3);
    const problems = [
      makeProblem({ id: "1", nextDueDate: day1, scheduledDate: day3, createdAt: utcDate(2025, 1, 1) }),
      makeProblem({ id: "2", nextDueDate: day1, scheduledDate: day1, createdAt: utcDate(2025, 1, 2) }),
    ];
    const result = rebalanceAfterCompletion(problems);
    const byId = new Map(result.map((p) => [p.id, p]));
    expect(toDateKey(byId.get("1")!.scheduledDate)).toBe(toDateKey(day1));
    expect(toDateKey(byId.get("2")!.scheduledDate)).toBe(toDateKey(day1));
  });
});
