/**
 * Authentication E2E tests.
 *
 * Covers:
 *  - Route protection (unauthenticated redirect, protected dashboard)
 *  - Sign-up success & validation failures (weak password, mismatched
 *    passwords, username == password, duplicate username)
 *  - Sign-in success & failure (invalid credentials)
 *  - Sign-out and re-protection
 *  - Navigation between auth pages
 *
 * Run:
 *   npx playwright test e2e/auth.spec.ts
 */
import { test, expect, type Page } from "@playwright/test";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uniqueUser(prefix = "authu") {
  return `${prefix}${Date.now()}${Math.floor(Math.random() * 1000)}`;
}

async function fillSignUp(
  page: Page,
  username: string,
  password: string,
  confirmPassword = password
) {
  await page.goto("/sign-up");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm Password").fill(confirmPassword);
}

async function signUp(page: Page, username: string, password = "Test1234!") {
  await fillSignUp(page, username, password);
  await page.getByRole("button", { name: /^create account$/i }).click();
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: /user menu/i }).click();
  await page.getByRole("menuitem", { name: /sign out/i }).click();
  await expect(page).toHaveURL(/sign-in/);
}

// ---------------------------------------------------------------------------
// Route protection
// ---------------------------------------------------------------------------

test.describe("Auth: route protection", () => {
  test("unauthenticated visit to '/' redirects to /sign-in", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("unauthenticated visit to /dashboard redirects to /sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("/sign-in and /sign-up are publicly accessible", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/sign-up");
    await expect(page).toHaveURL(/\/sign-up$/);
  });
});

// ---------------------------------------------------------------------------
// Sign-up
// ---------------------------------------------------------------------------

test.describe("Auth: sign-up", () => {
  test("form renders expected fields", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("heading", { name: /create account/i })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Confirm Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /^create account$/i })).toBeVisible();
  });

  test("successful sign-up lands on /dashboard", async ({ page }) => {
    await signUp(page, uniqueUser());
    await expect(page).toHaveURL(/\/dashboard$/);
    // Dashboard should render its empty-state
    await expect(page.getByText(/no problems due today/i)).toBeVisible();
  });

  test("weak password is blocked client-side", async ({ page }) => {
    await fillSignUp(page, uniqueUser(), "weak");
    await page.getByRole("button", { name: /^create account$/i }).click();
    // Still on sign-up page
    await expect(page).toHaveURL(/\/sign-up$/);
    // Inline rule feedback shows at least one unmet rule (toast may duplicate text)
    await expect(page.getByText(/at least 8 characters/i).first()).toBeVisible();
  });

  test("mismatched passwords are blocked", async ({ page }) => {
    await fillSignUp(page, uniqueUser(), "Test1234!", "Test9999!");
    await page.getByRole("button", { name: /^create account$/i }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByText(/passwords do not match/i).first()).toBeVisible();
  });

  test("password equal to username is blocked", async ({ page }) => {
    // Use a string that satisfies the password rules so only the
    // "password == username" rule can fail.
    const samename = "Matchu1!";
    await fillSignUp(page, samename, samename);
    await page.getByRole("button", { name: /^create account$/i }).click();
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByText(/password cannot match your username/i)).toBeVisible();
  });

  test("duplicate username is rejected", async ({ page }) => {
    const username = uniqueUser();
    await signUp(page, username);
    await expect(page).toHaveURL(/\/dashboard$/);
    await signOut(page);

    await signUp(page, username);
    // Stays on sign-up with a "username taken" toast
    await expect(page).toHaveURL(/\/sign-up$/);
    await expect(page.getByText(/username is already taken/i)).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Sign-in / Sign-out
// ---------------------------------------------------------------------------

test.describe("Auth: sign-in and sign-out", () => {
  test("form renders expected fields", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("heading", { name: /^login$/i })).toBeVisible();
    await expect(page.getByLabel("Username")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /^login$/i })).toBeVisible();
  });

  test("valid credentials reach /dashboard", async ({ page }) => {
    const username = uniqueUser();
    await signUp(page, username);
    await expect(page).toHaveURL(/\/dashboard$/);
    await signOut(page);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("Test1234!");
    await page.getByRole("button", { name: /^login$/i }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("invalid credentials show error and stay on /sign-in", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByLabel("Username").fill(uniqueUser("ghost"));
    await page.getByLabel("Password").fill("Wrong1234!");
    await page.getByRole("button", { name: /^login$/i }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  });

  test("wrong password for an existing user fails", async ({ page }) => {
    const username = uniqueUser();
    await signUp(page, username);
    await expect(page).toHaveURL(/\/dashboard$/);
    await signOut(page);

    await page.getByLabel("Username").fill(username);
    await page.getByLabel("Password").fill("Wrong1234!");
    await page.getByRole("button", { name: /^login$/i }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByText(/invalid username or password/i)).toBeVisible();
  });

  test("sign-out redirects to /sign-in and re-protects /dashboard", async ({ page }) => {
    await signUp(page, uniqueUser());
    await expect(page).toHaveURL(/\/dashboard$/);
    await signOut(page);

    // After sign-out: cannot access dashboard directly
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});

// ---------------------------------------------------------------------------
// Navigation between auth pages
// ---------------------------------------------------------------------------

test.describe("Auth: navigation", () => {
  test("can navigate from sign-in to sign-up and back", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("link", { name: /create one/i }).click();
    await expect(page).toHaveURL(/\/sign-up$/);

    await page.getByRole("link", { name: /^sign in$/i }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
  });
});
