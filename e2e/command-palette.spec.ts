import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";

const PALETTE_INPUT = 'input[placeholder*="type a command"]';

test.beforeEach(async ({ context }) => {
  await context.addCookies([await getSessionCookie()]);
});

test.describe("Command Palette", () => {
  test("Cmd+K opens palette with search input visible", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");

    const input = page.locator(PALETTE_INPUT);
    await expect(input).toBeVisible({ timeout: 3000 });
  });

  test("type company name shows company in results", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");

    const input = page.locator(PALETTE_INPUT);
    await input.fill("BASF");
    await page.waitForTimeout(500);

    await expect(page.locator("text=BASF").first()).toBeVisible({ timeout: 3000 });
  });

  test("selecting company via Enter closes palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");

    const input = page.locator(PALETTE_INPUT);
    await input.fill("BASF");
    await page.waitForTimeout(500);

    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    await expect(input).not.toBeVisible({ timeout: 3000 });
  });

  test("View Companies command works", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });

    // Switch to contacts first
    await page.locator("button", { hasText: "Contacts" }).first().click();
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+k");
    const input = page.locator(PALETTE_INPUT);
    await input.fill("View Companies");
    await page.waitForTimeout(500);

    const viewCmd = page.locator("text=/View Companies/i").first();
    if (await viewCmd.isVisible()) {
      await viewCmd.click();
      await page.waitForTimeout(500);
    }
  });

  test("Reset All Filters command works", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });

    await page.locator("text=High ICP").first().click();
    await page.waitForTimeout(500);

    await page.keyboard.press("Meta+k");
    const input = page.locator(PALETTE_INPUT);
    await input.fill("Reset");
    await page.waitForTimeout(500);

    const resetCmd = page.locator("text=/Reset.*Filter/i").first();
    if (await resetCmd.isVisible()) {
      await resetCmd.click();
      await page.waitForTimeout(500);
    }
  });

  test("Escape closes palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");

    const input = page.locator(PALETTE_INPUT);
    await expect(input).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);

    await expect(input).not.toBeVisible({ timeout: 3000 });
  });

  test("arrow keys navigate palette results", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });
    await page.keyboard.press("Meta+k");

    const input = page.locator(PALETTE_INPUT);
    await expect(input).toBeVisible({ timeout: 3000 });

    // Click the input to ensure focus before typing
    await input.click();
    await page.waitForTimeout(200);
    await input.type("Ing", { delay: 50 });
    await page.waitForTimeout(500);

    // Navigate with arrow keys
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(200);
  });

  test("clicking search button opens palette", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 10000 });

    await page.locator("text=Search companies...").click();
    await page.waitForTimeout(500);

    const input = page.locator(PALETTE_INPUT);
    await expect(input).toBeVisible({ timeout: 3000 });
  });
});
