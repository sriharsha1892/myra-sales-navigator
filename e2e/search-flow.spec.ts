import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";
import { setupMockApi, MOCK_SEARCH_RESULTS } from "./helpers/mock-api";

test.describe("Search Flow", () => {
  test.beforeEach(async ({ page, context }) => {
    // Set up mocks BEFORE navigation so all API calls are intercepted
    await setupMockApi(page);
    await context.addCookies([await getSessionCookie("Adi", true)]);
  });

  test("home page loads with search bar and branding", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // The myRA branding should appear
    await expect(page.locator("h1").filter({ hasText: "myRA" })).toBeVisible();

    // Search bar should be present (the rounded-pill input in the top bar)
    const searchInput = page.locator("input.rounded-pill, input[type='text']").first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
  });

  test("typing a query in the search bar triggers search and shows company cards", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Find and fill the search input
    const searchInput = page.locator("input.rounded-pill, input[type='text']").first();
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await searchInput.click();
    await searchInput.fill("chemicals in Europe");
    await searchInput.press("Enter");

    // Wait for company cards (role="option") to appear
    await page.waitForSelector('[role="option"]', { timeout: 15000 });
    const cards = page.locator('[role="option"]');
    expect(await cards.count()).toBeGreaterThan(0);

    // Company names from mock data should be visible
    await expect(page.locator("text=Acme Corporation").first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator("text=Globex Industries").first()).toBeVisible({ timeout: 5000 });
  });

  test("clicking a quick-start chip triggers search", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Quick-start chips are buttons with .rounded-pill class
    const chip = page.locator("button.rounded-pill").first();
    await chip.waitFor({ state: "visible", timeout: 10000 });
    await chip.click();

    // Company cards should appear
    await page.waitForSelector('[role="option"]', { timeout: 15000 });
    const cards = page.locator('[role="option"]');
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test("clicking a company card opens the detail pane", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Trigger search via quick-start chip
    const chip = page.locator("button.rounded-pill").first();
    await chip.waitFor({ state: "visible", timeout: 10000 });
    await chip.click();
    await page.waitForSelector('[role="option"]', { timeout: 15000 });

    // Click the first company card
    const firstCard = page.locator('[role="option"]').first();
    await firstCard.click();

    // The detail/slide-over pane should open — check for breadcrumb or action buttons
    await expect(
      page.locator("nav[aria-label='Breadcrumb']")
        .or(page.locator("text=Mark Excluded"))
        .first()
    ).toBeVisible({ timeout: 20000 });
  });

  test("detail pane shows company data after selection", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Trigger search
    const chip = page.locator("button.rounded-pill").first();
    await chip.waitFor({ state: "visible", timeout: 10000 });
    await chip.click();
    await page.waitForSelector('[role="option"]', { timeout: 15000 });

    // Click a company card
    await page.locator('[role="option"]').first().click();

    // Wait for the dossier to load
    await expect(
      page.locator("nav[aria-label='Breadcrumb']")
        .or(page.locator("text=Mark Excluded"))
        .first()
    ).toBeVisible({ timeout: 20000 });

    // The detail pane should show action buttons
    const hasExclude = await page.locator("text=Mark Excluded").isVisible().catch(() => false);
    const hasExport = await page.locator('button:has-text("Export")').first().isVisible().catch(() => false);

    // At least one action should be visible
    expect(hasExclude || hasExport).toBe(true);
  });
});
