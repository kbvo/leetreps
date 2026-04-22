"use client";

import { useState } from "react";
import { setDevDate } from "@/lib/actions/dev";

export function DevTimeControls({ currentDevDate }: { currentDevDate: string | null }) {
  const [isPending, setIsPending] = useState(false);

  async function apply(dateStr: string | null) {
    setIsPending(true);
    await setDevDate(dateStr);
    // Full reload so client-side useEffect data fetches re-run with the new date.
    window.location.reload();
  }

  const isOverriding = !!currentDevDate;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-center gap-3 border-t bg-yellow-50 dark:bg-yellow-950/60 px-4 py-2 text-xs">
      <span className="font-semibold text-yellow-800 dark:text-yellow-300 shrink-0">
        ⏱ DEV
      </span>
      <span className="text-yellow-700 dark:text-yellow-400 shrink-0">
        {isOverriding ? `Simulating: ${currentDevDate}` : "Using real date"}
      </span>
      <input
        type="date"
        defaultValue={currentDevDate ?? ""}
        disabled={isPending}
        onChange={(e) => { if (e.target.value) apply(e.target.value); }}
        className="rounded border border-yellow-300 dark:border-yellow-700 bg-white dark:bg-yellow-900/50 px-2 py-0.5 text-xs text-foreground disabled:opacity-50"
      />
      {isOverriding && (
        <button
          onClick={() => apply(null)}
          disabled={isPending}
          className="rounded border border-yellow-400 px-2 py-0.5 text-yellow-800 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-900 disabled:opacity-40"
        >
          Reset to today
        </button>
      )}
    </div>
  );
}
