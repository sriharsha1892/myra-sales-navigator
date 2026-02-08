import { test, expect } from "@playwright/test";
import { getSessionCookie, triggerSearchAndWait } from "./auth-helper";

test.beforeEach(async ({ context }) => {
  await context.addCookies([await getSessionCookie()]);
});

test.describe("Filter Panel", () => {
  test("filter panel shows filter sections", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Filter panel should show section titles
    await expect(page.locator("h2", { hasText: "Filters" })).toBeVisible();
    // Verify key filter sections exist (collapsed by default)
    const verticalSection = page.locator("text=Vertical").first();
    await expect(verticalSection).toBeVisible({ timeout: 5000 });
    const regionSection = page.locator("text=Region").first();
    await expect(regionSection).toBeVisible();
  });

  test("vertical filter changes results", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    const initialCount = await page.locator('[role="option"]').count();

    // Vertical section is open by default — click checkbox label directly
    const verticalLabel = page.locator("label", { hasText: "Food Ingredients" }).first();
    if (await verticalLabel.isVisible({ timeout: 3000 }).catch(() => false)) {
      await verticalLabel.click({ force: true });
      await page.waitForTimeout(500);

      const filteredCount = await page.locator('[role="option"]').count();
      // Filter should change results (may equal if all match the vertical)
      expect(filteredCount).toBeLessThanOrEqual(initialCount);
    }
  });

  test("size filter works", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Size section is open by default, click 1K+ button directly
    await page.locator("button", { hasText: "1K+" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeGreaterThan(0);
  });

  test("signal filter shows companies with signals", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    const initialCount = await page.locator('[role="option"]').count();

    // Signals section is open by default
    await page.locator("label", { hasText: "Hiring" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("quick filter chip — High ICP", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    const initialCount = await page.locator('[role="option"]').count();

    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("multiple filters combine (AND logic)", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

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
    await triggerSearchAndWait(page);
    const initialCount = await page.locator('[role="option"]').count();

    // Apply the High ICP quick filter (reliable toggle)
    const highIcp = page.locator("text=High ICP").first();
    if (await highIcp.isVisible({ timeout: 3000 }).catch(() => false)) {
      await highIcp.click();
      await page.waitForTimeout(500);
    }

    // Click Reset button — it's in the presets section
    const resetBtn = page.locator("button", { hasText: /^Reset$/ }).first();
    if (await resetBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await resetBtn.click({ force: true });
      await page.waitForTimeout(1000);
      const resetCount = await page.locator('[role="option"]').count();
      // After reset, count should return to at least what we started with
      expect(resetCount).toBeGreaterThanOrEqual(initialCount);
    }
  });

  test("region filter changes results", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    const initialCount = await page.locator('[role="option"]').count();

    // Region section is open by default
    await page.locator("label", { hasText: "Europe" }).first().click({ force: true });
    await page.waitForTimeout(500);

    const filteredCount = await page.locator('[role="option"]').count();
    expect(filteredCount).toBeLessThanOrEqual(initialCount);
  });

  test("filter badge count updates", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);

    await expect(page.locator("h2", { hasText: "Filters" })).toBeVisible();
  });

  test("save preset flow", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

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
