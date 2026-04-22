import type { Difficulty } from "./schemas";

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { label: string; color: string; bgColor: string }
> = {
  EASY: {
    label: "Easy",
    color: "text-emerald-700",
    bgColor: "bg-emerald-50 border-emerald-200",
  },
  MEDIUM: {
    label: "Medium",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  HARD: {
    label: "Hard",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
};

export const INTERVALS = [1, 3, 7, 14, 30] as const;
