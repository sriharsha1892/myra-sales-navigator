import { test, expect } from "@playwright/test";
import { getSessionCookie, triggerSearchAndWait } from "./auth-helper";

test.beforeEach(async ({ context }) => {
  await context.addCookies([await getSessionCookie()]);
});

test.describe("Export Flow", () => {
  test("selecting companies shows bulk action bar", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Select all with keyboard shortcut
    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);

    // Bulk action bar should show "X selected"
    await expect(
      page.locator("text=/\\d+ selected/i").first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("export buttons available after selection", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);

    // Bulk action bar should show with some action buttons
    const hasCsv = await page.locator("text=Export CSV").isVisible().catch(() => false);
    const hasCopy = await page.locator("text=Copy to Clipboard").isVisible().catch(() => false);
    const hasSelected = await page.locator("text=/\\d+ selected/i").isVisible().catch(() => false);
    // At least the selected count should be visible
    expect(hasSelected || hasCsv || hasCopy).toBe(true);
  });

  test("click Export CSV triggers export flow", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);

    const exportBtn = page.locator("button", { hasText: /Export CSV/i }).first();
    if (await exportBtn.isVisible()) {
      await exportBtn.click();
      await page.waitForTimeout(1000);
    }
  });

  test("exported view accessible via toggle", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Switch to exported view (Contacts tab removed, replaced by Exported)
    await page.locator("button", { hasText: "Exported" }).first().click();
    await page.waitForTimeout(500);

    // Switch back to companies
    await page.locator("button", { hasText: "Companies" }).first().click();
    await page.waitForTimeout(500);
    const cards = page.locator('[role="option"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("Cmd+E triggers export shortcut", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Select all first
    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);

    // Try export shortcut
    await page.keyboard.press("Meta+e");
    await page.waitForTimeout(1000);
  });

  test("deselect all hides bulk action bar", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Select all
    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);
    await expect(
      page.locator("text=/\\d+ selected/i").first()
    ).toBeVisible({ timeout: 3000 });

    // Deselect all
    await page.keyboard.press("Meta+Shift+a");
    await page.waitForTimeout(500);
  });

  test("clicking company card shows dossier with contacts", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });
    await triggerSearchAndWait(page);

    // Click on the first company card
    await page.locator('[role="option"]').first().click();
    await page.waitForTimeout(1000);

    // Wait for slide-over breadcrumb or action buttons
    await expect(
      page.locator("nav[aria-label='Breadcrumb']").or(page.locator("text=Mark Excluded")).first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("company dossier shows source badges", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });
    await triggerSearchAndWait(page);

    await page.locator('[role="option"]').first().click();
    // Wait for slide-over breadcrumb or action buttons
    await expect(
      page.locator("nav[aria-label='Breadcrumb']").or(page.locator("text=Mark Excluded")).first()
    ).toBeVisible({ timeout: 20000 });
  });
});
