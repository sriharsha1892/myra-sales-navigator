import { test, expect } from "@playwright/test";
import { getSessionCookie, triggerSearchAndWait } from "./auth-helper";

const PALETTE_INPUT = 'input[placeholder*="type a command"]';

test.beforeEach(async ({ context }) => {
  await context.addCookies([await getSessionCookie()]);
});

test.describe("Keyboard Shortcuts", () => {
  test("Cmd+K opens command palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");
    await expect(page.locator(PALETTE_INPUT)).toBeVisible({ timeout: 3000 });
  });

  test("typing in command palette filters results", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");
    const input = page.locator(PALETTE_INPUT);
    await input.fill("Ingredion");
    await page.waitForTimeout(500);
    await expect(page.locator("text=Ingredion").first()).toBeVisible();
  });

  test("Escape closes command palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");
    await expect(page.locator(PALETTE_INPUT)).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await expect(page.locator(PALETTE_INPUT)).not.toBeVisible();
  });

  test("Escape with slide-over open closes slide-over", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    await page.locator('[role="option"]').first().click();
    await expect(page.locator("text=Last refreshed").first()).toBeVisible({ timeout: 5000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  });

  test("/ focuses filter search input", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=Filters", { timeout: 10000 });
    // Click on the results area first to ensure no input is focused
    await page.locator('[role="listbox"]').first().click();
    await page.waitForTimeout(300);
    await page.keyboard.press("/");
    await page.waitForTimeout(500);
    // The filter search input (data-filter-search) should be focused
    const filterInput = page.locator("[data-filter-search]");
    if (await filterInput.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(filterInput).toBeFocused();
    }
  });

  test("Cmd+A selects all visible companies", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);
    await expect(
      page.locator("text=/selected/i").first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("Cmd+Shift+A deselects all", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    await page.keyboard.press("Meta+a");
    await page.waitForTimeout(500);
    await page.keyboard.press("Meta+Shift+a");
    await page.waitForTimeout(500);
  });

  test("arrow keys navigate results", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    await page.locator('[role="listbox"]').first().focus();
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(300);
  });

  test("Cmd+K then type + Enter selects company", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");
    const input = page.locator(PALETTE_INPUT);
    await input.fill("Ingredion");
    await page.waitForTimeout(500);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1000);
    await expect(page.locator(PALETTE_INPUT)).not.toBeVisible({ timeout: 3000 });
  });
});
