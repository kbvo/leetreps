import { test, expect } from "@playwright/test";
import { addProblem, signUp, uniqueUser } from "./helpers";

test.describe("Data isolation", () => {
  test("user B never sees user A's problem titles", async ({ browser }) => {
    const titleA = `IsoA-${Date.now()}`;
    const userA = uniqueUser("isoA");
    const userB = uniqueUser("isoB");

    const c1 = await browser.newContext();
    const p1 = await c1.newPage();
    await signUp(p1, userA);
    await addProblem(p1, titleA, "Easy");
    // New problems start on interval 0 → first due date is tomorrow, so the card
    // lands under Upcoming, not Today.
    await p1.getByRole("tab", { name: /upcoming/i }).click();
    await expect(p1.getByText(titleA, { exact: true })).toBeVisible();

    const c2 = await browser.newContext();
    const p2 = await c2.newPage();
    await signUp(p2, userB);
    await expect(p2.getByText(titleA, { exact: true })).toHaveCount(0);
    await expect(p2.getByText(/no problems due today/i)).toBeVisible();

    // A's dashboard should still list the problem after B signs up in another context.
    await p1.getByRole("tab", { name: /upcoming/i }).click();
    await expect(p1.getByText(titleA, { exact: true })).toBeVisible();

    await c1.close();
    await c2.close();
  });
});
