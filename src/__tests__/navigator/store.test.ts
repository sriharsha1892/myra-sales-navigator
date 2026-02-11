import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { useStore } from "@/lib/navigator/store";
import { mockCompaniesEnriched, mockContactsCache } from "@/lib/navigator/mock-data";

// Helper to reset store between tests
function resetStore() {
  useStore.setState({
    companies: mockCompaniesEnriched,
    contactsByDomain: { ...mockContactsCache },
    toasts: [],
    selectedCompanyDomain: null,
    selectedContactIds: new Set(),
    selectedCompanyDomains: new Set(),
    slideOverOpen: false,
    recentDomains: [],
    userName: null,
    isAdmin: false,
    filters: {
      sources: [],
      verticals: [],
      regions: [],
      sizes: [],
      signals: [],
      statuses: [],
      hideExcluded: true,
      quickFilters: [],
    },
    sortField: "icp_score",
    sortDirection: "desc",
    searchResults: null,
    notesByDomain: {},
    presets: [],
    excludingDomains: new Set(),
  });
}

// ─────────────────────────────────────────────────────────
// filteredCompanies
// ─────────────────────────────────────────────────────────
describe("filteredCompanies", () => {
  beforeEach(resetStore);

  it("default filters return all non-excluded companies", () => {
    const result = useStore.getState().filteredCompanies();
    const excluded = mockCompaniesEnriched.filter((c) => c.excluded);
    expect(result.length).toBe(mockCompaniesEnriched.length - excluded.length);
  });

  it("hideExcluded: false includes excluded companies", () => {
    // Exclude one company first
    useStore.getState().excludeCompany("ingredion.com");
    useStore.getState().setFilters({ hideExcluded: false });
    const result = useStore.getState().filteredCompanies();
    expect(result.some((c) => c.domain === "ingredion.com")).toBe(true);
  });

  it("hideExcluded: true filters excluded", () => {
    useStore.getState().excludeCompany("ingredion.com");
    const result = useStore.getState().filteredCompanies();
    expect(result.some((c) => c.domain === "ingredion.com")).toBe(false);
  });

  it("source filter — exa only", () => {
    useStore.getState().setFilters({ sources: ["exa"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.sources).toContain("exa");
    }
  });

  it("vertical filter", () => {
    useStore.getState().setFilters({ verticals: ["Food Ingredients"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.vertical).toBe("Food Ingredients");
    }
    expect(result.length).toBeGreaterThan(0);
  });

  it("region filter", () => {
    useStore.getState().setFilters({ regions: ["Europe"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.region).toBe("Europe");
    }
    expect(result.length).toBeGreaterThan(0);
  });

  it("size filter — 1-50", () => {
    useStore.getState().setFilters({ sizes: ["1-50"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.employeeCount).toBeGreaterThanOrEqual(1);
      expect(c.employeeCount).toBeLessThanOrEqual(50);
    }
  });

  it("size filter — 51-200", () => {
    useStore.getState().setFilters({ sizes: ["51-200"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.employeeCount).toBeGreaterThanOrEqual(51);
      expect(c.employeeCount).toBeLessThanOrEqual(200);
    }
  });

  it("size filter — 1000+", () => {
    useStore.getState().setFilters({ sizes: ["1000+"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.employeeCount).toBeGreaterThan(1000);
    }
    expect(result.length).toBeGreaterThan(0);
  });

  it("signal filter — hiring", () => {
    useStore.getState().setFilters({ signals: ["hiring"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.signals.some((s) => s.type === "hiring")).toBe(true);
    }
  });

  it("quick filter — high_icp (>= 80)", () => {
    useStore.getState().setFilters({ quickFilters: ["high_icp"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.icpScore).toBeGreaterThanOrEqual(80);
    }
    expect(result.length).toBeGreaterThan(0);
  });

  it("quick filter — has_signals", () => {
    useStore.getState().setFilters({ quickFilters: ["has_signals"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.signals.length).toBeGreaterThan(0);
    }
  });

  it("quick filter — not_in_hubspot", () => {
    useStore.getState().setFilters({ quickFilters: ["not_in_hubspot"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.hubspotStatus).toBe("none");
    }
  });

  it("multiple quick filters combined", () => {
    useStore.getState().setFilters({ quickFilters: ["high_icp", "has_signals"] });
    const result = useStore.getState().filteredCompanies();
    for (const c of result) {
      expect(c.icpScore).toBeGreaterThanOrEqual(80);
      expect(c.signals.length).toBeGreaterThan(0);
    }
  });

  it("sort by icp_score desc (default)", () => {
    const result = useStore.getState().filteredCompanies();
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].icpScore).toBeGreaterThanOrEqual(result[i].icpScore);
    }
  });

  it("sort by icp_score asc", () => {
    useStore.setState({ sortDirection: "asc" });
    const result = useStore.getState().filteredCompanies();
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].icpScore).toBeLessThanOrEqual(result[i].icpScore);
    }
  });

  it("sort by name asc", () => {
    useStore.setState({ sortField: "name", sortDirection: "asc" });
    const result = useStore.getState().filteredCompanies();
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].name.localeCompare(result[i].name)).toBeLessThanOrEqual(0);
    }
  });

  it("sort by employee_count desc", () => {
    useStore.setState({ sortField: "employee_count", sortDirection: "desc" });
    const result = useStore.getState().filteredCompanies();
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].employeeCount).toBeGreaterThanOrEqual(result[i].employeeCount);
    }
  });
});

// ─────────────────────────────────────────────────────────
// Toast system
// ─────────────────────────────────────────────────────────
describe("toast system", () => {
  beforeEach(resetStore);

  it("addToast creates a toast", () => {
    useStore.getState().addToast({ message: "Hello", type: "info" });
    expect(useStore.getState().toasts).toHaveLength(1);
    expect(useStore.getState().toasts[0].message).toBe("Hello");
  });

  it("addToast with dedupKey increments count on duplicate", () => {
    useStore.getState().addToast({ message: "Dup", type: "info", dedupKey: "dk1" });
    useStore.getState().addToast({ message: "Dup", type: "info", dedupKey: "dk1" });
    const toasts = useStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0].count).toBe(2);
  });

  it("addToast without dedupKey creates separate toasts", () => {
    useStore.getState().addToast({ message: "A", type: "info" });
    useStore.getState().addToast({ message: "B", type: "info" });
    expect(useStore.getState().toasts).toHaveLength(2);
  });

  it("dismissToast transitions to exiting", () => {
    const id = useStore.getState().addToast({ message: "Test", type: "info", duration: 0 });
    useStore.getState().dismissToast(id);
    const toast = useStore.getState().toasts.find((t) => t.id === id);
    expect(toast?.phase).toBe("exiting");
  });

  it("addUndoToast creates toast with undoDeadline and undoAction", () => {
    const undoFn = vi.fn();
    const id = useStore.getState().addUndoToast("Undo me", undoFn, 5000);
    const toast = useStore.getState().toasts.find((t) => t.id === id);
    expect(toast).toBeDefined();
    expect(toast!.variant).toBe("undo");
    expect(toast!.undoDeadline).toBeDefined();
    expect(toast!.undoAction).toBe(undoFn);
  });
});

// ─────────────────────────────────────────────────────────
// Selection
// ─────────────────────────────────────────────────────────
describe("selection", () => {
  beforeEach(resetStore);

  it("selectCompany sets domain and opens slideOver", () => {
    useStore.getState().selectCompany("ingredion.com");
    expect(useStore.getState().selectedCompanyDomain).toBe("ingredion.com");
    expect(useStore.getState().slideOverOpen).toBe(true);
  });

  it("selectCompany(null) clears selection and closes slideOver", () => {
    useStore.getState().selectCompany("ingredion.com");
    useStore.getState().selectCompany(null);
    expect(useStore.getState().selectedCompanyDomain).toBeNull();
    expect(useStore.getState().slideOverOpen).toBe(false);
  });

  it("selectCompany adds to recents (max 10)", () => {
    useStore.getState().selectCompany("ingredion.com");
    useStore.getState().selectCompany("basf.com");
    expect(useStore.getState().recentDomains[0]).toBe("basf.com");
    expect(useStore.getState().recentDomains[1]).toBe("ingredion.com");
  });

  it("selectCompany same domain twice dedupes in recents", () => {
    useStore.getState().selectCompany("ingredion.com");
    useStore.getState().selectCompany("basf.com");
    useStore.getState().selectCompany("ingredion.com");
    const recents = useStore.getState().recentDomains;
    expect(recents.filter((r) => r === "ingredion.com")).toHaveLength(1);
    expect(recents[0]).toBe("ingredion.com");
  });

  it("recents max 10", () => {
    const domains = Array.from({ length: 12 }, (_, i) => `domain${i}.com`);
    for (const d of domains) {
      useStore.getState().selectCompany(d);
    }
    expect(useStore.getState().recentDomains).toHaveLength(10);
  });

  it("toggleContactSelection adds and removes", () => {
    useStore.getState().toggleContactSelection("ct1");
    expect(useStore.getState().selectedContactIds.has("ct1")).toBe(true);
    useStore.getState().toggleContactSelection("ct1");
    expect(useStore.getState().selectedContactIds.has("ct1")).toBe(false);
  });

  it("toggleCompanySelection adds and removes", () => {
    useStore.getState().toggleCompanySelection("ingredion.com");
    expect(useStore.getState().selectedCompanyDomains.has("ingredion.com")).toBe(true);
    useStore.getState().toggleCompanySelection("ingredion.com");
    expect(useStore.getState().selectedCompanyDomains.has("ingredion.com")).toBe(false);
  });

  it("selectAllContacts selects all contacts for current company", () => {
    useStore.getState().selectCompany("ingredion.com");
    useStore.getState().selectAllContacts();
    const selected = useStore.getState().selectedContactIds;
    const contacts = useStore.getState().contactsByDomain["ingredion.com"] ?? [];
    expect(selected.size).toBe(contacts.length);
    for (const c of contacts) {
      expect(selected.has(c.id)).toBe(true);
    }
  });

  it("deselectAllContacts clears selection", () => {
    useStore.getState().selectCompany("ingredion.com");
    useStore.getState().selectAllContacts();
    useStore.getState().deselectAllContacts();
    expect(useStore.getState().selectedContactIds.size).toBe(0);
  });

  it("selectAllCompanies selects all filtered companies", () => {
    useStore.getState().selectAllCompanies();
    const filtered = useStore.getState().filteredCompanies();
    expect(useStore.getState().selectedCompanyDomains.size).toBe(filtered.length);
  });

  it("deselectAllCompanies clears company selection", () => {
    useStore.getState().selectAllCompanies();
    useStore.getState().deselectAllCompanies();
    expect(useStore.getState().selectedCompanyDomains.size).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// Notes
// ─────────────────────────────────────────────────────────
describe("notes", () => {
  beforeEach(() => {
    resetStore();
    useStore.getState().setUserName("Adi");
  });

  it("addNote adds to notesByDomain", () => {
    useStore.getState().addNote("ingredion.com", "Great company");
    const notes = useStore.getState().companyNotes("ingredion.com");
    expect(notes).toHaveLength(1);
    expect(notes[0].content).toBe("Great company");
    expect(notes[0].authorName).toBe("Adi");
  });

  it("editNote updates content when authorName matches", () => {
    useStore.getState().addNote("ingredion.com", "Original");
    const noteId = useStore.getState().companyNotes("ingredion.com")[0].id;
    useStore.getState().editNote(noteId, "ingredion.com", "Updated");
    expect(useStore.getState().companyNotes("ingredion.com")[0].content).toBe("Updated");
  });

  it("editNote does nothing when authorName doesn't match", () => {
    useStore.getState().addNote("ingredion.com", "Original");
    const noteId = useStore.getState().companyNotes("ingredion.com")[0].id;
    useStore.getState().setUserName("Satish");
    useStore.getState().editNote(noteId, "ingredion.com", "Hacked!");
    expect(useStore.getState().companyNotes("ingredion.com")[0].content).toBe("Original");
  });

  it("deleteNote removes when authorName matches", () => {
    useStore.getState().addNote("ingredion.com", "Delete me");
    const noteId = useStore.getState().companyNotes("ingredion.com")[0].id;
    useStore.getState().deleteNote(noteId, "ingredion.com");
    expect(useStore.getState().companyNotes("ingredion.com")).toHaveLength(0);
  });

  it("deleteNote does nothing when authorName doesn't match", () => {
    useStore.getState().addNote("ingredion.com", "Protected");
    const noteId = useStore.getState().companyNotes("ingredion.com")[0].id;
    useStore.getState().setUserName("Satish");
    useStore.getState().deleteNote(noteId, "ingredion.com");
    expect(useStore.getState().companyNotes("ingredion.com")).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────────────────
// Presets
// ─────────────────────────────────────────────────────────
describe("presets", () => {
  beforeEach(() => {
    resetStore();
    useStore.getState().setUserName("Adi");
  });

  it("savePreset adds to presets array", () => {
    useStore.getState().setFilters({ verticals: ["Pharma"] });
    useStore.getState().savePreset("Pharma Filter");
    const presets = useStore.getState().presets;
    expect(presets).toHaveLength(1);
    expect(presets[0].name).toBe("Pharma Filter");
    expect(presets[0].filters.verticals).toEqual(["Pharma"]);
  });

  it("loadPreset applies filters", () => {
    useStore.getState().setFilters({ verticals: ["Pharma"] });
    useStore.getState().savePreset("Test");
    const presetId = useStore.getState().presets[0].id;

    // Reset filters
    useStore.getState().resetFilters();
    expect(useStore.getState().filters.verticals).toEqual([]);

    // Load preset
    useStore.getState().loadPreset(presetId);
    expect(useStore.getState().filters.verticals).toEqual(["Pharma"]);
  });

  it("loadPreset with invalid ID does nothing", () => {
    useStore.getState().setFilters({ verticals: ["Chemicals"] });
    useStore.getState().loadPreset("nonexistent");
    expect(useStore.getState().filters.verticals).toEqual(["Chemicals"]);
  });

  it("deletePreset removes from array", () => {
    useStore.getState().savePreset("Delete me");
    const presetId = useStore.getState().presets[0].id;
    useStore.getState().deletePreset(presetId);
    expect(useStore.getState().presets).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// Exclusions
// ─────────────────────────────────────────────────────────
describe("exclusions", () => {
  beforeEach(resetStore);

  it("excludeCompany sets excluded flag", () => {
    useStore.getState().excludeCompany("ingredion.com");
    const company = useStore.getState().companies.find((c) => c.domain === "ingredion.com");
    expect(company?.excluded).toBe(true);
  });

  it("undoExclude clears excluded flag", async () => {
    useStore.getState().excludeCompany("ingredion.com");
    // Wait for excludeCompany fetch to settle so excludingDomains guard clears
    await new Promise((r) => setTimeout(r, 0));
    useStore.getState().undoExclude("ingredion.com");
    const company = useStore.getState().companies.find((c) => c.domain === "ingredion.com");
    expect(company?.excluded).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────
// Filters
// ─────────────────────────────────────────────────────────
describe("filters", () => {
  beforeEach(resetStore);

  it("setFilters does partial merge", () => {
    useStore.getState().setFilters({ verticals: ["Pharma"] });
    expect(useStore.getState().filters.verticals).toEqual(["Pharma"]);
    expect(useStore.getState().filters.sources).toEqual([]); // unchanged
  });

  it("resetFilters returns to defaults", () => {
    useStore.getState().setFilters({ verticals: ["Pharma"], regions: ["Europe"] });
    useStore.getState().resetFilters();
    expect(useStore.getState().filters.verticals).toEqual([]);
    expect(useStore.getState().filters.regions).toEqual(["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"]);
    expect(useStore.getState().filters.hideExcluded).toBe(true);
  });

  it("toggleQuickFilter adds filter", () => {
    useStore.getState().toggleQuickFilter("high_icp");
    expect(useStore.getState().filters.quickFilters).toContain("high_icp");
  });

  it("toggleQuickFilter removes on second call", () => {
    useStore.getState().toggleQuickFilter("high_icp");
    useStore.getState().toggleQuickFilter("high_icp");
    expect(useStore.getState().filters.quickFilters).not.toContain("high_icp");
  });
});
