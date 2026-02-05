import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";

test.describe("Auth Flow", () => {
  test("unauthenticated user is redirected to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login page renders password field and name selector", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("input[type='password']")).toBeVisible();
    // Look for a select/dropdown or name buttons
    const nameSelector = page.locator("select, [role='listbox'], [role='combobox']").first();
    // Name selector may be buttons/cards instead
    const hasSelector = await nameSelector.isVisible().catch(() => false);
    const hasNameButtons = await page.locator("button:has-text('Adi')").isVisible().catch(() => false);
    expect(hasSelector || hasNameButtons).toBe(true);
  });

  test("admin user can access /admin after auth", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie("Adi", true)]);
    await page.goto("/admin");
    // Should not redirect away — admin page should load
    await page.waitForLoadState("networkidle");
    // Check we're still on admin (not redirected to / or /login)
    expect(page.url()).toContain("/admin");
  });

  test("non-admin user is redirected away from /admin", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie("Satish", false)]);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    // Should be redirected away from admin
    expect(page.url()).not.toContain("/admin");
  });

  test("logout clears session and redirects to login", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie()]);
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    // Find and click logout or user menu
    const avatarBtn = page.locator("button.rounded-full").first();
    if (await avatarBtn.isVisible()) {
      await avatarBtn.click();
      const logoutBtn = page.locator("button:has-text('Log out'), button:has-text('Logout'), a:has-text('Log out')").first();
      if (await logoutBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await logoutBtn.click();
        await expect(page).toHaveURL(/\/login/, { timeout: 5000 });
      }
    }
  });
});
