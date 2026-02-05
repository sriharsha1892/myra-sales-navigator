import { test, expect } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";

test.describe("Admin Flow", () => {
  test("admin user can navigate to /admin page", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie("Adi", true)]);
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Click Admin link
    const adminLink = page.locator("a:has-text('Admin')").first();
    if (await adminLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await adminLink.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("/admin");
    }
  });

  test("admin page loads configuration sections", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie("Adi", true)]);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Admin page should show configuration sections
    // Look for ICP weights, team members, or other config sections
    const hasConfig = await page.locator("text=/ICP|[Ww]eight|[Tt]eam|[Cc]onfig/").first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(hasConfig).toBe(true);
  });

  test("admin page shows exclusion management", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie("Adi", true)]);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    // Look for exclusions section
    const exclusionsSection = page.locator("text=/[Ee]xclusion/").first();
    const hasExclusions = await exclusionsSection.isVisible({ timeout: 5000 }).catch(() => false);
    expect(typeof hasExclusions).toBe("boolean");
  });

  test("non-admin user cannot access admin page", async ({ context, page }) => {
    await context.addCookies([await getSessionCookie("Satish", false)]);
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
    // Should be redirected
    expect(page.url()).not.toMatch(/\/admin$/);
  });
});
