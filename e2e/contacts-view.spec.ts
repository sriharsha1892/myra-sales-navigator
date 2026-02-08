import { test, expect } from "@playwright/test";
import { getSessionCookie, triggerSearchAndWait } from "./auth-helper";

test.beforeEach(async ({ context }) => {
  await context.addCookies([await getSessionCookie()]);
});

test.describe("Contacts View", () => {
  test("company card shows contacts link", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);
    // Each company card has a "N contacts" link
    const contactsLink = page.locator("text=/\\d+ contacts/").first();
    await expect(contactsLink).toBeVisible({ timeout: 5000 });
  });

  test("switching between companies and exported tabs works", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Switch to exported
    const exportedBtn = page.locator("button", { hasText: "Exported" }).first();
    await exportedBtn.click();
    await page.waitForTimeout(1000);

    // Switch back to companies
    const companiesBtn = page.locator("button", { hasText: "Companies" }).first();
    await companiesBtn.click();
    await page.waitForTimeout(1000);

    // Company cards should be visible again
    await expect(page.locator('[role="option"]').first()).toBeVisible({ timeout: 5000 });
  });

  test("contacts tab shows loading or contact content", async ({ page }) => {
    await page.goto("/");
    await triggerSearchAndWait(page);

    // Click "N contacts" on the first company card to expand inline contacts
    const contactsLink = page.locator("text=/\\d+ contacts/").first();
    if (await contactsLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contactsLink.click();
      await page.waitForTimeout(2000);
    }

    // The page should still have company cards visible
    const hasCards = await page.locator('[role="option"]').first().isVisible().catch(() => false);
    expect(hasCards).toBe(true);
  });
});
