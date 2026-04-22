"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { getDashboardData, reviewProblem, pullNextProblem } from "@/lib/actions/problems";
import { AddProblemDialog } from "@/components/add-problem-dialog";
import { ProblemCard } from "@/components/problem-card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

type Problem = {
  id: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  intervalIndex: number;
  nextDueDate: string | Date;
  scheduledDate: string | Date;
  status: "ACTIVE" | "OVERDUE" | "FINISHED";
  pulledForDate?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  lastAttemptedAt: string | Date | null;
  lastResult: string | null;
};

type DashboardData = {
  todayProblems: Problem[];
  overdueProblems: Problem[];
  upcomingProblems: Problem[];
  finishedProblems: Problem[];
  todayKey: string;
  pullableCount: number;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isPending, startTransition] = useTransition();
  const [activeAction, setActiveAction] = useState<string | null>(null);

  const refresh = useCallback(() => {
    startTransition(async () => {
      try {
        const result = await getDashboardData();
        setData(result as DashboardData);
      } catch {
        toast.error("Failed to load dashboard");
      }
    });
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleReview(problemId: string, result: "PASS" | "FAIL") {
    setActiveAction(problemId);
    try {
      await reviewProblem({ problemId, result });
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Review failed");
    } finally {
      setActiveAction(null);
    }
  }

  async function handlePullNext() {
    setActiveAction("__pull__");
    try {
      await pullNextProblem();
      refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No problems available to pull");
    } finally {
      setActiveAction(null);
    }
  }

  if (!data && isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-2xl font-bold tracking-tight text-foreground">
          {format(new Date(), "EEEE, MMMM d")}
        </p>
        <AddProblemDialog onAdded={refresh} />
      </div>

      <Tabs defaultValue="today" className="space-y-4">
        <TabsList className="flex w-full bg-background border border-border rounded-lg">

          <TabsTrigger value="today">
            Today
            {data.todayProblems.length > 0 && (
              <span className="tab-count ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                {data.todayProblems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Overdue
            {data.overdueProblems.length > 0 && (
              <span className="tab-count ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                {data.overdueProblems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="upcoming">
            Upcoming
            {data.upcomingProblems.length > 0 && (
              <span className="tab-count ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                {data.upcomingProblems.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="finished">
            Finished
            {data.finishedProblems.length > 0 && (
              <span className="tab-count ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-medium leading-none">
                {data.finishedProblems.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-3">
          {data.todayProblems.length === 0 && data.pullableCount === 0 ? (
            <EmptyState message="No problems due today." />
          ) : (
            <>
              {data.todayProblems.map((p) => (
                <ProblemCard
                  key={p.id}
                  problem={p}
                  variant="today"
                  onPass={(id) => handleReview(id, "PASS")}
                  onFail={(id) => handleReview(id, "FAIL")}
                  loading={activeAction === p.id}
                />
              ))}
              {data.pullableCount > 0 && (
                <PullBanner
                  count={data.pullableCount}
                  onPull={handlePullNext}
                  loading={activeAction === "__pull__"}
                />
              )}
            </>
          )}
        </TabsContent>

        <TabsContent value="overdue" className="space-y-3">
          {data.overdueProblems.length === 0 ? (
            <EmptyState message="No overdue problems." />
          ) : (
            data.overdueProblems.map((p) => (
              <ProblemCard
                key={p.id}
                problem={p}
                variant="overdue"
                onPass={(id) => handleReview(id, "PASS")}
                onFail={(id) => handleReview(id, "FAIL")}
                loading={activeAction === p.id}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="upcoming" className="space-y-3">
          {data.upcomingProblems.length === 0 ? (
            <EmptyState message="No upcoming problems." />
          ) : (
            data.upcomingProblems.map((p) => (
              <ProblemCard
                key={p.id}
                problem={p}
                variant="upcoming"
                loading={false}
              />
            ))
          )}
        </TabsContent>

        <TabsContent value="finished" className="space-y-3">
          {data.finishedProblems.length === 0 ? (
            <EmptyState message="No finished problems yet." />
          ) : (
            data.finishedProblems.map((p) => (
              <ProblemCard
                key={p.id}
                problem={p}
                variant="finished"
                loading={false}
              />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}


function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center rounded-lg border border-dashed py-12 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function PullBanner({
  count,
  onPull,
  loading,
}: {
  count: number;
  onPull: () => void;
  loading: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-dashed border-blue-300 bg-blue-50/60 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-blue-800">
          {count} problem{count !== 1 ? "s" : ""} available to pull
        </p>
        <p className="text-xs text-blue-500 mt-0.5">
          Pull problem from upcoming list.
        </p>
      </div>
      <button
        aria-label="Pull problem"
        onClick={onPull}
        disabled={loading}
        className="shrink-0 rounded-md border border-blue-300 bg-white px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40 transition-colors"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pull"}
      </button>
    </div>
  );
}
