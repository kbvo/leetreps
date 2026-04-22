/**
 * Scheduler time-travel E2E tests.
 *
 * Uses the `dev-date` cookie to simulate calendar days without waiting.
 * Each test signs up a fresh user so state doesn't leak across runs.
 *
 * Run headed with slow-mo to watch scheduling in action:
 *   npx playwright test e2e/scheduler.spec.ts --headed --slowmo=400
 */
import { test, expect, type Page } from "@playwright/test";
import { addProblem, setDevDate, signUp, uniqueUser } from "./helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openTab(page: Page, tab: "Today" | "Overdue" | "Upcoming" | "Finished") {
  await page.getByRole("tab", { name: new RegExp(`^${tab}`, "i") }).click();
}

function cardTitle(page: Page, title: string) {
  // Scope to <main> so short titles (e.g. "E2") are not confused with the navbar
  // avatar, whose initials are the first two letters of the username (e2e* → "E2").
  return page.getByRole("main").getByText(title, { exact: true });
}

async function expectCardIn(
  page: Page,
  tab: "Today" | "Overdue" | "Upcoming" | "Finished",
  title: string,
  present = true
) {
  await openTab(page, tab);
  if (present) await expect(cardTitle(page, title)).toBeVisible();
  else await expect(cardTitle(page, title)).toBeHidden();
}

async function passProblem(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(`^pass ${title}$`, "i") }).click();
  // Longer timeout: full suite + Neon cold paths can delay server actions
  await expect(cardTitle(page, title)).toBeHidden({ timeout: 15_000 });
}

async function failProblem(page: Page, title: string) {
  await page.getByRole("button", { name: new RegExp(`^fail ${title}$`, "i") }).click();
  await expect(cardTitle(page, title)).toBeHidden({ timeout: 15_000 });
}

async function pullProblem(page: Page) {
  await page.getByRole("button", { name: /pull problem/i }).click();
}

// ---------------------------------------------------------------------------
// Interval logic (pass / fail)
// ---------------------------------------------------------------------------

test.describe("Scheduler: interval progression", () => {
  test("new problem starts in Upcoming, appears in Today the next day", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-01-01");
    await addProblem(page, "Two Sum", "Easy");

    // Day 0 — in Upcoming, not Today
    await expectCardIn(page, "Upcoming", "Two Sum", true);
    await expectCardIn(page, "Today", "Two Sum", false);

    // Day 1 — flips to Today
    await setDevDate(page, "2026-01-02");
    await expectCardIn(page, "Today", "Two Sum", true);
  });

  test("pass advances the interval (1 -> 3 days)", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-02-01");
    await addProblem(page, "Binary Search", "Easy");

    await setDevDate(page, "2026-02-02");
    await openTab(page, "Today");
    await passProblem(page, "Binary Search");

    // Not due between 02-03 and 02-04
    await setDevDate(page, "2026-02-03");
    await expectCardIn(page, "Today", "Binary Search", false);
    await expectCardIn(page, "Upcoming", "Binary Search", true);

    // Due again on 02-05 (3-day interval after 02-02)
    await setDevDate(page, "2026-02-05");
    await expectCardIn(page, "Today", "Binary Search", true);
  });

  test("fail at minimum 1-day interval keeps it at 1 day", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-03-01");
    await addProblem(page, "Merge Sort", "Hard");

    await setDevDate(page, "2026-03-02");
    await openTab(page, "Today");
    await failProblem(page, "Merge Sort");

    await setDevDate(page, "2026-03-03");
    await expectCardIn(page, "Today", "Merge Sort", true);
  });

  test("fail at a higher interval drops one level", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-04-01");
    await addProblem(page, "Heap Sort", "Medium");

    // Day 1: pass -> interval 3 days
    await setDevDate(page, "2026-04-02");
    await openTab(page, "Today");
    await passProblem(page, "Heap Sort");

    // Day 4: due again. Fail -> drop back to 1-day interval
    await setDevDate(page, "2026-04-05");
    await openTab(page, "Today");
    await failProblem(page, "Heap Sort");

    // Should be back in Today on Day 5 (1-day interval)
    await setDevDate(page, "2026-04-06");
    await expectCardIn(page, "Today", "Heap Sort", true);
  });

  test("problem becomes Finished after passing the 30-day interval", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-06-01");
    await addProblem(page, "Dijkstra", "Hard");

    // Intervals: 1, 3, 7, 14, 30 — pass on every due date
    const passDates = [
      "2026-06-02", // after 1d
      "2026-06-05", // +3d
      "2026-06-12", // +7d
      "2026-06-26", // +14d
      "2026-07-26", // +30d -> marks FINISHED
    ];

    for (const d of passDates) {
      await setDevDate(page, d);
      await openTab(page, "Today");
      await passProblem(page, "Dijkstra");
    }

    await expectCardIn(page, "Finished", "Dijkstra", true);
    await expectCardIn(page, "Today", "Dijkstra", false);
    await expectCardIn(page, "Upcoming", "Dijkstra", false);
  });
});

// ---------------------------------------------------------------------------
// Overdue behaviour
// ---------------------------------------------------------------------------

test.describe("Scheduler: overdue handling", () => {
  test("a missed problem lands in Overdue", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-05-01");
    await addProblem(page, "DFS Graph", "Medium");

    // Skip past the due day (was 05-02)
    await setDevDate(page, "2026-05-04");

    await expectCardIn(page, "Overdue", "DFS Graph", true);
    // Overdue cards show a "Was due" label
    await expect(page.getByText(/was due/i).first()).toBeVisible();
    await expectCardIn(page, "Today", "DFS Graph", false);
  });

  test("passing an overdue problem keeps the same interval", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-05-10");
    await addProblem(page, "Topo Sort", "Medium");

    // Skip 3 days, problem is overdue
    await setDevDate(page, "2026-05-14");
    await openTab(page, "Overdue");
    await passProblem(page, "Topo Sort");

    // Same interval (1 day) — should appear in Today again on 05-15
    await setDevDate(page, "2026-05-15");
    await expectCardIn(page, "Today", "Topo Sort", true);
  });

  test("failing an overdue problem decreases the interval", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-05-20");
    await addProblem(page, "Union Find", "Medium");

    // Pass once to push to 3-day interval
    await setDevDate(page, "2026-05-21");
    await openTab(page, "Today");
    await passProblem(page, "Union Find");

    // Skip past the next due date to become overdue
    await setDevDate(page, "2026-05-30");
    await openTab(page, "Overdue");
    await failProblem(page, "Union Find");

    // Interval dropped back to 1-day — due tomorrow
    await setDevDate(page, "2026-05-31");
    await expectCardIn(page, "Today", "Union Find", true);
  });
});

// ---------------------------------------------------------------------------
// Capacity constraints (2 medium/hard per day)
// ---------------------------------------------------------------------------

test.describe("Scheduler: capacity & rebalancing", () => {
  test("3rd medium/hard gets pushed to a later day", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-07-01");
    await addProblem(page, "MH A", "Medium");
    await addProblem(page, "MH B", "Medium");
    await addProblem(page, "MH C", "Medium");

    await setDevDate(page, "2026-07-02");
    await openTab(page, "Today");
    await expect(cardTitle(page, "MH A")).toBeVisible();
    await expect(cardTitle(page, "MH B")).toBeVisible();
    await expect(cardTitle(page, "MH C")).toBeHidden();

    await openTab(page, "Upcoming");
    await expect(cardTitle(page, "MH C")).toBeVisible();
  });

  test("medium and hard share the same daily cap", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-07-10");
    await addProblem(page, "MixM1", "Medium");
    await addProblem(page, "MixH1", "Hard");
    await addProblem(page, "MixH2", "Hard"); // should be pushed — 2 non-easy already booked

    await setDevDate(page, "2026-07-11");
    await openTab(page, "Today");
    await expect(cardTitle(page, "MixM1")).toBeVisible();
    await expect(cardTitle(page, "MixH1")).toBeVisible();
    await expect(cardTitle(page, "MixH2")).toBeHidden();

    await openTab(page, "Upcoming");
    await expect(cardTitle(page, "MixH2")).toBeVisible();
  });

  test("easy problems never count against the daily cap", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-08-01");
    await addProblem(page, "E1", "Easy");
    await addProblem(page, "E2", "Easy");
    await addProblem(page, "E3", "Easy");
    await addProblem(page, "M1", "Medium");
    await addProblem(page, "M2", "Medium");

    await setDevDate(page, "2026-08-02");
    await openTab(page, "Today");
    for (const t of ["E1", "E2", "E3", "M1", "M2"]) {
      await expect(cardTitle(page, t)).toBeVisible();
    }
    await expectCardIn(page, "Upcoming", "E1", false);
  });
});

// ---------------------------------------------------------------------------
// Pull mechanism
// ---------------------------------------------------------------------------

test.describe("Scheduler: pull from Upcoming", () => {
  test("pull banner only appears when there is a pullable upcoming problem", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-09-01");
    await addProblem(page, "Solo", "Medium");

    // Day 1: Solo is Today, nothing else to pull.
    await setDevDate(page, "2026-09-02");
    await openTab(page, "Today");
    await expect(page.getByText(/available to pull/i)).toHaveCount(0);
    await expect(page.getByRole("button", { name: /pull problem/i })).toBeHidden();
  });

  test("pulling moves the earliest-due Upcoming problem into Today with a Pulled badge", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-09-10");
    await addProblem(page, "A", "Medium");
    await addProblem(page, "B", "Medium");
    await addProblem(page, "C", "Medium"); // gets pushed to 09-12

    await setDevDate(page, "2026-09-11");
    await openTab(page, "Today");
    // Pull banner visible because C's nextDueDate is today (09-11)
    await expect(page.getByText(/1 problem available to pull/i)).toBeVisible();

    await pullProblem(page);
    // C now in Today with "Pulled" badge
    await expect(cardTitle(page, "C")).toBeVisible();
    await expect(page.getByText(/^pulled$/i)).toBeVisible();
    // C no longer in Upcoming
    await expectCardIn(page, "Upcoming", "C", false);
  });

  test("pulled problem that is passed is rescheduled at the next interval", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-09-20");
    await addProblem(page, "X", "Medium");
    await addProblem(page, "Y", "Medium");
    await addProblem(page, "Z", "Medium");

    await setDevDate(page, "2026-09-21");
    await openTab(page, "Today");
    await pullProblem(page);
    await passProblem(page, "Z");

    // Z now scheduled 3 days out (from 09-21) -> 09-24
    await setDevDate(page, "2026-09-24");
    await expectCardIn(page, "Today", "Z", true);
  });

  test("pulled-but-not-completed problem never becomes overdue from the pull", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-10-01");
    await addProblem(page, "P1", "Medium");
    await addProblem(page, "P2", "Medium");
    await addProblem(page, "P3", "Medium"); // pushed to 10-03

    await setDevDate(page, "2026-10-02");
    await openTab(page, "Today");
    await pullProblem(page);
    // Intentionally do NOT pass P3.

    // Complete P1 + P2 on their scheduled day so they clear out.
    await passProblem(page, "P1");
    await passProblem(page, "P2");

    // Day passes — pulledForDate is cleared by the reconcile routine.
    await setDevDate(page, "2026-10-03");

    // P3's original scheduledDate was 10-03 — it should now just show
    // in Today, NOT as overdue from the pull.
    await expectCardIn(page, "Overdue", "P3", false);
    await expectCardIn(page, "Today", "P3", true);
  });

  test("no problems are auto-scheduled into Today from Upcoming after completions", async ({ page }) => {
    await signUp(page, uniqueUser());
    await setDevDate(page, "2026-10-10");
    // 4 mediums: 2 scheduled 10-11, 2 more pushed to 10-12
    await addProblem(page, "Q1", "Medium");
    await addProblem(page, "Q2", "Medium");
    await addProblem(page, "Q3", "Medium");
    await addProblem(page, "Q4", "Medium");

    await setDevDate(page, "2026-10-11");
    await openTab(page, "Today");
    // Pass both of today's problems
    await passProblem(page, "Q1");
    await passProblem(page, "Q2");

    // Q3 and Q4 MUST NOT get auto-pulled into today.
    await openTab(page, "Today");
    await expect(cardTitle(page, "Q3")).toBeHidden();
    await expect(cardTitle(page, "Q4")).toBeHidden();
  });

  /**
   * End-to-end guarantee for pull + pass → rebalance: five mediums added the same
   * day land 2/2/1 across the next three calendar days. On day 2, finish both due
   * problems, pull the 3rd (earliest overflow), pass it. That frees a medium slot
   * on the day the 3rd was holding; the 5th problem (was alone on day 4) can move
   * up, so on day 3 *both* the 4th and 5th (by add order) appear in Today — not
   * 3+4 with 5 still in Upcoming.
   *
   * This is *not* implied by the other pull tests in isolation.
   */
  test("5 mediums: after pull+pass on day 2, day 3 shows 4th and 5th due (5th moved up)", async ({ page }) => {
    await signUp(page, uniqueUser("pull5"));
    // Day 1: five mediums → 2 on D+1, 2 on D+2, 1 on D+3
    await setDevDate(page, "2027-05-01");
    await addProblem(page, "Pul1", "Medium");
    await addProblem(page, "Pul2", "Medium");
    await addProblem(page, "Pul3", "Medium");
    await addProblem(page, "Pul4", "Medium");
    await addProblem(page, "Pul5", "Medium");

    // Day 2: pass due (1+2), pull 3, pass 3
    await setDevDate(page, "2027-05-02");
    await openTab(page, "Today");
    await expect(cardTitle(page, "Pul1")).toBeVisible();
    await expect(cardTitle(page, "Pul2")).toBeVisible();
    await passProblem(page, "Pul1");
    await passProblem(page, "Pul2");
    // Pul3–Pul5 are still overflowed (scheduled past today) with nextDue today → 3 pullable
    await expect(page.getByText(/\d+ problems? available to pull/i)).toBeVisible();
    await pullProblem(page);
    await expect(page.getByText(/^pulled$/i)).toBeVisible();
    await passProblem(page, "Pul3");

    // Day 3: 4th & 5th should both be due in Today; 3rd is rescheduled past this day
    await setDevDate(page, "2027-05-03");
    await openTab(page, "Today");
    await expect(cardTitle(page, "Pul4")).toBeVisible();
    await expect(cardTitle(page, "Pul5")).toBeVisible();
    await expect(cardTitle(page, "Pul3")).toBeHidden();
  });
});

// ---------------------------------------------------------------------------
// Pull — additional edge cases (fail path, double pull, copy, easy cap)
// ---------------------------------------------------------------------------

test.describe("Scheduler: pull edge cases", () => {
  test("pulled problem failed (not passed) still clears pull and reschedules; not overdue", async ({ page }) => {
    await signUp(page, uniqueUser("pulfail"));
    await setDevDate(page, "2027-06-01");
    await addProblem(page, "F1", "Medium");
    await addProblem(page, "F2", "Medium");
    await addProblem(page, "F3", "Medium");

    await setDevDate(page, "2027-06-02");
    await openTab(page, "Today");
    await passProblem(page, "F1");
    await passProblem(page, "F2");
    await expect(page.getByText(/\d+ problems? available to pull/i)).toBeVisible();
    await pullProblem(page);
    await expect(page.getByText(/^pulled$/i)).toBeVisible();
    await expect(cardTitle(page, "F3")).toBeVisible();
    await failProblem(page, "F3");
    // Card leaves Today; failing a review is not a "missed day" — not overdue
    await expectCardIn(page, "Overdue", "F3", false);
    // Min interval: next due = tomorrow (June 3)
    await setDevDate(page, "2027-06-03");
    await openTab(page, "Today");
    await expect(cardTitle(page, "F3")).toBeVisible();
  });

  test("two explicit pulls on the same dev day (pull+pass, then pull+pass again)", async ({ page }) => {
    await signUp(page, uniqueUser("pull2x"));
    await setDevDate(page, "2027-06-10");
    await addProblem(page, "D1", "Medium");
    await addProblem(page, "D2", "Medium");
    await addProblem(page, "D3", "Medium");
    await addProblem(page, "D4", "Medium");

    await setDevDate(page, "2027-06-11");
    await openTab(page, "Today");
    await passProblem(page, "D1");
    await passProblem(page, "D2");
    await expect(page.getByText(/\d+ problems? available to pull/i)).toBeVisible();
    await pullProblem(page);
    await passProblem(page, "D3");
    // Second pull same calendar day: D4 is still next eligible overflow
    await expect(page.getByText(/\d+ problems? available to pull/i)).toBeVisible();
    await pullProblem(page);
    await expect(page.getByText(/^pulled$/i)).toBeVisible();
    await passProblem(page, "D4");
    // Nothing left to pull from this queue
    await expect(page.getByText(/available to pull/)).toHaveCount(0);
  });

  test("pull banner uses singular copy when exactly one problem is pullable", async ({ page }) => {
    await signUp(page, uniqueUser("onepull"));
    await setDevDate(page, "2027-07-01");
    await addProblem(page, "S1", "Medium");
    await addProblem(page, "S2", "Medium");
    await addProblem(page, "S3", "Medium");

    await setDevDate(page, "2027-07-02");
    await openTab(page, "Today");
    await passProblem(page, "S1");
    await passProblem(page, "S2");
    // Only S3 is overflowed with next due today → count == 1
    await expect(page.getByText(/1 problem available to pull/i)).toBeVisible();
    await expect(page.getByText(/1 problems available to pull/i)).toBeHidden();
  });

  test("easy problems do not consume medium cap (2 med + 3 easy all due same day)", async ({ page }) => {
    await signUp(page, uniqueUser("mixem"));
    await setDevDate(page, "2027-08-01");
    // Mediums first (deterministic with cap), then easies
    await addProblem(page, "MA", "Medium");
    await addProblem(page, "MB", "Medium");
    await addProblem(page, "EA", "Easy");
    await addProblem(page, "EB", "Easy");
    await addProblem(page, "EC", "Easy");

    await setDevDate(page, "2027-08-02");
    await openTab(page, "Today");
    for (const t of ["MA", "MB", "EA", "EB", "EC"]) {
      await expect(cardTitle(page, t)).toBeVisible();
    }
  });
});
