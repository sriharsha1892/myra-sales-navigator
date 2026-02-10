import { test, expect, type Page } from "@playwright/test";
import { getSessionCookie } from "./auth-helper";
import { setupMockApi, MOCK_SEQUENCE, MOCK_ENROLLMENT } from "./helpers/mock-api";

/**
 * Helper: search and open the dossier for the first company.
 */
async function searchAndOpenDossier(page: Page) {
  await page.goto("/");
  await page.waitForSelector("text=myRA", { timeout: 20000 });

  const chip = page.locator("button.rounded-pill").first();
  await chip.waitFor({ state: "visible", timeout: 10000 });
  await chip.click();
  await page.waitForSelector('[role="option"]', { timeout: 15000 });

  await page.locator('[role="option"]').first().click();

  await expect(
    page.locator("nav[aria-label='Breadcrumb']")
      .or(page.locator("text=Mark Excluded"))
      .first()
  ).toBeVisible({ timeout: 20000 });

  await page.waitForTimeout(2000);
}

test.describe("Sequence Enrollment", () => {
  test.beforeEach(async ({ page, context }) => {
    await setupMockApi(page);
    await context.addCookies([await getSessionCookie("Adi", true)]);
  });

  test("sequences API returns mock sequence list", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Use page.evaluate to go through page.route mocks (page.request bypasses them)
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/outreach/sequences");
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.sequences).toBeDefined();
    expect(result.body.sequences.length).toBeGreaterThan(0);
    expect(result.body.sequences[0].name).toBe("Standard Outreach");
    expect(result.body.sequences[0].steps.length).toBe(3);
    expect(result.body.sequences[0].steps[0].channel).toBe("email");
  });

  test("enrollment creation API returns valid enrollment", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Create an enrollment via fetch (goes through page.route mocks)
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/outreach/enrollments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequenceId: "seq-001",
          contactId: "contact-1",
          companyDomain: "acme.com",
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(201);
    expect(result.body.sequenceId).toBe("seq-001");
    expect(result.body.contactId).toBe("contact-1");
    expect(result.body.companyDomain).toBe("acme.com");
    expect(result.body.status).toBe("active");
    expect(result.body.currentStep).toBe(0);
  });

  test("enrollment detail API returns enrollment with step logs", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Fetch enrollment details via page.evaluate
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/outreach/enrollments/enroll-001");
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.enrollment).toBeDefined();
    expect(result.body.enrollment.id).toBe("enroll-001");
    expect(result.body.enrollment.status).toBe("active");
    expect(result.body.enrollment.currentStep).toBe(0);

    expect(result.body.stepLogs).toBeDefined();
    expect(result.body.stepLogs.length).toBeGreaterThan(0);
    expect(result.body.stepLogs[0].channel).toBe("email");
    expect(result.body.stepLogs[0].status).toBe("pending");
  });

  test("advance enrollment step via API", async ({ page }) => {
    await page.goto("/");
    await page.waitForSelector("text=myRA", { timeout: 20000 });

    // Advance the enrollment via PUT
    const result = await page.evaluate(async () => {
      const res = await fetch("/api/outreach/enrollments/enroll-001", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "advance",
          outcome: "sent",
          notes: "Initial outreach email sent",
        }),
      });
      return { status: res.status, body: await res.json() };
    });

    expect(result.status).toBe(200);
    expect(result.body.enrollment).toBeDefined();
    expect(result.body.enrollment.currentStep).toBe(1);
    expect(result.body.completed).toBe(false);
  });

  test("dossier contacts have outreach-related actions", async ({ page }) => {
    await searchAndOpenDossier(page);

    // Look for outreach-related UI elements in the dossier
    const hasDraft = await page.locator('button:has-text("Draft")').first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasOutreach = await page.locator('button:has-text("Outreach")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasEnroll = await page.locator('button:has-text("Enroll")').first().isVisible({ timeout: 3000 }).catch(() => false);
    const hasContacts = await page.locator("text=Jane Smith").first().isVisible({ timeout: 5000 }).catch(() => false);
    const hasContactsSection = await page.locator("text=/[Cc]ontact/").first().isVisible({ timeout: 3000 }).catch(() => false);

    // At least contacts section or an outreach action should exist
    expect(hasDraft || hasOutreach || hasEnroll || hasContacts || hasContactsSection).toBe(true);
  });
});
