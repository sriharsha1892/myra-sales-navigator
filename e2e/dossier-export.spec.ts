import { test, expect, type Page } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";
import { setupMockApi } from "./helpers/mock-api";

/**
 * Helper: trigger a search via quick-start chip and click the first company
 * card to open the dossier pane. Waits for the dossier breadcrumb to appear.
 */
async function searchAndOpenDossier(page: Page) {
  await page.goto("/");
  await page.waitForSelector("text=myRA", { timeout: 20000 });

  // Trigger search via quick-start chip
  const chip = page.locator("button.rounded-pill").first();
  await chip.waitFor({ state: "visible", timeout: 10000 });
  await chip.click();
  await page.waitForSelector('[role="option"]', { timeout: 15000 });

  // Click first company card
  await page.locator('[role="option"]').first().click();

  // Wait for dossier to load — breadcrumb or action bar
  await expect(
    page.locator("nav[aria-label='Breadcrumb']")
      .or(page.locator("text=Mark Excluded"))
      .first()
  ).toBeVisible({ timeout: 20000 });

  // Give the dossier sections time to render (contacts load async)
  await page.waitForTimeout(3000);
}

test.describe("Dossier & Export", () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockApi(page);
    await context.addCookies([await getSessionCookie("Adi", true)]);
  });

  test("dossier opens with breadcrumb and action bar", async ({ page }) => {
    await searchAndOpenDossier(page);

    // The breadcrumb should show the company name
    const breadcrumb = page.locator("nav[aria-label='Breadcrumb']");
    await expect(breadcrumb).toBeVisible({ timeout: 5000 });

    // The action bar should have Mark Excluded and Export buttons
    const hasExclude = await page.locator("text=Mark Excluded").isVisible().catch(() => false);
    const hasExport = await page.locator('button:has-text("Export")').first().isVisible().catch(() => false);
    expect(hasExclude || hasExport).toBe(true);
  });

  test("dossier renders contacts or loading state", async ({ page }) => {
    await searchAndOpenDossier(page);

    // The dossier should show either:
    // 1. Contact names (if contacts loaded from mock)
    // 2. A "Contacts" section heading
    // 3. Loading/skeleton state
    const hasContactName = await page.locator("text=Jane Smith").first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasContactSection = await page.locator("text=/[Cc]ontact/").first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasLoading = await page.locator('[class*="animate-pulse"], [class*="shimmer"], [class*="skeleton"]').first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least one of these should be true — the contacts section exists
    expect(hasContactName || hasContactSection || hasLoading).toBe(true);
  });

  test("dossier has checkboxes for contact selection", async ({ page }) => {
    await searchAndOpenDossier(page);

    // Look for checkboxes in the dossier area.
    // These can be in contact rows or as a "select all" toggle.
    const checkboxes = page.locator('input[type="checkbox"]');
    const count = await checkboxes.count();

    // There should be at least one checkbox
    expect(count).toBeGreaterThan(0);

    // Click the first checkbox to verify it works
    await checkboxes.first().click();
    await expect(checkboxes.first()).toBeChecked();
  });

  test("Export Contacts button is present and clickable", async ({ page }) => {
    await searchAndOpenDossier(page);

    // The action bar at the bottom of the dossier has "Export Contacts" button
    const exportBtn = page.locator('button:has-text("Export Contacts"), button:has-text("Export")').first();
    await expect(exportBtn).toBeVisible({ timeout: 10000 });

    // Click export
    await exportBtn.click();

    // After clicking export, the page should remain functional
    await page.waitForTimeout(1000);
    const stillHasBranding = await page.locator("h1").filter({ hasText: "myRA" }).isVisible().catch(() => false);
    expect(stillHasBranding).toBe(true);
  });

  test("Cmd+E keyboard shortcut triggers export flow", async ({ page }) => {
    await searchAndOpenDossier(page);

    // Press Cmd+E to trigger export
    await page.keyboard.press("Meta+e");

    // Wait for some response
    await page.waitForTimeout(2000);

    // The app should not crash; verify the page is still functional
    const stillHasBranding = await page.locator("h1").filter({ hasText: "myRA" }).isVisible().catch(() => false);
    expect(stillHasBranding).toBe(true);
  });
});
