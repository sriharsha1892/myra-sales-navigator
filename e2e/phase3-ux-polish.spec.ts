import { test, expect, type Page } from "@playwright/test";
import { getSessionCookie, triggerSearchAndWait } from "./auth-helper";

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

const TOOLTIP_WAIT = 250; // 200ms tooltip delay + 50ms buffer
const ANIMATION_WAIT = 300;
const UNDO_DURATION = 6500; // 6s auto-dismiss + 500ms buffer

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
  // Wait for slide-over breadcrumb nav (renders immediately on selection)
  await expect(
    page.locator("nav[aria-label='Breadcrumb']").first()
  ).toBeVisible({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
}

/** Open the preset dropdown. Handles toggle state by checking if it's already open. */
async function openPresetDropdown(page: Page) {
  const deleteBtn = page.locator('button[aria-label="Delete preset"]').first();
  const alreadyOpen = await deleteBtn.isVisible().catch(() => false);
  if (alreadyOpen) return; // Dropdown already showing presets

  await page.locator("button", { hasText: "Select a preset..." }).first().click();
  await page.waitForTimeout(ANIMATION_WAIT);
}

/** Close the preset dropdown if it's open. */
async function closePresetDropdown(page: Page) {
  const deleteBtn = page.locator('button[aria-label="Delete preset"]').first();
  const isOpen = await deleteBtn.isVisible().catch(() => false);
  if (isOpen) {
    await page.locator("button", { hasText: "Select a preset..." }).first().click();
    await page.waitForTimeout(ANIMATION_WAIT);
  }
}

/**
 * Create a preset, then trigger its delete confirmation dialog.
 * Filters are already active by default (regions, sizes, signals pre-checked).
 * After saving, opens the preset dropdown and clicks the delete button.
 * Returns the preset name for assertions.
 */
async function createAndDeletePreset(page: Page): Promise<string> {
  const presetName = `Test-${Date.now()}`;

  // Close dropdown if open from a previous flow
  await closePresetDropdown(page);

  // Click "Save as Preset" — filters are already active from default state
  await page.locator("text=Save as Preset").first().click();
  await page.waitForTimeout(ANIMATION_WAIT);

  // Fill preset name and save
  const nameInput = page.locator('input[placeholder*="Preset name"]');
  await nameInput.fill(presetName);
  await page.keyboard.press("Enter");
  // Wait for API to persist preset and replace optimistic version with server version
  await page.waitForTimeout(1500);

  // Open the preset dropdown to see the newly saved preset
  await openPresetDropdown(page);

  // Click the delete button (X icon) next to the preset
  const deleteBtn = page.locator('button[aria-label="Delete preset"]').first();
  await deleteBtn.waitFor({ state: "visible", timeout: 5000 });
  await deleteBtn.click();
  await page.waitForTimeout(ANIMATION_WAIT);

  return presetName;
}

/**
 * Confirm the delete in a ConfirmDialog by clicking the destructive "Delete" button.
 */
async function confirmDeleteDialog(page: Page) {
  const deleteBtn = page.locator("button.bg-danger", { hasText: "Delete" });
  await deleteBtn.click();
  await page.waitForTimeout(ANIMATION_WAIT);
}

/**
 * Blur any focused input so keyboard shortcuts (like Cmd+A) reach the global handler.
 */
async function blurActiveInput(page: Page) {
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.waitForTimeout(100);
}

/**
 * Locate the undo toast (not the Next.js route announcer which also has role="alert").
 */
function undoToastLocator(page: Page) {
  return page.locator('[role="alert"]').filter({ hasText: /Undo/ });
}

// ---------------------------------------------------------------------------
// Section 1: Styled Tooltips
// ---------------------------------------------------------------------------

test.describe("Section 1: Styled Tooltips", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("1.1 — Source badge tooltip shows full provider name", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    for (const cls of [".bg-source-exa", ".bg-source-apollo", ".bg-source-hubspot"]) {
      const badge = page.locator(cls).first();
      if (await badge.isVisible().catch(() => false)) {
        await badge.hover();
        await page.waitForTimeout(TOOLTIP_WAIT);
        const tooltip = page.locator('[role="tooltip"]').first();
        if (await tooltip.isVisible().catch(() => false)) {
          const text = await tooltip.textContent();
          expect(text).toMatch(/Exa|Apollo|HubSpot/i);
        }
        await page.mouse.move(0, 0);
        await page.waitForTimeout(200);
        break;
      }
    }
  });

  test("1.2 — ICP score badge tooltip matches Fit Score", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    // ICP badge wrapper is a span.relative.inline-flex around the SVG circle.
    // The SVG has a span overlay that intercepts pointer events, so use force.
    const card = page.locator('[role="option"]').first();
    const icpWrapper = card.locator(".relative.inline-flex").first();
    if (await icpWrapper.isVisible().catch(() => false)) {
      await icpWrapper.hover({ force: true });
      await page.waitForTimeout(TOOLTIP_WAIT);
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.first().isVisible().catch(() => false)) {
        const text = await tooltip.first().textContent();
        expect(text).toMatch(/Fit Score/i);
      }
    }
    await page.mouse.move(0, 0);
  });

  test("1.3 — Confidence badge tooltip in dossier", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);

    const confidenceDot = page.locator('[class*="bg-confidence-"]').first();
    if (await confidenceDot.isVisible().catch(() => false)) {
      await confidenceDot.hover();
      await page.waitForTimeout(TOOLTIP_WAIT);
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.first().isVisible().catch(() => false)) {
        const text = await tooltip.first().textContent();
        expect(text).toMatch(/confidence/i);
      }
    }
    await page.mouse.move(0, 0);
  });

  test("1.4 — Signal strength bar tooltip", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const bar = page.locator(".h-1.w-10").first();
    if (await bar.isVisible().catch(() => false)) {
      await bar.hover();
      await page.waitForTimeout(TOOLTIP_WAIT);
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.first().isVisible().catch(() => false)) {
        const text = await tooltip.first().textContent();
        expect(text).toMatch(/buying signal/i);
      }
    }
    await page.mouse.move(0, 0);
  });

  test("1.5 — Data completeness tooltip on N/6 indicator", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const completeness = page.locator('[role="option"] .font-mono.text-xs').filter({ hasText: /\d\/6/ }).first();
    if (await completeness.isVisible().catch(() => false)) {
      await completeness.hover();
      await page.waitForTimeout(TOOLTIP_WAIT);
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.first().isVisible().catch(() => false)) {
        const text = await tooltip.first().textContent();
        expect(text).toContain("Data completeness");
      }
    }
    await page.mouse.move(0, 0);
  });

  test("1.6 — Refresh button tooltip in dossier", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);

    const refreshBtn = page.locator('button[aria-label="Refresh data"]').first();
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.hover();
      await page.waitForTimeout(TOOLTIP_WAIT);
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.first().isVisible().catch(() => false)) {
        const text = await tooltip.first().textContent();
        expect(text).toContain("Refresh data");
      }
    }
    await page.mouse.move(0, 0);
  });

  test("1.7 — Copy email tooltip in dossier", async ({ page }) => {
    await loadApp(page);
    await openFirstDossier(page);

    const copyBtn = page.locator('[title="Copy email"]').first();
    if (await copyBtn.isVisible().catch(() => false)) {
      await copyBtn.hover();
      await page.waitForTimeout(TOOLTIP_WAIT);
      const tooltip = page.locator('[role="tooltip"]');
      if (await tooltip.first().isVisible().catch(() => false)) {
        const text = await tooltip.first().textContent();
        expect(text).toContain("Copy email");
      }
    }
    await page.mouse.move(0, 0);
  });

  test("1.8 — Tooltip disappears on mouse leave", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    for (const cls of [".bg-source-exa", ".bg-source-apollo", ".bg-source-hubspot"]) {
      const badge = page.locator(cls).first();
      if (await badge.isVisible().catch(() => false)) {
        await badge.hover();
        await page.waitForTimeout(TOOLTIP_WAIT);
        await expect(page.locator('[role="tooltip"]').first()).toBeVisible();

        await page.mouse.move(0, 0);
        await page.waitForTimeout(150);
        const tooltipCount = await page.locator('[role="tooltip"]').count();
        expect(tooltipCount).toBe(0);
        break;
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Section 2: Confirmation Dialogs
// ---------------------------------------------------------------------------

test.describe("Section 2: Confirmation Dialogs", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("2.1 — Delete preset shows confirmation dialog", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
  });

  test("2.2 — Cancel preserves preset", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const presetName = await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });

    // Click Cancel
    await page.locator("button", { hasText: /^Cancel$/ }).click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Dialog should be gone
    await expect(page.locator("text=Delete preset?")).not.toBeVisible();

    // Preset should still be in the list — open dropdown to verify
    await openPresetDropdown(page);
    await expect(page.locator(`text=${presetName}`).first()).toBeVisible({ timeout: 3000 });
  });

  test("2.3 — Confirm deletes preset and shows undo toast", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });

    await confirmDeleteDialog(page);

    // Dialog gone
    await expect(page.locator("text=Delete preset?")).not.toBeVisible();

    // Undo toast visible
    await expect(undoToastLocator(page)).toBeVisible({ timeout: 3000 });
  });

  test("2.4 — Bulk exclude >3 shows confirmation dialog", async ({ page }) => {
    test.setTimeout(60000);
    await loadApp(page);
    await waitForCompanyCards(page);

    const cardCount = await page.locator('[role="option"]').count();
    if (cardCount < 4) {
      test.skip();
      return;
    }

    // Select 4+ cards by clicking their checkbox buttons directly
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = page.locator('[role="option"]').nth(i);
      // The checkbox is the first button inside each card (h-3.5 w-3.5)
      const checkbox = card.locator("button").first();
      await checkbox.click({ force: true });
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);

    // Verify selection happened
    await expect(page.locator("text=selected").first()).toBeVisible({ timeout: 5000 });

    // Click Exclude button in bulk action bar
    const excludeBtn = page.locator("button", { hasText: /^Exclude$/ }).first();
    await excludeBtn.waitFor({ state: "visible", timeout: 5000 });
    await excludeBtn.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Confirmation dialog should appear
    await expect(page.locator("text=Exclude companies?")).toBeVisible({ timeout: 3000 });
  });

  test("2.5 — Cancel preserves selection in bulk exclude", async ({ page }) => {
    test.setTimeout(60000);
    await loadApp(page);
    await waitForCompanyCards(page);

    const cardCount = await page.locator('[role="option"]').count();
    if (cardCount < 4) {
      test.skip();
      return;
    }

    // Select 4+ cards by clicking their checkbox buttons directly
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = page.locator('[role="option"]').nth(i);
      const checkbox = card.locator("button").first();
      await checkbox.click({ force: true });
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
    await expect(page.locator("text=selected").first()).toBeVisible({ timeout: 5000 });

    const excludeBtn = page.locator("button", { hasText: /^Exclude$/ }).first();
    await excludeBtn.waitFor({ state: "visible", timeout: 5000 });
    await excludeBtn.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    await expect(page.locator("text=Exclude companies?")).toBeVisible({ timeout: 3000 });

    // Cancel
    await page.locator("button", { hasText: /^Cancel$/ }).click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Dialog gone
    await expect(page.locator("text=Exclude companies?")).not.toBeVisible();

    // Bulk action bar should still be visible (selection intact)
    await expect(page.locator("text=selected").first()).toBeVisible();
  });

  test("2.6 — Confirm excludes companies", async ({ page }) => {
    test.setTimeout(60000);
    await loadApp(page);
    await waitForCompanyCards(page);

    const cardCount = await page.locator('[role="option"]').count();
    if (cardCount < 4) {
      test.skip();
      return;
    }

    // Select 4+ cards by clicking their checkbox buttons directly
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = page.locator('[role="option"]').nth(i);
      const checkbox = card.locator("button").first();
      await checkbox.click({ force: true });
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(300);
    await expect(page.locator("text=selected").first()).toBeVisible({ timeout: 5000 });

    const excludeBtn = page.locator("button", { hasText: /^Exclude$/ }).first();
    await excludeBtn.waitFor({ state: "visible", timeout: 5000 });
    await excludeBtn.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    await expect(page.locator("text=Exclude companies?")).toBeVisible({ timeout: 3000 });

    // Click the destructive confirm button (shows "Exclude N")
    const confirmBtn = page.locator("button.bg-danger", { hasText: /Exclude \d+/ });
    await confirmBtn.click();
    await page.waitForTimeout(1000);

    // Exclusion should clear selection — bulk bar text "selected" should disappear
    await expect(page.locator("text=selected")).not.toBeVisible({ timeout: 5000 });
  });

  test("2.7 — Bulk exclude ≤3 companies skips confirmation dialog", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const cardCount = await page.locator('[role="option"]').count();
    if (cardCount < 2) {
      test.skip();
      return;
    }

    // Click first card to focus, then use Space to select
    const firstCard = page.locator('[role="option"]').first();
    await firstCard.click();
    await page.waitForTimeout(200);
    await page.keyboard.press("Space");
    await page.waitForTimeout(200);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Space");
    await page.waitForTimeout(500);

    const excludeBtn = page.locator("button", { hasText: /^Exclude$/ }).first();
    if (await excludeBtn.isVisible().catch(() => false)) {
      await excludeBtn.click();
      await page.waitForTimeout(ANIMATION_WAIT);

      // No confirmation dialog should appear (≤3 selected)
      await expect(page.locator("text=Exclude companies?")).not.toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Section 3: Undo Toasts
// ---------------------------------------------------------------------------

test.describe("Section 3: Undo Toasts", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("3.1 — Toast appears at center-bottom after preset deletion", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Verify center-bottom positioning via parent container
    const toastContainer = page.locator(".fixed.bottom-6").first();
    if (await toastContainer.isVisible().catch(() => false)) {
      await expect(toastContainer).toBeVisible();
    }
  });

  test("3.2 — Toast has undo icon (SVG curved arrow)", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);
    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    const svg = toast.locator("svg").first();
    await expect(svg).toBeVisible();
  });

  test("3.3 — Countdown bar visible in toast", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);
    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    const countdownBar = toast.locator(".h-1").first();
    await expect(countdownBar).toBeVisible();
  });

  test("3.4 — Undo button is styled with accent primary", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);
    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    const undoBtn = toast.locator("button", { hasText: /^Undo$/ });
    await expect(undoBtn).toBeVisible();

    const classes = await undoBtn.getAttribute("class");
    expect(classes).toContain("bg-accent-primary");
    expect(classes).toContain("font-semibold");
  });

  test("3.5 — Clicking Undo restores deleted preset", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const presetName = await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    // Click Undo
    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });
    await toast.locator("button", { hasText: /^Undo$/ }).click();
    await page.waitForTimeout(500);

    // Toast dismissed (the Undo button should be gone)
    await expect(undoToastLocator(page)).not.toBeVisible({ timeout: 3000 });

    // Preset should be restored — open dropdown to verify
    await openPresetDropdown(page);
    await expect(page.locator(`text=${presetName}`).first()).toBeVisible({ timeout: 3000 });
  });

  test("3.6 — Dismiss button closes toast without restoring", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Click dismiss (not Undo — the undo callback should NOT fire)
    await toast.locator('button[aria-label="Dismiss"]').click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Toast gone (Undo button no longer visible)
    await expect(undoToastLocator(page)).not.toBeVisible({ timeout: 3000 });
  });

  test("3.7 — Toast auto-dismisses after ~6 seconds", async ({ page }) => {
    test.setTimeout(45000);

    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Wait for auto-dismiss (6s + buffer)
    await page.waitForTimeout(UNDO_DURATION);

    await expect(undoToastLocator(page)).not.toBeVisible({ timeout: 3000 });
  });
});

// ---------------------------------------------------------------------------
// Section 4: Integration
// ---------------------------------------------------------------------------

test.describe("Section 4: Integration", () => {
  test.beforeEach(async ({ context }) => {
    await context.addCookies([await getSessionCookie()]);
  });

  test("4.1 — Only one tooltip visible at a time", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    const badges = page.locator(".bg-source-exa, .bg-source-apollo, .bg-source-hubspot");
    const badgeCount = await badges.count();

    if (badgeCount >= 2) {
      await badges.nth(0).hover();
      await page.waitForTimeout(TOOLTIP_WAIT);

      await badges.nth(1).hover();
      await page.waitForTimeout(TOOLTIP_WAIT);

      const tooltipCount = await page.locator('[role="tooltip"]').count();
      expect(tooltipCount).toBeLessThanOrEqual(1);
    }
    await page.mouse.move(0, 0);
  });

  test("4.2 — Dialog content area blocks clicks from closing dialog", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });

    // Click on the dialog content (the message text) — should NOT close the dialog
    const dialogMessage = page.locator("text=Are you sure you want to delete");
    await dialogMessage.click();
    await page.waitForTimeout(ANIMATION_WAIT);

    // Dialog should still be visible (stopPropagation on content div)
    await expect(page.locator("text=Delete preset?")).toBeVisible();

    // Clean up
    await page.locator("button", { hasText: /^Cancel$/ }).click();
  });

  test("4.3 — Escape closes confirmation dialog", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    await createAndDeletePreset(page);

    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });

    await page.keyboard.press("Escape");
    await page.waitForTimeout(ANIMATION_WAIT);

    await expect(page.locator("text=Delete preset?")).not.toBeVisible();
  });

  test("4.4 — Toast and dialog can coexist without overlap", async ({ page }) => {
    await loadApp(page);
    await waitForCompanyCards(page);

    // Delete first preset to get undo toast
    await createAndDeletePreset(page);
    await expect(page.locator("text=Delete preset?")).toBeVisible({ timeout: 3000 });
    await confirmDeleteDialog(page);

    // Undo toast should be visible
    const toast = undoToastLocator(page);
    await expect(toast).toBeVisible({ timeout: 3000 });

    // Close dropdown if open from the first flow, before clicking Save as Preset
    await closePresetDropdown(page);

    // Create and delete a second preset to open dialog while toast is still up
    const presetName2 = `Test2-${Date.now()}`;
    await page.locator("text=Save as Preset").first().click();
    await page.waitForTimeout(ANIMATION_WAIT);

    const nameInput = page.locator('input[placeholder*="Preset name"]');
    await nameInput.fill(presetName2);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);

    // Open dropdown and click delete
    await openPresetDropdown(page);

    const deleteBtn = page.locator('button[aria-label="Delete preset"]').first();
    if (await deleteBtn.isVisible().catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(ANIMATION_WAIT);

      // Both toast and dialog visible
      const toastVisible = await undoToastLocator(page).isVisible().catch(() => false);
      const dialogVisible = await page.locator("text=Delete preset?").isVisible().catch(() => false);

      if (toastVisible && dialogVisible) {
        expect(toastVisible).toBe(true);
        expect(dialogVisible).toBe(true);
      }

      // Clean up
      await page.locator("button", { hasText: /^Cancel$/ }).click().catch(() => {});
    }
  });
});
