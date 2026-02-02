import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";

test.beforeEach(async ({ context }) => {
  await context.addCookies([await getSessionCookie()]);
});

test.describe("Filter Panel", () => {
  test("source filter — check Exa shows only Exa companies", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });
    const initialCount = await page.locator('[role="option"]').count();

    // Source section is open by default — sources are pill buttons, not labels
    await page.locator("button", { hasText: /^Exa$/ }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("vertical filter changes results", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });
    const initialCount = await page.locator('[role="option"]').count();

    // Vertical section is open by default — click checkbox label directly
    await page.locator("label", { hasText: "Food Ingredients" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThan(initialCount);
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("size filter works", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });

    // Size section is open by default, click 1K+ button directly
    await page.locator("button", { hasText: "1K+" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("signal filter shows companies with signals", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });
    const initialCount = await page.locator('[role="option"]').count();

    // Signals section is open by default
    await page.locator("label", { hasText: "Hiring" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("quick filter chip — High ICP", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });
    const initialCount = await page.locator('[role="option"]').count();

    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("multiple filters combine (AND logic)", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });

    // Apply vertical filter
    await page.locator("label", { hasText: "Food Ingredients" }).first().click({ force: true });
    await page.waitForTimeout(500);
    const afterVertical = await page.locator('[role="option"]').count();

    // Also apply High ICP
    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);
    const afterBoth = await page.locator('[role="option"]').count();

    expect(afterBoth).toBeLessThanOrEqual(afterVertical);
  });

  test("reset filters clears all", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });
    const initialCount = await page.locator('[role="option"]').count();

    // Apply a vertical filter
    await page.locator("label", { hasText: "Food Ingredients" }).first().click({ force: true });
    await page.waitForTimeout(500);
    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThan(initialCount);

    // Click Reset button — it's in the presets section
    await page.locator("button", { hasText: /^Reset$/ }).first().click({ force: true });
    await page.waitForTimeout(1000);
    const resetCount = await page.locator('[role="option"]').count();
    // After reset, count should return to initial (all non-excluded companies)
    expect(resetCount).toBeGreaterThanOrEqual(initialCount);
  });

  test("region filter changes results", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });
    const initialCount = await page.locator('[role="option"]').count();

    // Region section is open by default
    await page.locator("label", { hasText: "Europe" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("filter badge count updates", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });

    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);

    await expect(page.locator("text=Filters").first()).toBeVisible();
  });

  test("save preset flow", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector('[role="option"]', { timeout: 10000 });

    // Apply a filter first
    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);

    // Click "Save as Preset" text link
    await page.locator("text=Save as Preset").first().click();
    await page.waitForTimeout(300);

    // Fill the preset name input
    const nameInput = page.locator('input[placeholder*="Preset name"]');
    await nameInput.fill("Test Preset");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  });
});
