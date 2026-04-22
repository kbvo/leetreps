import { expect, type Page } from "@playwright/test";

export function uniqueUser(prefix = "e2e") {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

const DEFAULT_PASSWORD = "Test1234!";

export async function signUp(page: Page, username: string, password = DEFAULT_PASSWORD) {
  await page.goto("/sign-up");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(password);
  await page.getByRole("button", { name: /^create account$/i }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/**
 * Set the dev-date cookie so server actions treat `dateStr` as "today".
 * Pass `null` to clear the override. Reloads the dashboard.
 */
export async function setDevDate(page: Page, dateStr: string | null) {
  if (!dateStr) {
    await page.context().clearCookies({ name: "dev-date" });
  } else {
    await page.context().addCookies([
      {
        name: "dev-date",
        value: dateStr,
        url: "http://localhost:3000",
        httpOnly: false,
        sameSite: "Lax",
      },
    ]);
  }
  await page.reload();
  await expect(page.getByRole("tab", { name: /^today/i })).toBeVisible();
}

/** Open the "Add problem" dialog, fill it in, submit, and wait for close. */
export async function addProblem(
  page: Page,
  title: string,
  difficulty: "Easy" | "Medium" | "Hard" = "Medium"
) {
  await page.getByRole("button", { name: /add problem/i }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(title);

  const trigger = dialog.getByLabel("Difficulty");
  const current = (await trigger.innerText()).trim();
  if (current.toLowerCase() !== difficulty.toLowerCase()) {
    await trigger.click();
    await page.getByRole("option", { name: new RegExp(`^${difficulty}$`, "i") }).click();
  }

  await dialog.getByRole("button", { name: /^add$/i }).click();
  await expect(dialog).toBeHidden({ timeout: 5000 });
}
