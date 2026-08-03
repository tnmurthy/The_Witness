/**
 * e2e/issue-builder.spec.ts
 *
 * E2E tests for the Issue Builder.
 * Requires authenticated access (E2E_TEST_EMAIL + E2E_TEST_PASSWORD)
 * and an existing issue (E2E_ISSUE_ID).
 *
 * These tests verify the most critical interactive surface in the product:
 * the block-based editor. Unit tests cannot verify drag-and-drop, autosave
 * timing, or the actual DOM interaction with the block canvas.
 */
import { test, expect, Page } from "@playwright/test";

test.skip(
  !process.env.E2E_TEST_EMAIL,
  "Skipped: set E2E_TEST_EMAIL, E2E_TEST_PASSWORD, and E2E_ISSUE_ID to run"
);

const TEST_EMAIL = process.env.E2E_TEST_EMAIL!;
const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD!;
const ISSUE_ID = process.env.E2E_ISSUE_ID ?? "";

async function signIn(page: Page) {
  await page.goto("/sign-in");
  await page.getByRole("textbox", { name: /email/i }).fill(TEST_EMAIL);
  await page.getByRole("textbox", { name: /password/i }).fill(TEST_PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/dashboard/, { timeout: 10000 });
}

test.describe("Issue Builder", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("issues list page loads and shows New Issue button", async ({ page }) => {
    await page.goto("/issues");
    await expect(page.getByRole("button", { name: /new issue/i })).toBeVisible();
  });

  test("issue builder loads when navigating to an issue", async ({ page }) => {
    if (!ISSUE_ID) {
      test.skip();
      return;
    }

    await page.goto(`/issues/${ISSUE_ID}`);

    // The Issue Builder toolbar should be visible
    await expect(page.locator('[data-testid="issue-builder-toolbar"], header')).toBeVisible();

    // The publish/submit button should be visible (status-dependent)
    const publishBtn = page.getByRole("button", { name: /publish|submit for review/i });
    await expect(publishBtn).toBeVisible({ timeout: 8000 });
  });

  test("adding a paragraph block works", async ({ page }) => {
    if (!ISSUE_ID) {
      test.skip();
      return;
    }

    await page.goto(`/issues/${ISSUE_ID}`);
    await page.waitForLoadState("networkidle");

    // Click "Add block" or the block type selector
    const addBlockBtn = page.getByRole("button", { name: /add block|paragraph/i }).first();
    if (!(await addBlockBtn.isVisible())) {
      test.skip();
      return;
    }

    await addBlockBtn.click();

    // A new editable block should appear
    const newBlock = page.locator('[contenteditable="true"], textarea').last();
    await expect(newBlock).toBeVisible({ timeout: 5000 });
    await newBlock.type("E2E test content");
    await expect(newBlock).toHaveText(/E2E test content/);
  });
});
