import { describe, it, expect } from "vitest";
import {
  addProblemSchema,
  reviewProblemSchema,
  pullProblemSchema,
  DifficultyEnum,
  ReviewResultEnum,
} from "@/lib/schemas";

describe("addProblemSchema", () => {
  it("accepts valid input", () => {
    const result = addProblemSchema.safeParse({
      title: "Two Sum",
      difficulty: "EASY",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all difficulty levels", () => {
    for (const d of ["EASY", "MEDIUM", "HARD"]) {
      const result = addProblemSchema.safeParse({ title: "Test", difficulty: d });
      expect(result.success).toBe(true);
    }
  });

  it("rejects empty title", () => {
    const result = addProblemSchema.safeParse({ title: "", difficulty: "EASY" });
    expect(result.success).toBe(false);
  });

  it("rejects invalid difficulty", () => {
    const result = addProblemSchema.safeParse({
      title: "Test",
      difficulty: "IMPOSSIBLE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects title over 200 characters", () => {
    const result = addProblemSchema.safeParse({
      title: "a".repeat(201),
      difficulty: "MEDIUM",
    });
    expect(result.success).toBe(false);
  });
});

describe("reviewProblemSchema", () => {
  it("accepts valid PASS review", () => {
    const result = reviewProblemSchema.safeParse({
      problemId: "abc123",
      result: "PASS",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid FAIL review", () => {
    const result = reviewProblemSchema.safeParse({
      problemId: "abc123",
      result: "FAIL",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty problemId", () => {
    const result = reviewProblemSchema.safeParse({
      problemId: "",
      result: "PASS",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid result", () => {
    const result = reviewProblemSchema.safeParse({
      problemId: "abc",
      result: "SKIP",
    });
    expect(result.success).toBe(false);
  });
});

describe("pullProblemSchema", () => {
  it("accepts valid problemId", () => {
    const result = pullProblemSchema.safeParse({ problemId: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty problemId", () => {
    const result = pullProblemSchema.safeParse({ problemId: "" });
    expect(result.success).toBe(false);
  });
});

describe("DifficultyEnum", () => {
  it("validates all difficulty values", () => {
    expect(DifficultyEnum.safeParse("EASY").success).toBe(true);
    expect(DifficultyEnum.safeParse("MEDIUM").success).toBe(true);
    expect(DifficultyEnum.safeParse("HARD").success).toBe(true);
    expect(DifficultyEnum.safeParse("easy").success).toBe(false);
  });
});

describe("ReviewResultEnum", () => {
  it("validates result values", () => {
    expect(ReviewResultEnum.safeParse("PASS").success).toBe(true);
    expect(ReviewResultEnum.safeParse("FAIL").success).toBe(true);
    expect(ReviewResultEnum.safeParse("pass").success).toBe(false);
  });
});
