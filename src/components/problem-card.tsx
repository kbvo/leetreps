"use client";

import { format } from "date-fns";
import { Check, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DIFFICULTY_CONFIG, INTERVALS } from "@/lib/constants";
import type { Difficulty, ProblemStatus } from "@/lib/schemas";

interface ProblemCardProps {
  problem: {
    id: string;
    title: string;
    difficulty: Difficulty;
    intervalIndex: number;
    nextDueDate: string | Date;
    scheduledDate: string | Date;
    status: ProblemStatus;
    pulledForDate?: string | Date | null;
    createdAt: string | Date;
    updatedAt: string | Date;
    lastAttemptedAt: string | Date | null;
    lastResult: string | null;
  };
  variant: "today" | "overdue" | "upcoming" | "finished";
  onPass?: (id: string) => void;
  onFail?: (id: string) => void;
  loading?: boolean;
}

/**
 * Safely formats a date for display using UTC date components.
 * Works correctly for both Postgres DATE fields (midnight UTC) and
 * regular DateTime timestamps.
 */
function fmtDate(date: string | Date): string {
  const iso = (typeof date === "string" ? date : date.toISOString()).split("T")[0];
  const [y, m, d] = iso.split("-").map(Number);
  return format(new Date(y, m - 1, d), "MMM d");
}

function LastResult({ result }: { result: string | null }) {
  if (!result) return null;
  const pass = result === "PASS";
  return pass
    ? <Check className="inline h-3 w-3 text-emerald-600" strokeWidth={2.5} />
    : <X className="inline h-3 w-3 text-red-600" strokeWidth={2.5} />;
}

function MetaItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/50 leading-none">{label}</span>
      <span className="text-xs text-muted-foreground leading-none">{children}</span>
    </div>
  );
}

export function ProblemCard({
  problem,
  variant,
  onPass,
  onFail,
  loading,
}: ProblemCardProps) {
  const diffConfig = DIFFICULTY_CONFIG[problem.difficulty];
  const interval = INTERVALS[problem.intervalIndex];
  const isPulled = variant === "today" && !!problem.pulledForDate;

  return (
    <Card className="gap-0 py-0 transition-shadow hover:shadow-md">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <CardTitle className="text-sm font-semibold leading-tight">
              {problem.title}
            </CardTitle>
            {isPulled && (
              <Badge
                variant="outline"
                className="shrink-0 text-xs border-blue-300 bg-blue-50 text-blue-700"
              >
                Pulled
              </Badge>
            )}
          </div>
          <Badge
            variant="outline"
            className={`shrink-0 text-xs ${diffConfig.bgColor} ${diffConfig.color} border`}
          >
            {diffConfig.label}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-1">
        {variant === "finished" ? (
          <p className="text-xs text-muted-foreground">
            Finished {fmtDate(problem.updatedAt)}
          </p>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-5">
              <MetaItem label="Interval">{interval}d</MetaItem>
              <MetaItem label="Added">{fmtDate(problem.createdAt)}</MetaItem>
              {problem.lastAttemptedAt && (
                <MetaItem label="Last Attempt">
                  {fmtDate(problem.lastAttemptedAt)}{" "}
                  <LastResult result={problem.lastResult} />
                </MetaItem>
              )}
              {variant === "upcoming" && (
                <MetaItem label="Due">{fmtDate(problem.scheduledDate)}</MetaItem>
              )}
              {variant === "overdue" && (
                <MetaItem label="Was due">{fmtDate(problem.scheduledDate)}</MetaItem>
              )}
            </div>

            {(variant === "today" || variant === "overdue") && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  aria-label={`Fail ${problem.title}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-600 hover:text-white disabled:opacity-40 transition-colors"
                  onClick={() => onFail?.(problem.id)}
                  disabled={loading}
                >
                  <X className="h-3 w-3" strokeWidth={2.5} />
                </button>
                <button
                  aria-label={`Pass ${problem.title}`}
                  className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 hover:bg-emerald-600 hover:text-white disabled:opacity-40 transition-colors"
                  onClick={() => onPass?.(problem.id)}
                  disabled={loading}
                >
                  <Check className="h-3 w-3" strokeWidth={2.5} />
                </button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
