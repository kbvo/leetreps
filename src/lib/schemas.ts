import { z } from "zod";

export const DifficultyEnum = z.enum(["EASY", "MEDIUM", "HARD"]);
export type Difficulty = z.infer<typeof DifficultyEnum>;

export const ProblemStatusEnum = z.enum(["ACTIVE", "OVERDUE", "FINISHED"]);
export type ProblemStatus = z.infer<typeof ProblemStatusEnum>;

export const ReviewResultEnum = z.enum(["PASS", "FAIL"]);
export type ReviewResult = z.infer<typeof ReviewResultEnum>;

export const addProblemSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  difficulty: DifficultyEnum,
});
export type AddProblemInput = z.infer<typeof addProblemSchema>;

export const reviewProblemSchema = z.object({
  problemId: z.string().min(1),
  result: ReviewResultEnum,
});
export type ReviewProblemInput = z.infer<typeof reviewProblemSchema>;

export const pullProblemSchema = z.object({
  problemId: z.string().min(1),
});
export type PullProblemInput = z.infer<typeof pullProblemSchema>;
