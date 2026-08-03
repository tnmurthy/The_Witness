/**
 * e2e/auth.spec.ts
 *
 * E2E tests for authentication flows.
 * Requires a real Supabase project with a test account:
 *   E2E_TEST_EMAIL=test@yourdomain.com
 *   E2E_TEST_PASSWORD=TestPassword123!
 *
 * These tests run against a real browser against a running server.
 * They verify what unit tests cannot: the actual page transitions,
 * form interactions, redirect chains, and session cookie behavior.
 */
import { test, expect } from "@playwright/test";

const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? "e2e-test@witness-test.invalid";
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? "TestPassword123!";

test.describe("Authentication", () => {
  test("sign-in page loads and shows the form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page).toHaveTitle(/The Witness|Sign/i);
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("sign-in with invalid credentials shows an error", async ({ page }) => {
    await page.goto("/sign-in");
    await page.getByRole("textbox", { name: /email/i }).fill("notreal@example.com");
    await page.getByRole("textbox", { name: /password/i }).fill("wrongpassword");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Expect an error message — the exact text depends on implementation
    // but something indicating failure should appear within 5 seconds
    await expect(page.getByText(/invalid|incorrect|not found|failed/i)).toBeVisible({ timeout: 8000 });
  });

  test("sign-up page loads and shows the form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
    await expect(page.getByRole("textbox", { name: /password/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /sign up|create account/i })).toBeVisible();
  });

  test("forgot password page loads", async ({ page }) => {
    await page.goto("/forgot-password");
    await expect(page.getByRole("textbox", { name: /email/i })).toBeVisible();
  });

  test("unauthenticated user is redirected from dashboard to sign-in", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to sign-in
    await expect(page).toHaveURL(/sign-in/);
  });

  test.describe("authenticated flows", () => {
    test.skip(
      !process.env.E2E_TEST_EMAIL,
      "Skipped: set E2E_TEST_EMAIL and E2E_TEST_PASSWORD to run authenticated tests"
    );

    test("signs in with valid credentials and lands on dashboard", async ({ page }) => {
      await page.goto("/sign-in");
      await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
      await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
      await page.getByRole("button", { name: /sign in/i }).click();

      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
      // Dashboard should show navigation
      await expect(page.getByRole("navigation")).toBeVisible();
    });
  });
});
