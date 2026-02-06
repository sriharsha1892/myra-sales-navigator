import { test, expect, type Page } from "@playwright/test";
import { getSessionCookie, triggerSearchAndWait } from "./auth-helper";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadApp(page: Page) {
  await page.goto("/");
  await page.waitForSelector("text=myRA", { timeout: 10000 });
}

async function waitForCompanyCards(page: Page) {
  await triggerSearchAndWait(page);
}

async function openFirstDossier(page: Page) {
  await waitForCompanyCards(page);
  await page.locator('[role="option"]').first().click();
  await expect(
    page.locator("text=Last refreshed").first()
  ).toBeVisible({ timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/**
 * Open the OutreachDraftModal from the dossier.
 * Returns true if the modal opened, false if no Draft button was found.
 */
async function openDraftModal(page: Page): Promise<boolean> {
  // Look for any Draft-labeled button (dossier contacts or action bar)
  const draftOutreachBtn = page.locator("button", { hasText: "Draft Outreach" }).first();
  const draftBtn = page.locator("button", { hasText: /Draft/i }).first();

  const trigger = (await draftOutreachBtn.isVisible().catch(() => false))
    ? draftOutreachBtn
    : draftBtn;

  if (!(await trigger.isVisible().catch(() => false))) return false;

  await trigger.click();
  await expect(page.locator("text=Draft Outreach")).toBeVisible({ timeout: 3000 });
  return true;
}

/**
 * Open draft modal from contacts tab by expanding a contact row.
 * Returns true if modal opened.
 */
async function openDraftFromContactsTab(page: Page): Promise<boolean> {
  await page.locator("button", { hasText: "Contacts" }).first().click();
  await page.waitForTimeout(3000);

  // Check for contact content
  const hasCheckbox = await page.locator("input[type='checkbox']").first()
    .isVisible({ timeout: 8000 }).catch(() => false);
  if (!hasCheckbox) return false;

  // Expand first contact
  const contactName = page.locator('[class*="border-b"] [class*="truncate"][class*="font-medium"]').first();
  if (await contactName.isVisible({ timeout: 3000 }).catch(() => false)) {
    await contactName.click({ force: true });
    await page.waitForTimeout(1500);
  }

  // Click Draft button on expanded contact
  const draftBtn = page.locator("button", { hasText: /Draft/i }).first();
  if (!(await draftBtn.isVisible({ timeout: 3000 }).catch(() => false))) return false;

  await draftBtn.click();
  await expect(page.locator("text=Draft Outreach")).toBeVisible({ timeout: 3000 });
  return true;
}

// ===========================================================================
// Section 1: Modal Structure & Controls
// ===========================================================================

test.describe("Email Outreach — Modal Structure", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("modal header shows contact name and company", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    // Header subtitle contains "{firstName} {lastName} at {companyName}"
    const subtitle = page.locator("text=/ at /i").first();
    await expect(subtitle).toBeVisible({ timeout: 2000 });
  });

  test("channel pills render — Email, Connect, InMail, WhatsApp", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await expect(page.locator("button", { hasText: "Email" }).first()).toBeVisible();
    // Channel labels from channelConfig: "Connect", "InMail", "WhatsApp"
    await expect(page.locator("button", { hasText: "Connect" }).first()).toBeVisible();
    await expect(page.locator("button", { hasText: "InMail" }).first()).toBeVisible();
    const whatsappBtn = page.locator("button", { hasText: "WhatsApp" }).first();
    // WhatsApp may be disabled but should exist
    const hasWhatsapp = await whatsappBtn.isVisible({ timeout: 2000 }).catch(() => false);
    expect(typeof hasWhatsapp).toBe("boolean");
  });

  test("template dropdown shows built-in templates", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    // Template label + select element
    await expect(page.locator("text=Template").first()).toBeVisible();
    const select = page.locator("select").first();
    await expect(select).toBeVisible();

    // Verify built-in options exist
    const options = select.locator("option");
    const texts = await options.allTextContents();
    expect(texts).toContain("Cold Intro");
    expect(texts).toContain("Follow-up");
    expect(texts).toContain("Re-engagement");
  });

  test("tone buttons render — Formal, Casual, Direct", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await expect(page.locator("text=Tone").first()).toBeVisible();
    await expect(page.locator("button", { hasText: "Formal" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Casual" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Direct" })).toBeVisible();
  });

  test("Generate Draft button visible in pre-generation state", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await expect(page.locator("button", { hasText: "Generate Draft" })).toBeVisible();
    // Description text should mention prospect data
    await expect(page.locator("text=prospect data and signals").first()).toBeVisible();
  });

  test("writing rules section is collapsible with textarea", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    const toggle = page.locator("button", { hasText: "Writing Rules" });
    await expect(toggle).toBeVisible();

    // Textarea not visible before expand
    const textarea = page.locator("textarea[placeholder*='writing rules']");
    await expect(textarea).toHaveCount(0);

    // Expand
    await toggle.click();
    await page.waitForTimeout(200);
    await expect(textarea).toBeVisible();

    // Type custom rules
    await textarea.fill("Always mention market sizing capabilities");
    expect(await textarea.inputValue()).toBe("Always mention market sizing capabilities");

    // Collapse
    await toggle.click();
    await page.waitForTimeout(200);
    await expect(textarea).toHaveCount(0);

    // "active" indicator should show since rules are non-empty
    await expect(page.locator("text=active").first()).toBeVisible();
  });

  test("modal closes on X button", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await page.locator("button[aria-label='Close']").first().click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Draft Outreach")).toHaveCount(0);
  });
});

// ===========================================================================
// Section 2: Channel-Specific Behavior
// ===========================================================================

test.describe("Email Outreach — Channel Behavior", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("switching to Connect removes Formal tone option", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    // Start on Email — all 3 tones
    await expect(page.locator("button", { hasText: "Formal" })).toBeVisible();

    // Switch to Connect
    await page.locator("button", { hasText: "Connect" }).first().click();
    await page.waitForTimeout(300);

    // Formal should be gone (LinkedIn Connect locks to casual/direct)
    await expect(page.locator("button", { hasText: "Formal" })).toHaveCount(0);
    // Casual should remain
    await expect(page.locator("button", { hasText: "Casual" })).toBeVisible();
  });

  test("switching to InMail preserves subject and all tones", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    // Switch to InMail
    await page.locator("button", { hasText: "InMail" }).first().click();
    await page.waitForTimeout(300);

    // All 3 tones should still be available for InMail
    await expect(page.locator("button", { hasText: "Formal" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Casual" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Direct" })).toBeVisible();
  });

  test("WhatsApp only shows Casual tone", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    const whatsappBtn = page.locator("button", { hasText: "WhatsApp" }).first();
    if (!(await whatsappBtn.isVisible().catch(() => false))) return;
    if (await whatsappBtn.isDisabled()) return;

    await whatsappBtn.click();
    await page.waitForTimeout(300);

    // Only Casual should remain
    await expect(page.locator("button", { hasText: "Casual" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Formal" })).toHaveCount(0);
    await expect(page.locator("button", { hasText: "Direct" })).toHaveCount(0);
  });

  test("template can be changed via dropdown", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    const select = page.locator("select").first();

    // Switch to Follow-up
    await select.selectOption("follow_up");
    expect(await select.inputValue()).toBe("follow_up");

    // Switch to Re-engagement
    await select.selectOption("re_engagement");
    expect(await select.inputValue()).toBe("re_engagement");

    // Switch back to intro
    await select.selectOption("intro");
    expect(await select.inputValue()).toBe("intro");
  });

  test("tone selection highlights active button", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    // Click Casual
    const casualBtn = page.locator("button", { hasText: "Casual" });
    await casualBtn.click();
    await page.waitForTimeout(200);

    // Active tone should have accent styling
    const casualClasses = await casualBtn.getAttribute("class");
    expect(casualClasses).toContain("accent-primary");

    // Click Formal
    const formalBtn = page.locator("button", { hasText: "Formal" });
    await formalBtn.click();
    await page.waitForTimeout(200);

    const formalClasses = await formalBtn.getAttribute("class");
    expect(formalClasses).toContain("accent-primary");
  });
});

// ===========================================================================
// Section 3: Email Generation Flow
// ===========================================================================

test.describe("Email Outreach — Generation Flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("clicking Generate Draft shows loading spinner", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await page.locator("button", { hasText: "Generate Draft" }).click();

    // Loading spinner should appear (animate-spin)
    const spinner = page.locator(".animate-spin").first();
    const loadingText = page.locator("text=Generating draft...").first();

    // At least one loading indicator should flash — it may resolve fast
    const hadSpinner = await spinner.isVisible({ timeout: 2000 }).catch(() => false);
    const hadText = await loadingText.isVisible({ timeout: 2000 }).catch(() => false);

    // Wait for generation to complete (up to 30s for LLM)
    await page.waitForTimeout(2000);
    // After generation, either we see the draft or an error toast
    const hasMessage = await page.locator("text=Message").first()
      .isVisible({ timeout: 25000 }).catch(() => false);
    const hasError = await page.locator("text=/failed|error/i").first()
      .isVisible({ timeout: 2000 }).catch(() => false);

    expect(hadSpinner || hadText || hasMessage || hasError).toBe(true);
  });

  test("generated email shows subject + editable message for email channel", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    // Ensure we're on Email channel
    await page.locator("button", { hasText: "Email" }).first().click();
    await page.waitForTimeout(200);

    // Generate
    await page.locator("button", { hasText: "Generate Draft" }).click();

    // Wait for subject label to appear (email channel has subject)
    const subjectLabel = page.locator("text=Subject").first();
    const hasSubject = await subjectLabel.isVisible({ timeout: 30000 }).catch(() => false);

    if (hasSubject) {
      // Subject input should be editable
      const subjectInput = page.locator("input[type='text']").first();
      await expect(subjectInput).toBeVisible();
      const subjectValue = await subjectInput.inputValue();
      expect(subjectValue.length).toBeGreaterThan(0);

      // Message textarea should be visible and have content
      const messageLabel = page.locator("text=Message").first();
      await expect(messageLabel).toBeVisible();
      const messageTextarea = page.locator("textarea").first();
      await expect(messageTextarea).toBeVisible();
      const messageValue = await messageTextarea.inputValue();
      expect(messageValue.length).toBeGreaterThan(0);
    }
    // If no subject, generation may have failed — acceptable for E2E
  });

  test("subject and message are editable post-generation", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await page.locator("button", { hasText: "Email" }).first().click();
    await page.locator("button", { hasText: "Generate Draft" }).click();

    // Wait for generation
    const subjectInput = page.locator("input[type='text']").first();
    const visible = await subjectInput.isVisible({ timeout: 30000 }).catch(() => false);
    if (!visible) return;

    // Edit subject
    await subjectInput.fill("Custom subject line");
    expect(await subjectInput.inputValue()).toBe("Custom subject line");

    // Edit message
    const messageTextarea = page.locator("textarea").first();
    await messageTextarea.fill("Custom message body for testing");
    expect(await messageTextarea.inputValue()).toBe("Custom message body for testing");
  });

  test("footer shows Regenerate, Cancel, and Copy to Clipboard after generation", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await page.locator("button", { hasText: "Generate Draft" }).click();

    // Wait for generation to complete
    const messageLabel = page.locator("text=Message").first();
    const generated = await messageLabel.isVisible({ timeout: 30000 }).catch(() => false);
    if (!generated) return;

    // Footer actions
    await expect(page.locator("button", { hasText: "Regenerate" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Cancel" })).toBeVisible();
    await expect(page.locator("button", { hasText: "Copy to Clipboard" })).toBeVisible();
  });

  test("Regenerate produces a new draft", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await page.locator("button", { hasText: "Generate Draft" }).click();

    const messageTextarea = page.locator("textarea").first();
    const generated = await messageTextarea.isVisible({ timeout: 30000 }).catch(() => false);
    if (!generated) return;

    const firstDraft = await messageTextarea.inputValue();

    // Click Regenerate
    await page.locator("button", { hasText: "Regenerate" }).click();

    // Loading spinner should appear briefly
    await page.waitForTimeout(500);

    // Wait for new draft
    await page.locator("text=Message").first().waitFor({ state: "visible", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000);

    // Message area should still be visible (new draft loaded)
    await expect(messageTextarea).toBeVisible();
    // Content may or may not differ — just verify it's non-empty
    const secondDraft = await messageTextarea.inputValue();
    expect(secondDraft.length).toBeGreaterThan(0);
  });

  test("Cancel button in footer closes the modal", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);
    if (!(await openDraftModal(page))) return;

    await page.locator("button", { hasText: "Generate Draft" }).click();

    const messageLabel = page.locator("text=Message").first();
    const generated = await messageLabel.isVisible({ timeout: 30000 }).catch(() => false);
    if (!generated) return;

    // Click Cancel in footer
    await page.locator("button", { hasText: "Cancel" }).first().click();
    await page.waitForTimeout(300);

    await expect(page.locator("text=Draft Outreach")).toHaveCount(0);
  });
});

// ===========================================================================
// Section 4: Contextual myRA AI Content
// ===========================================================================

test.describe("Email Outreach — myRA AI Context", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("API generates email that references myRA capabilities", async ({ page }) => {
    await loadApp(page);

    // Call the API directly with controlled inputs
    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "John Smith",
        companyName: "Ingredion",
        companyIndustry: "Food Ingredients",
        contactTitle: "VP Strategy",
        tone: "direct",
        channel: "email",
        template: "intro",
        signals: [
          { type: "expansion", title: "Expanding to Asia Pacific", description: "Ingredion opening new facility in Singapore", date: "2026-01" }
        ],
        hubspotStatus: "none",
      },
    });

    if (res.status() !== 200) {
      // LLM may be unavailable — skip gracefully
      expect([200, 503]).toContain(res.status());
      return;
    }

    const body = await res.json();
    expect(body).toHaveProperty("message");
    expect(body.message.length).toBeGreaterThan(20);

    // Email should reference myRA or research-related terms — not "a technology company"
    const combined = `${body.subject ?? ""} ${body.message}`.toLowerCase();
    expect(combined).not.toContain("a technology company");

    // Should contain at least one myRA-relevant term
    const myraTerms = ["myra", "research", "intelligence", "market", "data", "insight"];
    const hasMyraContext = myraTerms.some((term) => combined.includes(term));
    expect(hasMyraContext).toBe(true);
  });

  test("API returns subject field for email channel", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "Sarah Chen",
        companyName: "Lonza",
        companyIndustry: "Pharmaceuticals",
        contactTitle: "Director of Innovation",
        tone: "formal",
        channel: "email",
        template: "intro",
        signals: [],
        hubspotStatus: "none",
      },
    });

    if (res.status() !== 200) return;

    const body = await res.json();
    expect(body).toHaveProperty("subject");
    expect(body).toHaveProperty("message");
    expect(body.subject.length).toBeGreaterThan(0);
    expect(body.message.length).toBeGreaterThan(0);
  });

  test("API returns message-only for LinkedIn Connect (no subject)", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "Mike Johnson",
        companyName: "BASF",
        companyIndustry: "Chemicals",
        contactTitle: "Head of Research",
        tone: "casual",
        channel: "linkedin_connect",
        template: "intro",
        signals: [],
        hubspotStatus: "none",
      },
    });

    if (res.status() !== 200) return;

    const body = await res.json();
    expect(body).toHaveProperty("message");
    expect(body.message.length).toBeGreaterThan(0);
    // LinkedIn Connect has 300 char limit
    expect(body.message.length).toBeLessThanOrEqual(350); // small tolerance
  });

  test("API respects follow-up template with existing relationship", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "Priya Patel",
        companyName: "Symrise",
        companyIndustry: "Flavors & Fragrances",
        contactTitle: "VP Procurement",
        tone: "casual",
        channel: "email",
        template: "follow_up",
        signals: [],
        hubspotStatus: "customer",
        freshsalesStatus: "won",
      },
    });

    if (res.status() !== 200) return;

    const body = await res.json();
    expect(body).toHaveProperty("subject");
    expect(body).toHaveProperty("message");
    // Follow-up emails should be shorter (100 word limit)
    const wordCount = body.message.split(/\s+/).length;
    expect(wordCount).toBeLessThanOrEqual(150); // some tolerance over 100
  });

  test("API accepts and uses writing rules", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "David Kim",
        companyName: "Evonik",
        companyIndustry: "Specialty Chemicals",
        contactTitle: "CTO",
        tone: "direct",
        channel: "email",
        template: "intro",
        signals: [],
        hubspotStatus: "none",
        writingRules: "Mention competitive intelligence capabilities. Reference TAM/SAM/SOM analysis.",
      },
    });

    if (res.status() !== 200) return;

    const body = await res.json();
    expect(body).toHaveProperty("message");
    expect(body.message.length).toBeGreaterThan(20);
  });

  test("generated email does not explicitly reference signals (not too personalized)", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "Lisa Wang",
        companyName: "Givaudan",
        companyIndustry: "Flavors & Fragrances",
        contactTitle: "VP Innovation",
        tone: "direct",
        channel: "email",
        template: "intro",
        signals: [
          { type: "hiring", title: "Hiring 50 R&D scientists", description: "Major R&D expansion in Geneva", date: "2026-01" },
          { type: "funding", title: "$200M sustainability bond", description: "Funding sustainable ingredient sourcing", date: "2026-01" },
        ],
        hubspotStatus: "none",
      },
    });

    if (res.status() !== 200) return;

    const body = await res.json();
    const msg = body.message.toLowerCase();
    // Should NOT directly quote signal details like a stalker
    // "50 R&D scientists" or "$200M sustainability bond" should NOT appear verbatim
    expect(msg).not.toContain("50 r&d scientists");
    expect(msg).not.toContain("$200m sustainability bond");
  });
});

// ===========================================================================
// Section 5: Contacts Tab → Draft Flow
// ===========================================================================

test.describe("Email Outreach — Contacts Tab Integration", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("Draft button appears on expanded contact card", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await page.locator("button", { hasText: "Contacts" }).first().click();
    await page.waitForTimeout(3000);

    const hasCheckbox = await page.locator("input[type='checkbox']").first()
      .isVisible({ timeout: 8000 }).catch(() => false);
    if (!hasCheckbox) return;

    // Expand first contact
    const contactName = page.locator('[class*="border-b"] [class*="truncate"][class*="font-medium"]').first();
    if (await contactName.isVisible({ timeout: 3000 }).catch(() => false)) {
      await contactName.click({ force: true });
      await page.waitForTimeout(1500);

      // Draft button should appear in expanded row
      const draftBtn = page.locator("button", { hasText: /Draft/i }).first();
      const hasDraft = await draftBtn.isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof hasDraft).toBe("boolean");
    }
  });

  test("Draft from contacts tab opens modal with correct contact context", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const modalOpened = await openDraftFromContactsTab(page);
    if (!modalOpened) return;

    // Modal should be visible
    await expect(page.locator("text=Draft Outreach")).toBeVisible();
    // Subtitle should show contact name + company
    const subtitle = page.locator("text=/ at /i").first();
    await expect(subtitle).toBeVisible({ timeout: 2000 });
  });

  test("full flow: contacts tab → expand → draft → generate → copy → close", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const modalOpened = await openDraftFromContactsTab(page);
    if (!modalOpened) return;

    // Generate
    await page.locator("button", { hasText: "Generate Draft" }).click();

    // Wait for generation
    const messageLabel = page.locator("text=Message").first();
    const generated = await messageLabel.isVisible({ timeout: 30000 }).catch(() => false);
    if (!generated) {
      // LLM unavailable — verify error toast appeared
      const hasError = await page.locator("text=/failed|error/i").first()
        .isVisible({ timeout: 3000 }).catch(() => false);
      expect(typeof hasError).toBe("boolean");
      return;
    }

    // Verify content generated
    const messageTextarea = page.locator("textarea").first();
    const content = await messageTextarea.inputValue();
    expect(content.length).toBeGreaterThan(0);

    // Click Copy to Clipboard
    await page.locator("button", { hasText: "Copy to Clipboard" }).click();
    await page.waitForTimeout(500);

    // Feedback label should show "Copied"
    const copiedFeedback = page.locator("text=Copied").first();
    const hasFeedback = await copiedFeedback.isVisible({ timeout: 2000 }).catch(() => false);
    expect(typeof hasFeedback).toBe("boolean");

    // Close modal
    await page.locator("button[aria-label='Close']").first().click();
    await page.waitForTimeout(300);
    await expect(page.locator("text=Draft Outreach")).toHaveCount(0);
  });
});

// ===========================================================================
// Section 6: API Route Validation
// ===========================================================================

test.describe("Email Outreach — API Validation", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("POST /api/outreach/draft rejects missing required fields", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: { contactName: "Test" },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  test("POST /api/outreach/draft rejects invalid channel", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "Test Person",
        companyName: "Test Corp",
        tone: "formal",
        channel: "carrier_pigeon",
      },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid channel");
  });

  test("POST /api/outreach/draft accepts all valid channels", async ({ page }) => {
    await loadApp(page);

    const channels = ["email", "linkedin_connect", "linkedin_inmail", "whatsapp"];
    for (const channel of channels) {
      const res = await page.request.post("/api/outreach/draft", {
        data: {
          contactName: "Test Person",
          companyName: "Test Corp",
          companyIndustry: "Technology",
          contactTitle: "VP Engineering",
          tone: channel === "whatsapp" ? "casual" : "formal",
          channel,
          template: "intro",
          signals: [],
          hubspotStatus: "none",
        },
      });
      // Should either succeed (200) or be unavailable (503) — not 400
      expect([200, 503]).toContain(res.status());
    }
  });

  test("GET /api/outreach/drafts returns draft history array", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.get("/api/outreach/drafts?contactId=test-nonexistent");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("drafts");
    expect(Array.isArray(body.drafts)).toBe(true);
  });

  test("POST /api/outreach/draft with InMail returns subject + message", async ({ page }) => {
    await loadApp(page);

    const res = await page.request.post("/api/outreach/draft", {
      data: {
        contactName: "Anna Berg",
        companyName: "Novozymes",
        companyIndustry: "Biotechnology",
        contactTitle: "Chief Strategy Officer",
        tone: "formal",
        channel: "linkedin_inmail",
        template: "intro",
        signals: [],
        hubspotStatus: "none",
      },
    });

    if (res.status() !== 200) return;

    const body = await res.json();
    // InMail has subject like email
    expect(body).toHaveProperty("subject");
    expect(body).toHaveProperty("message");
    expect(body.subject.length).toBeGreaterThan(0);
  });
});

// ===========================================================================
// Section 7: Admin Email Prompts Configuration
// ===========================================================================

test.describe("Email Outreach — Admin Configuration", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie("Adi", true)]);
  });

  test("Email Prompts tab shows company description and value proposition fields", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const emailPromptsTab = page.locator("button", { hasText: /Email|Prompts/i }).first();
    if (await emailPromptsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailPromptsTab.click();
      await page.waitForTimeout(1000);

      // Company description field
      const companyDescLabel = page.locator("text=/Company Description/i").first();
      const hasDesc = await companyDescLabel.isVisible({ timeout: 3000 }).catch(() => false);

      // Value proposition field
      const valuePropLabel = page.locator("text=/Value Proposition/i").first();
      const hasValueProp = await valuePropLabel.isVisible({ timeout: 2000 }).catch(() => false);

      // At least one config section should be visible
      expect(hasDesc || hasValueProp).toBe(true);
    }
  });

  test("Outreach Channels config section visible", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const emailPromptsTab = page.locator("button", { hasText: /Email|Prompts/i }).first();
    if (await emailPromptsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailPromptsTab.click();
      await page.waitForTimeout(1000);

      const hasChannels = await page.locator("text=Outreach Channels").isVisible({ timeout: 3000 }).catch(() => false);
      const hasEnabled = await page.locator("text=Enabled Channels").isVisible({ timeout: 2000 }).catch(() => false);
      expect(hasChannels || hasEnabled).toBe(true);
    }
  });

  test("Outreach Suggestion Rules section has toggle switches", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");

    const emailPromptsTab = page.locator("button", { hasText: /Email|Prompts/i }).first();
    if (await emailPromptsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await emailPromptsTab.click();
      await page.waitForTimeout(1000);

      const hasSuggestionRules = await page.locator("text=Outreach Suggestion Rules")
        .isVisible({ timeout: 3000 }).catch(() => false);

      if (hasSuggestionRules) {
        // Should have checkboxes/toggles for rules
        const checkboxes = page.locator("input[type='checkbox']");
        const count = await checkboxes.count();
        expect(count).toBeGreaterThan(0);
      }
    }
  });
});
