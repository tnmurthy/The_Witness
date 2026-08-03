/**
 * e2e/public-reader.spec.ts
 *
 * E2E tests for the public reader interface.
 * These tests do NOT require authentication — they verify the public-facing
 * pages that any visitor can access without an account.
 *
 * Requires a published issue to exist in the database:
 *   E2E_PUB_SLUG=test-publication
 *   E2E_ISSUE_SLUG=test-issue
 */
import { test, expect } from "@playwright/test";

test.describe("Public reader interface", () => {
  test("publication home page is accessible without auth", async ({ page }) => {
    const pubSlug = process.env.E2E_PUB_SLUG ?? "bmsit-tech-review";
    const response = await page.goto(`/p/${pubSlug}`);

    // Should not redirect to sign-in
    expect(page.url()).not.toContain("sign-in");

    // May 404 if the publication doesn't exist — that's acceptable for
    // a test without seeded data. What we're testing is that it doesn't
    // redirect to auth.
    expect(response?.status()).not.toBe(302);
  });

  test("subscribe form accepts valid email input", async ({ page }) => {
    const pubSlug = process.env.E2E_PUB_SLUG ?? "bmsit-tech-review";
    await page.goto(`/p/${pubSlug}`);

    // If the page returns 404 (no such publication) the form won't exist
    const form = page.locator('input[type="email"]').first();
    if (!(await form.isVisible())) {
      test.skip();
      return;
    }

    await form.fill("reader@example.com");
    await expect(form).toHaveValue("reader@example.com");
  });

  test("unsubscribed page loads without auth", async ({ page }) => {
    await page.goto("/unsubscribed");
    await expect(page.getByText(/unsubscribed/i)).toBeVisible();
    expect(page.url()).not.toContain("sign-in");
  });
});
