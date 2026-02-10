import { create } from "zustand";
import type {
  CompanyEnriched,
  Contact,
  Exclusion,
  SearchPreset,
  AdminConfig,
  CompanyNote,
  ContactTabFilters,
  FilterState,
  ViewMode,
  SortField,
  SortDirection,
  ToastMessage,
  ToastType,
  QuickFilter,
  ResultSource,
  SizeBucket,
  SignalType,
  ContactSnapshot,
  ProgressToastHandle,
  ExportFlowState,
  ExtractedEntities,
  OutreachSequence,
  OutreachEnrollment,
  UserConfig,
  TriageDecision,
  TriageFilter,
  RelevanceFeedback,
  RelevanceFeedbackReason,
  SearchErrorDetail,
} from "./types";
import { DEFAULT_PIPELINE_STAGES } from "./types";
import {
  defaultAdminConfig,
} from "./mock-data";
import { getSizeBucket } from "../utils";

interface AppState {
  // Data
  companies: CompanyEnriched[];
  contactsByDomain: Record<string, Contact[]>;
  exclusions: Exclusion[];
  presets: SearchPreset[];
  adminConfig: AdminConfig;
  notesByDomain: Record<string, CompanyNote[]>;

  // Search results (from API)
  searchResults: CompanyEnriched[] | null;
  searchError: string | null;
  searchErrors: SearchErrorDetail[];
  searchWarnings: string[];
  lastSearchParams: { freeText?: string; filters?: FilterState } | null;

  // UI State
  viewMode: ViewMode;
  selectedCompanyDomain: string | null;
  selectedContactIds: Set<string>;
  selectedCompanyDomains: Set<string>;
  sortField: SortField;
  sortDirection: SortDirection;
  commandPaletteOpen: boolean;
  toasts: ToastMessage[];

  // Filters
  filters: FilterState;

  // Slide-over
  slideOverOpen: boolean;
  slideOverMode: "dossier" | "contacts";

  // Auth
  userName: string | null;
  isAdmin: boolean;

  // Recent companies
  recentDomains: string[];

  // Export
  userCopyFormat: string;
  exportState: ExportFlowState | null;
  triggerExport: "csv" | "clipboard" | "excel" | null;
  triggerExpressExport: boolean;
  setTriggerExpressExport: (v: boolean) => void;

  // Cmd+K free-text search
  pendingFreeTextSearch: string | null;

  // Filter-based search trigger
  pendingFilterSearch: boolean;

  // Search loading state
  searchLoading: boolean;

  // Last search query (for match evidence highlighting)
  lastSearchQuery: string | null;

  // Extracted entities from NL search (for editable chips)
  extractedEntities: ExtractedEntities | null;

  // NL ICP criteria from last search (for display banner)
  lastICPCriteria: import("@/lib/navigator/types").NLICPCriteria | null;
  setLastICPCriteria: (criteria: import("@/lib/navigator/types").NLICPCriteria | null) => void;

  // Count of companies excluded by exclusion list in last search
  lastExcludedCount: number;
  setLastExcludedCount: (count: number) => void;

  // Inline contacts expansion (accordion below company card)
  expandedContactsDomain: string | null;
  setExpandedContactsDomain: (domain: string | null) => void;

  // Result grouping & detail pane
  resultGrouping: "icp_tier" | "source" | "none";
  detailPaneCollapsed: boolean;

  // Dossier scroll-to-top signal (incrementing counter)
  dossierScrollToTop: number;
  triggerDossierScrollToTop: () => void;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  selectCompany: (domain: string | null) => void;
  toggleContactSelection: (id: string) => void;
  toggleCompanySelection: (domain: string) => void;
  selectAllContacts: () => void;
  deselectAllContacts: () => void;
  selectAllCompanies: () => void;
  deselectAllCompanies: () => void;
  setSortField: (field: SortField) => void;
  setSortDirection: (dir: SortDirection) => void;
  setFilters: (filters: Partial<FilterState>) => void;
  resetFilters: () => void;
  toggleQuickFilter: (filter: QuickFilter) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  addToast: (toast: { message: string; type: ToastType; action?: { label: string; onClick: () => void }; duration?: number; dedupKey?: string }) => string;
  dismissToast: (id: string) => void;
  removeToast: (id: string) => void;
  addProgressToast: (loadingMessage: string) => ProgressToastHandle;
  addUndoToast: (message: string, undoAction: () => void, duration?: number) => string;
  excludeCompany: (domain: string) => void;
  undoExclude: (domain: string) => void;
  setSlideOverOpen: (open: boolean) => void;
  setSlideOverMode: (mode: "dossier" | "contacts") => void;
  openContacts: (domain: string) => void;
  setUserName: (name: string | null, admin?: boolean) => void;
  addNote: (domain: string, content: string, mentions?: string[]) => void;
  editNote: (noteId: string, domain: string, content: string, mentions?: string[]) => void;
  deleteNote: (noteId: string, domain: string) => void;
  logExtraction: (domain: string, destination: string, contacts: ContactSnapshot[]) => void;
  updateAdminConfig: (config: Partial<AdminConfig>) => void;
  setAdminConfig: (config: AdminConfig) => void;
  saveAdminConfig: () => Promise<void>;
  loadPreset: (presetId: string) => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;
  clearPresetNotification: (id: string) => void;
  setSearchResults: (companies: CompanyEnriched[] | null) => void;
  setSearchError: (error: string | null) => void;
  setSearchErrors: (errors: SearchErrorDetail[]) => void;
  setSearchWarnings: (warnings: string[]) => void;
  setLastSearchParams: (params: { freeText?: string; filters?: FilterState } | null) => void;
  retryLastSearch: () => void;
  setUserCopyFormat: (formatId: string) => void;
  setExportState: (s: ExportFlowState | null) => void;
  setTriggerExport: (v: "csv" | "clipboard" | "excel" | null) => void;
  setPendingFreeTextSearch: (text: string | null) => void;
  setPendingFilterSearch: (pending: boolean) => void;
  setLastSearchQuery: (query: string | null) => void;
  setExtractedEntities: (entities: ExtractedEntities | null) => void;
  setSearchLoading: (loading: boolean) => void;
  setResultGrouping: (g: "icp_tier" | "source" | "none") => void;
  toggleDetailPane: () => void;
  setExclusions: (exclusions: Exclusion[]) => void;
  setPresets: (presets: SearchPreset[]) => void;
  fetchPresets: () => void;
  updateContact: (domain: string, contactId: string, updated: Contact) => void;
  setContactsForDomain: (domain: string, contacts: Contact[]) => void;
  searchSimilar: (company: CompanyEnriched) => void;
  setCompanyStatus: (domain: string, status: string, userName: string) => void;

  // Session counters
  sessionCompaniesReviewed: number;
  sessionContactsExported: number;
  incrementSessionExported: (count: number) => void;

  // Contact tab state
  contactFilters: ContactTabFilters;
  setContactFilters: (filters: Partial<ContactTabFilters>) => void;
  contactVisibleFields: Set<string>;
  setContactVisibleFields: (fields: Set<string>) => void;
  contactGroupsCollapsed: Record<string, boolean>;
  toggleContactGroupCollapsed: (domain: string) => void;
  collapseAllContactGroups: () => void;
  expandAllContactGroups: () => void;
  excludeContact: (value: string, type?: "email" | "contact_id") => void;
  focusedContactId: string | null;
  setFocusedContactId: (id: string | null) => void;

  // Outreach session state
  writingRulesSession: string;
  setWritingRules: (rules: string) => void;

  // All contacts view (flat list across all companies)
  allContactsViewActive: boolean;
  setAllContactsViewActive: (active: boolean) => void;

  // Outreach sequences
  activeSequences: OutreachSequence[];
  setActiveSequences: (sequences: OutreachSequence[]) => void;
  activeEnrollments: OutreachEnrollment[];
  setActiveEnrollments: (enrollments: OutreachEnrollment[]) => void;
  userConfig: UserConfig | null;
  setUserConfig: (config: UserConfig | null) => void;
  selectedContactsForOutreach: Set<string>;
  toggleOutreachContact: (contactId: string) => void;
  clearOutreachContacts: () => void;

  // Company triage decisions
  companyDecisions: Record<string, TriageDecision>;
  triageFilter: TriageFilter;
  setCompanyDecision: (domain: string, decision: TriageDecision) => void;
  setTriageFilter: (filter: TriageFilter) => void;

  // Scroll-to-contact (set when user clicks inline contact on card)
  scrollToContactId: string | null;
  setScrollToContactId: (id: string | null) => void;

  // Relevance feedback
  relevanceFeedback: Record<string, { feedback: RelevanceFeedback; reason?: RelevanceFeedbackReason }>;
  setRelevanceFeedback: (domain: string, feedback: RelevanceFeedback, reason?: RelevanceFeedbackReason) => void;
  clearRelevanceFeedback: (domain: string) => void;
  showHiddenResults: boolean;
  setShowHiddenResults: (show: boolean) => void;

  // Similar results (from "find similar" on relevant feedback)
  similarResults: { seedDomain: string; seedName: string; companies: CompanyEnriched[] } | null;
  setSimilarResults: (r: { seedDomain: string; seedName: string; companies: CompanyEnriched[] } | null) => void;
  similarLoading: boolean;
  setSimilarLoading: (l: boolean) => void;

  // CRM enrichment (batch post-search)
  updateCompanyCrmStatus: (domain: string, freshsalesStatus: string, freshsalesIntel: unknown, hubspotStatus: string) => void;

  // Persistent prospect list
  prospectList: Set<string>;
  addToProspectList: (domain: string) => void;
  removeFromProspectList: (domain: string) => void;
  clearProspectList: () => void;

  // Active result index for arrow key navigation
  activeResultIndex: number | null;
  setActiveResultIndex: (index: number | null) => void;

  // Session activity counters (for heartbeat deltas)
  sessionSearchCount: number;
  sessionTriageCount: number;
  incrementSessionSearchCount: () => void;

  // Follow-up nudges
  followUpNudgesDismissed: boolean;
  dismissFollowUpNudges: () => void;

  // Team awareness
  similarSearchMatch: { user: string; query: string; at: string; resultCount: number } | null;
  dismissedSimilarSearchId: string | null;
  setSimilarSearchMatch: (match: { user: string; query: string; at: string; resultCount: number } | null) => void;
  dismissSimilarSearch: () => void;
  mergeTeamActivity: (data: Record<string, { viewers: { user: string; at: string }[]; exporters: { user: string; at: string; count: number }[]; decisions: { user: string; decision: string; at: string }[] }>) => void;

  // Demo mode
  demoMode: boolean;
  setDemoMode: (on: boolean) => void;

  // Computed / derived
  filteredCompanies: () => CompanyEnriched[];
  selectedCompany: () => CompanyEnriched | null;
  companyContacts: (domain: string) => Contact[];
  companyNotes: (domain: string) => CompanyNote[];
}

const defaultFilters: FilterState = {
  sources: ["exa", "apollo", "hubspot", "freshsales"],
  verticals: [],  // keep empty — Exa results have vertical:"", selecting all would filter them out
  regions: ["North America", "Europe", "Asia Pacific", "Latin America", "Middle East & Africa"],
  sizes: ["1-50", "51-200", "201-1000", "1000+"],
  signals: ["hiring", "funding", "expansion", "news"],
  statuses: [],
  hideExcluded: true,
  quickFilters: [],
};

import { pick } from "./ui-copy";

let toastCounter = 0;
const sessionViewedDomains = new Set<string>();

// Load persisted triage decisions from localStorage
function loadDecisions(): Record<string, TriageDecision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("nav_company_decisions");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// Load persisted relevance feedback from localStorage
function loadRelevanceFeedback(): Record<string, { feedback: RelevanceFeedback; reason?: RelevanceFeedbackReason }> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem("nav_relevance_feedback");
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// Load persisted demo mode from localStorage (default true)
function loadDemoMode(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem("nav_demo_mode");
    return raw === null ? true : raw === "1";
  } catch { return true; }
}

// Load persisted prospect list from localStorage
function loadProspectList(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("nav_prospect_list");
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

// Module-level toast timer management
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleToastDismiss(id: string, duration: number, get: () => AppState) {
  clearToastTimer(id);
  const timer = setTimeout(() => {
    get().dismissToast(id);
  }, duration);
  toastTimers.set(id, timer);
}

function clearToastTimer(id: string) {
  const existing = toastTimers.get(id);
  if (existing) {
    clearTimeout(existing);
    toastTimers.delete(id);
  }
}

export const useStore = create<AppState>((set, get) => ({
  companies: [],
  contactsByDomain: {},
  exclusions: [],
  presets: [],
  adminConfig: defaultAdminConfig,
  notesByDomain: {},

  searchResults: null,
  searchError: null,
  searchErrors: [],
  searchWarnings: [],
  lastSearchParams: null,

  viewMode: "companies",
  selectedCompanyDomain: null,
  selectedContactIds: new Set<string>(),
  selectedCompanyDomains: new Set<string>(),
  sortField: "icp_score",
  sortDirection: "desc",
  commandPaletteOpen: false,
  toasts: [],

  filters: defaultFilters,

  slideOverOpen: false,
  slideOverMode: "dossier",

  userName: null,
  isAdmin: false,

  recentDomains: [],

  userCopyFormat: "name_email",
  exportState: null,
  triggerExport: null,
  triggerExpressExport: false,
  setTriggerExpressExport: (v) => set({ triggerExpressExport: v }),
  pendingFreeTextSearch: null,
  pendingFilterSearch: false,
  searchLoading: false,
  lastSearchQuery: null,
  extractedEntities: null,
  lastICPCriteria: null,
  setLastICPCriteria: (criteria) => set({ lastICPCriteria: criteria }),
  lastExcludedCount: 0,
  setLastExcludedCount: (count) => set({ lastExcludedCount: count }),
  expandedContactsDomain: null,
  setExpandedContactsDomain: (domain) => set((state) => ({
    expandedContactsDomain: state.expandedContactsDomain === domain ? null : domain,
  })),
  resultGrouping: "icp_tier",
  detailPaneCollapsed: typeof window !== "undefined" && localStorage.getItem("nav_detail_pane_collapsed") === "1",
  dossierScrollToTop: 0,
  triggerDossierScrollToTop: () => set((state) => ({ dossierScrollToTop: state.dossierScrollToTop + 1 })),
  sessionCompaniesReviewed: 0,
  sessionContactsExported: 0,

  // Contact tab state
  contactFilters: {
    seniority: [],
    hasEmail: false,
    sources: [],
    sortBy: "seniority",
  },
  contactVisibleFields: new Set(["name", "email", "title", "seniority", "sources", "lastContacted"]),
  contactGroupsCollapsed: {},
  focusedContactId: null,

  // Outreach session state
  writingRulesSession: "",
  setWritingRules: (rules) => set({ writingRulesSession: rules }),

  // All contacts view
  allContactsViewActive: false,
  setAllContactsViewActive: (active) => set({ allContactsViewActive: active }),

  // Outreach sequences
  activeSequences: [],
  setActiveSequences: (sequences) => set({ activeSequences: sequences }),
  activeEnrollments: [],
  setActiveEnrollments: (enrollments) => set({ activeEnrollments: enrollments }),
  userConfig: null,
  setUserConfig: (config) => set({ userConfig: config }),
  selectedContactsForOutreach: new Set(),
  toggleOutreachContact: (contactId) => set((state) => {
    const next = new Set(state.selectedContactsForOutreach);
    if (next.has(contactId)) next.delete(contactId); else next.add(contactId);
    return { selectedContactsForOutreach: next };
  }),
  clearOutreachContacts: () => set({ selectedContactsForOutreach: new Set() }),

  // Company triage decisions
  companyDecisions: loadDecisions(),
  triageFilter: "all",
  setCompanyDecision: (domain, decision) => {
    const current = get().companyDecisions[domain];
    // Toggle off: clicking the same decision again clears it
    const next = { ...get().companyDecisions };
    if (current === decision) {
      delete next[domain];
    } else {
      next[domain] = decision;
    }
    set({ companyDecisions: next, sessionTriageCount: get().sessionTriageCount + 1 });
    // Persist to localStorage
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_company_decisions", JSON.stringify(next));
    }
    // Fire-and-forget to Supabase
    const userName = get().userName ?? "Unknown";
    fetch("/api/company-decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, decision: current === decision ? null : decision, decidedBy: userName }),
    }).catch(() => { /* silent */ });
  },
  setTriageFilter: (filter) => set({ triageFilter: filter }),

  // Scroll-to-contact
  scrollToContactId: null,
  setScrollToContactId: (id) => set({ scrollToContactId: id }),

  // Relevance feedback
  relevanceFeedback: loadRelevanceFeedback(),
  setRelevanceFeedback: (domain, feedback, reason) => {
    const next = { ...get().relevanceFeedback, [domain]: { feedback, reason } };
    set({ relevanceFeedback: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_relevance_feedback", JSON.stringify(next));
    }
    // Fire-and-forget to Supabase
    const userName = get().userName ?? "Unknown";
    const searchQuery = get().lastSearchQuery ?? undefined;
    const company = (get().searchResults ?? get().companies).find((c) => c.domain === domain);
    fetch("/api/relevance-feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        domain,
        feedback,
        reason,
        userName,
        searchQuery,
        companyIndustry: company?.industry,
        companyRegion: company?.region,
        companySizeBucket: company?.employeeCount ? getSizeBucket(company.employeeCount) : undefined,
        icpScore: company?.icpScore,
      }),
    }).catch(() => { /* silent */ });
  },
  clearRelevanceFeedback: (domain) => {
    const next = { ...get().relevanceFeedback };
    delete next[domain];
    set({ relevanceFeedback: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_relevance_feedback", JSON.stringify(next));
    }
    fetch("/api/relevance-feedback", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    }).catch(() => { /* silent */ });
  },
  showHiddenResults: false,
  setShowHiddenResults: (show) => set({ showHiddenResults: show }),

  // Similar results
  similarResults: null,
  setSimilarResults: (r) => set({ similarResults: r }),
  similarLoading: false,
  setSimilarLoading: (l) => set({ similarLoading: l }),

  // CRM enrichment
  updateCompanyCrmStatus: (domain, freshsalesStatus, freshsalesIntel, hubspotStatus) => {
    const updateFn = (c: CompanyEnriched) =>
      c.domain === domain
        ? { ...c, freshsalesStatus: freshsalesStatus as CompanyEnriched["freshsalesStatus"], freshsalesIntel: freshsalesIntel as CompanyEnriched["freshsalesIntel"], hubspotStatus: hubspotStatus as CompanyEnriched["hubspotStatus"] }
        : c;
    set((state) => ({
      companies: state.companies.map(updateFn),
      searchResults: state.searchResults?.map(updateFn) ?? null,
    }));
  },

  // Persistent prospect list
  prospectList: loadProspectList(),
  addToProspectList: (domain) => {
    const next = new Set(get().prospectList);
    next.add(domain);
    set({ prospectList: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_prospect_list", JSON.stringify([...next]));
    }
    const userName = get().userName ?? "Unknown";
    fetch("/api/prospect-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, addedBy: userName }),
    }).catch(() => { /* silent */ });
  },
  removeFromProspectList: (domain) => {
    const next = new Set(get().prospectList);
    next.delete(domain);
    set({ prospectList: next });
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_prospect_list", JSON.stringify([...next]));
    }
    fetch("/api/prospect-list", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain }),
    }).catch(() => { /* silent */ });
  },
  clearProspectList: () => {
    set({ prospectList: new Set() });
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_prospect_list", JSON.stringify([]));
    }
  },

  // Active result index for arrow key navigation
  activeResultIndex: null,
  setActiveResultIndex: (index) => set({ activeResultIndex: index }),

  // Session activity counters
  sessionSearchCount: 0,
  sessionTriageCount: 0,
  incrementSessionSearchCount: () => set((state) => ({ sessionSearchCount: state.sessionSearchCount + 1 })),

  // Demo mode
  demoMode: loadDemoMode(),
  setDemoMode: (on) => {
    set({ demoMode: on });
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_demo_mode", on ? "1" : "0");
    }
  },

  // Follow-up nudges
  followUpNudgesDismissed: false,
  dismissFollowUpNudges: () => set({ followUpNudgesDismissed: true }),

  // Team awareness
  similarSearchMatch: null,
  dismissedSimilarSearchId: null,
  setSimilarSearchMatch: (match) => set({ similarSearchMatch: match }),
  dismissSimilarSearch: () => set((state) => ({
    dismissedSimilarSearchId: state.similarSearchMatch ? "dismissed" : null,
    similarSearchMatch: null,
  })),
  mergeTeamActivity: (data) => {
    const updateFn = (c: CompanyEnriched) => {
      const activity = data[c.domain];
      return activity ? { ...c, teamActivity: activity } : c;
    };
    set((state) => ({
      companies: state.companies.map(updateFn),
      searchResults: state.searchResults?.map(updateFn) ?? null,
    }));
  },

  setViewMode: (mode) => set({ viewMode: mode, focusedContactId: null }),

  selectCompany: (domain) => {
    const hadSelections = get().selectedContactIds.size > 0;
    set((state) => {
      if (typeof window !== "undefined" && domain) {
        localStorage.setItem("nav_detail_pane_collapsed", "0");
      }
      return { selectedCompanyDomain: domain, slideOverOpen: !!domain, slideOverMode: "dossier", detailPaneCollapsed: false, dossierScrollToTop: state.dossierScrollToTop + 1, selectedContactIds: new Set<string>(), selectedContactsForOutreach: new Set<string>() };
    });
    if (hadSelections && domain) {
      get().addToast({ message: "Selection cleared", type: "info", duration: 2000 });
    }
    if (domain) {
      if (!sessionViewedDomains.has(domain)) {
        sessionViewedDomains.add(domain);
        set((state) => ({ sessionCompaniesReviewed: state.sessionCompaniesReviewed + 1 }));
      }
      const recent = get().recentDomains.filter((r) => r !== domain);
      recent.unshift(domain);
      set({ recentDomains: recent.slice(0, 10) });
      // Track view in Supabase
      const userName = get().userName;
      const company = get().selectedCompany();
      if (userName) {
        fetch("/api/session/track-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain, name: company?.name ?? domain, userName }),
        }).catch(() => { /* silent */ });
      }
    }
  },

  toggleContactSelection: (id) => {
    const current = new Set(get().selectedContactIds);
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    set({ selectedContactIds: current });
  },

  toggleCompanySelection: (domain) => {
    const current = new Set(get().selectedCompanyDomains);
    if (current.has(domain)) {
      current.delete(domain);
    } else {
      current.add(domain);
    }
    set({ selectedCompanyDomains: current });
  },

  selectAllContacts: () => {
    // Select contacts for the expanded domain or selected company
    const domain = get().expandedContactsDomain ?? get().selectedCompanyDomain;
    if (!domain) return;
    const contacts = get().contactsByDomain[domain] ?? [];
    set({ selectedContactIds: new Set(contacts.map((c) => c.id)) });
  },

  deselectAllContacts: () => set({ selectedContactIds: new Set() }),

  selectAllCompanies: () => {
    const companies = get().filteredCompanies();
    set({ selectedCompanyDomains: new Set(companies.map((c) => c.domain)) });
  },

  deselectAllCompanies: () => set({ selectedCompanyDomains: new Set() }),

  setSortField: (field) => set({ sortField: field }),
  setSortDirection: (dir) => set({ sortDirection: dir }),

  setFilters: (partial) =>
    set((state) => ({ filters: { ...state.filters, ...partial } })),

  resetFilters: () => set({ filters: defaultFilters }),

  toggleQuickFilter: (filter) =>
    set((state) => {
      const current = state.filters.quickFilters;
      const next = current.includes(filter)
        ? current.filter((f) => f !== filter)
        : [...current, filter];
      return { filters: { ...state.filters, quickFilters: next } };
    }),

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  addToast: (toast) => {
    const id = `toast-${++toastCounter}`;

    // Dedup check
    if (toast.dedupKey) {
      const existing = get().toasts.find((t) => t.dedupKey === toast.dedupKey && t.phase !== "exiting");
      if (existing) {
        set((state) => ({
          toasts: state.toasts.map((t) =>
            t.id === existing.id ? { ...t, count: (t.count ?? 1) + 1 } : t
          ),
        }));
        return existing.id;
      }
    }

    const newToast: ToastMessage = {
      ...toast,
      id,
      variant: "standard",
      phase: "entering",
      count: 1,
      createdAt: Date.now(),
    };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    // Transition to visible on next frame
    requestAnimationFrame(() => {
      set((state) => ({
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, phase: "visible" as const } : t
        ),
      }));
    });

    const duration = toast.duration ?? 3000;
    if (duration > 0) {
      scheduleToastDismiss(id, duration, get);
    }
    return id;
  },

  dismissToast: (id) => {
    clearToastTimer(id);
    set((state) => ({
      toasts: state.toasts.map((t) =>
        t.id === id ? { ...t, phase: "exiting" as const } : t
      ),
    }));
    setTimeout(() => {
      get().removeToast(id);
    }, 200);
  },

  removeToast: (id) => {
    clearToastTimer(id);
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },

  addProgressToast: (loadingMessage: string) => {
    const id = `toast-${++toastCounter}`;
    const newToast: ToastMessage = {
      id,
      message: loadingMessage,
      type: "info",
      variant: "progress",
      phase: "entering",
      duration: 0,
      progress: {
        status: "loading",
        loadingMessage,
      },
      createdAt: Date.now(),
    };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    requestAnimationFrame(() => {
      set((state) => ({
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, phase: "visible" as const } : t
        ),
      }));
    });

    let settled = false;
    return {
      resolve: (msg?: string) => {
        if (settled) return;
        settled = true;
        set((state) => ({
          toasts: state.toasts.map((t) =>
            t.id === id
              ? {
                  ...t,
                  type: "success" as const,
                  message: msg ?? t.progress?.resolvedMessage ?? "Done",
                  progress: { ...t.progress!, status: "resolved" as const },
                }
              : t
          ),
        }));
        scheduleToastDismiss(id, 2500, get);
      },
      reject: (msg?: string) => {
        if (settled) return;
        settled = true;
        set((state) => ({
          toasts: state.toasts.map((t) =>
            t.id === id
              ? {
                  ...t,
                  type: "error" as const,
                  message: msg ?? t.progress?.rejectedMessage ?? "Failed",
                  progress: { ...t.progress!, status: "rejected" as const },
                }
              : t
          ),
        }));
        scheduleToastDismiss(id, 4000, get);
      },
    };
  },

  addUndoToast: (message: string, undoAction: () => void, duration = 6000) => {
    const id = `toast-${++toastCounter}`;
    const newToast: ToastMessage = {
      id,
      message,
      type: "info",
      variant: "undo",
      phase: "entering",
      duration,
      undoAction,
      undoDeadline: Date.now() + duration,
      createdAt: Date.now(),
    };
    set((state) => ({ toasts: [...state.toasts, newToast] }));

    requestAnimationFrame(() => {
      set((state) => ({
        toasts: state.toasts.map((t) =>
          t.id === id ? { ...t, phase: "visible" as const } : t
        ),
      }));
    });

    scheduleToastDismiss(id, duration, get);
    return id;
  },

  excludeCompany: (domain) => {
    // Optimistic local toggle — mutate BOTH companies and searchResults
    set((state) => ({
      companies: state.companies.map((c) =>
        c.domain === domain ? { ...c, excluded: true } : c
      ),
      searchResults: state.searchResults?.map((c) =>
        c.domain === domain ? { ...c, excluded: true } : c
      ) ?? null,
    }));
    const userName = get().userName ?? "Unknown";
    fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "domain", value: domain, addedBy: userName }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to exclude");
        const data = await res.json();
        if (data.exclusion) {
          set((state) => ({ exclusions: [...state.exclusions, data.exclusion] }));
        }
      })
      .catch(() => {
        // Revert on failure — revert BOTH arrays
        set((state) => ({
          companies: state.companies.map((c) =>
            c.domain === domain ? { ...c, excluded: false } : c
          ),
          searchResults: state.searchResults?.map((c) =>
            c.domain === domain ? { ...c, excluded: false } : c
          ) ?? null,
        }));
        get().addToast({ message: "Failed to exclude company", type: "error" });
      });
  },

  undoExclude: (domain) => {
    // Optimistic local revert — mutate BOTH companies and searchResults
    set((state) => ({
      companies: state.companies.map((c) =>
        c.domain === domain ? { ...c, excluded: false } : c
      ),
      searchResults: state.searchResults?.map((c) =>
        c.domain === domain ? { ...c, excluded: false } : c
      ) ?? null,
    }));
    const exclusion = get().exclusions.find((e) => e.value === domain);
    if (exclusion) {
      set((state) => ({
        exclusions: state.exclusions.filter((e) => e.id !== exclusion.id),
      }));
      fetch("/api/exclusions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: exclusion.id }),
      }).catch(() => {
        // Re-add on failure — revert BOTH arrays
        set((state) => ({
          companies: state.companies.map((c) =>
            c.domain === domain ? { ...c, excluded: true } : c
          ),
          searchResults: state.searchResults?.map((c) =>
            c.domain === domain ? { ...c, excluded: true } : c
          ) ?? null,
          exclusions: [...state.exclusions, exclusion],
        }));
        get().addToast({ message: "Failed to undo exclusion", type: "error" });
      });
    }
  },

  setSlideOverOpen: (open) => set({ slideOverOpen: open }),
  setSlideOverMode: (mode) => set({ slideOverMode: mode }),
  openContacts: (domain) => {
    set({ selectedCompanyDomain: domain, slideOverOpen: true, slideOverMode: "contacts" });
    // Track view same as selectCompany
    if (!sessionViewedDomains.has(domain)) {
      sessionViewedDomains.add(domain);
      set((state) => ({ sessionCompaniesReviewed: state.sessionCompaniesReviewed + 1 }));
    }
    const recent = get().recentDomains.filter((r) => r !== domain);
    recent.unshift(domain);
    set({ recentDomains: recent.slice(0, 10) });
  },

  setUserName: (name, admin) => {
    if (admin !== undefined) {
      set({ userName: name, isAdmin: admin });
    } else {
      const config = get().adminConfig;
      const member = config.teamMembers.find((m) => m.name === name);
      set({ userName: name, isAdmin: member?.isAdmin ?? false });
    }
  },

  addNote: (domain, content, mentions = []) => {
    const userName = get().userName ?? "Unknown";
    const optimisticNote: CompanyNote = {
      id: `n-${Date.now()}`,
      companyDomain: domain,
      content,
      authorName: userName,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      mentions,
    };
    // Optimistic push
    set((state) => ({
      notesByDomain: {
        ...state.notesByDomain,
        [domain]: [...(state.notesByDomain[domain] ?? []), optimisticNote],
      },
    }));
    // Persist
    fetch(`/api/company/${encodeURIComponent(domain)}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName: userName, mentions }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (data.note) {
          // Replace optimistic with server version
          set((state) => ({
            notesByDomain: {
              ...state.notesByDomain,
              [domain]: (state.notesByDomain[domain] ?? []).map((n) =>
                n.id === optimisticNote.id ? data.note : n
              ),
            },
          }));
        }
      })
      .catch(() => {
        // Revert
        set((state) => ({
          notesByDomain: {
            ...state.notesByDomain,
            [domain]: (state.notesByDomain[domain] ?? []).filter(
              (n) => n.id !== optimisticNote.id
            ),
          },
        }));
        get().addToast({ message: pick("note_save_failed"), type: "error" });
      });
  },

  editNote: (noteId, domain, content, mentions = []) => {
    const userName = get().userName ?? "Unknown";
    const prevNotes = get().notesByDomain[domain] ?? [];
    // Optimistic update
    set((state) => ({
      notesByDomain: {
        ...state.notesByDomain,
        [domain]: (state.notesByDomain[domain] ?? []).map((n) =>
          n.id === noteId && n.authorName === userName
            ? { ...n, content, updatedAt: new Date().toISOString(), mentions }
            : n
        ),
      },
    }));
    // Persist
    fetch(`/api/company/${encodeURIComponent(domain)}/notes/${encodeURIComponent(noteId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, authorName: userName, mentions }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
      })
      .catch(() => {
        // Revert
        set((state) => ({
          notesByDomain: { ...state.notesByDomain, [domain]: prevNotes },
        }));
        get().addToast({ message: pick("note_save_failed"), type: "error" });
      });
  },

  deleteNote: (noteId, domain) => {
    const userName = get().userName ?? "Unknown";
    const prevNotes = get().notesByDomain[domain] ?? [];
    // Optimistic delete
    set((state) => ({
      notesByDomain: {
        ...state.notesByDomain,
        [domain]: (state.notesByDomain[domain] ?? []).filter(
          (n) => !(n.id === noteId && n.authorName === userName)
        ),
      },
    }));
    // Persist
    fetch(`/api/company/${encodeURIComponent(domain)}/notes/${encodeURIComponent(noteId)}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorName: userName }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
      })
      .catch(() => {
        // Revert
        set((state) => ({
          notesByDomain: { ...state.notesByDomain, [domain]: prevNotes },
        }));
        get().addToast({ message: pick("note_save_failed"), type: "error" });
      });
  },

  logExtraction: (_domain, _destination, _contacts) => {
    get().addToast({
      message: `Logged extraction of ${_contacts.length} contacts`,
      type: "info",
    });
  },

  setAdminConfig: (config) => set({ adminConfig: config }),

  updateAdminConfig: (partial) =>
    set((state) => {
      const merged = { ...state.adminConfig };
      for (const key of Object.keys(partial) as (keyof typeof partial)[]) {
        const val = partial[key];
        if (val && typeof val === "object" && !Array.isArray(val)) {
          merged[key] = { ...(merged[key] as Record<string, unknown>), ...val } as never;
        } else {
          (merged as Record<string, unknown>)[key] = val;
        }
      }
      return { adminConfig: merged };
    }),

  saveAdminConfig: async () => {
    const config = get().adminConfig;
    try {
      const res = await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      if (res.ok) {
        get().addToast({ message: "Admin config saved", type: "success" });
      } else {
        const data = await res.json();
        get().addToast({ message: data.error || "Failed to save config", type: "error" });
      }
    } catch {
      get().addToast({ message: "Failed to save admin config", type: "error" });
    }
  },

  loadPreset: (presetId) => {
    const preset = get().presets.find((p) => p.id === presetId);
    if (preset) {
      set({ filters: { ...preset.filters }, pendingFilterSearch: true });
      // Clear notification badge when user clicks the preset
      if (preset.newResultCount && preset.newResultCount > 0) {
        get().clearPresetNotification(presetId);
      }
    }
  },

  clearPresetNotification: (id) => {
    set((state) => ({
      presets: state.presets.map((p) =>
        p.id === id ? { ...p, newResultCount: 0 } : p
      ),
    }));
    // Persist to API
    fetch("/api/presets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => { /* silent */ });
  },

  savePreset: (name) => {
    const filters = get().filters;
    const userName = get().userName ?? "Unknown";
    const optimisticPreset: SearchPreset = {
      id: `sp-${Date.now()}`,
      name,
      filters: { ...filters },
      createdBy: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ presets: [...state.presets, optimisticPreset] }));
    // Persist to API
    fetch("/api/presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, filters, createdBy: userName }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed");
        const data = await res.json();
        if (data.preset) {
          // Replace optimistic with server version
          set((state) => ({
            presets: state.presets.map((p) =>
              p.id === optimisticPreset.id ? data.preset : p
            ),
          }));
        }
      })
      .catch(() => {
        get().addToast({ message: "Failed to save preset", type: "error" });
      });
  },

  deletePreset: (id) => {
    set((state) => ({ presets: state.presets.filter((p) => p.id !== id) }));
    // Persist deletion to API
    fetch("/api/presets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => {
      get().addToast({ message: "Failed to delete preset", type: "error" });
    });
  },

  setSearchResults: (companies) => set({ searchResults: companies, similarResults: null }),
  setSearchError: (error) => set({ searchError: error }),
  setSearchErrors: (errs) => set({ searchErrors: errs, searchError: errs[0]?.message ?? null }),
  setSearchWarnings: (w) => set({ searchWarnings: w }),
  setLastSearchParams: (params) => set({ lastSearchParams: params }),
  retryLastSearch: () => {
    const params = get().lastSearchParams;
    if (!params) return;
    if (params.freeText) {
      get().setPendingFreeTextSearch(params.freeText);
    } else if (params.filters) {
      set({ filters: { ...get().filters, ...params.filters } });
      get().setPendingFilterSearch(true);
    }
  },
  setUserCopyFormat: (formatId) => set({ userCopyFormat: formatId }),
  setExportState: (s) => set({ exportState: s }),
  setTriggerExport: (v) => set({ triggerExport: v }),
  setPendingFreeTextSearch: (text) => set({ pendingFreeTextSearch: text }),
  setPendingFilterSearch: (pending) => set({ pendingFilterSearch: pending }),
  setLastSearchQuery: (query) => set({ lastSearchQuery: query }),
  setExtractedEntities: (entities) => set({ extractedEntities: entities }),
  setSearchLoading: (loading) => set({ searchLoading: loading }),
  setResultGrouping: (g) => set({ resultGrouping: g }),
  toggleDetailPane: () => set((state) => {
    const next = !state.detailPaneCollapsed;
    if (typeof window !== "undefined") {
      localStorage.setItem("nav_detail_pane_collapsed", next ? "1" : "0");
    }
    return { detailPaneCollapsed: next };
  }),

  // Contact tab actions
  setContactFilters: (partial) =>
    set((state) => ({ contactFilters: { ...state.contactFilters, ...partial } })),

  setContactVisibleFields: (fields) => set({ contactVisibleFields: fields }),

  toggleContactGroupCollapsed: (domain) =>
    set((state) => {
      const wasCollapsed = state.contactGroupsCollapsed[domain];
      const isNowCollapsed = !wasCollapsed;
      const updates: Partial<AppState> = {
        contactGroupsCollapsed: {
          ...state.contactGroupsCollapsed,
          [domain]: isNowCollapsed,
        },
      };
      // Clear focusedContactId if collapsing a group that contains it
      if (isNowCollapsed && state.focusedContactId) {
        const groupContacts = state.contactsByDomain[domain];
        if (groupContacts?.some((c) => c.id === state.focusedContactId)) {
          updates.focusedContactId = null;
        }
      }
      return updates;
    }),

  collapseAllContactGroups: () => {
    const domains = Object.keys(get().contactsByDomain);
    const collapsed: Record<string, boolean> = {};
    for (const d of domains) collapsed[d] = true;
    set({ contactGroupsCollapsed: collapsed });
  },

  expandAllContactGroups: () => set({ contactGroupsCollapsed: {} }),

  excludeContact: (value, type = "email") => {
    const userName = get().userName ?? "Unknown";
    fetch("/api/exclusions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, value, addedBy: userName }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to exclude");
        const data = await res.json();
        if (data.exclusion) {
          set((state) => ({ exclusions: [...state.exclusions, data.exclusion] }));
        }
        get().addToast({ message: `Excluded ${type === "email" ? value : "contact"}`, type: "success" });
      })
      .catch(() => {
        get().addToast({ message: "Failed to exclude contact", type: "error" });
      });
  },

  setFocusedContactId: (id) => set({ focusedContactId: id }),

  setExclusions: (exclusions) => set({ exclusions }),
  setPresets: (presets) => set({ presets }),

  fetchPresets: () => {
    fetch("/api/presets")
      .then(async (res) => {
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.presets)) {
          set({ presets: data.presets });
        }
      })
      .catch(() => { /* silent */ });
  },

  incrementSessionExported: (count) => set((state) => ({
    sessionContactsExported: state.sessionContactsExported + count,
  })),

  filteredCompanies: () => {
    const { companies, searchResults, filters, sortField, sortDirection } = get();
    let result = [...(searchResults ?? companies)];

    if (filters.hideExcluded) {
      result = result.filter((c) => !c.excluded);
    }

    // Hide "not_relevant" companies unless showHiddenResults is on
    if (!get().showHiddenResults) {
      const rf = get().relevanceFeedback;
      result = result.filter((c) => rf[c.domain]?.feedback !== "not_relevant");
    }

    // Skip filtering when ALL options in a category are selected (treat as "no filter")
    if (filters.sources.length > 0 && filters.sources.length < 4) {
      result = result.filter((c) =>
        filters.sources.some((s: ResultSource) => c.sources.includes(s))
      );
    }

    if (filters.verticals.length > 0) {
      result = result.filter((c) => filters.verticals.includes(c.vertical));
    }

    if (filters.regions.length > 0 && filters.regions.length < 5) {
      result = result.filter((c) => filters.regions.includes(c.region));
    }

    if (filters.sizes.length > 0 && filters.sizes.length < 4) {
      result = result.filter((c) => {
        // Include data-incomplete companies regardless of size filter
        if (!c.employeeCount) return true;
        return filters.sizes.some((bucket: SizeBucket) => {
          switch (bucket) {
            case "1-50": return c.employeeCount >= 1 && c.employeeCount <= 50;
            case "51-200": return c.employeeCount >= 51 && c.employeeCount <= 200;
            case "201-1000": return c.employeeCount >= 201 && c.employeeCount <= 1000;
            case "1000+": return c.employeeCount >= 1000;
            default: return true;
          }
        });
      });
    }

    if (filters.signals.length > 0 && filters.signals.length < 4) {
      result = result.filter((c) =>
        c.signals.some((s) => filters.signals.includes(s.type as SignalType))
      );
    }

    if (filters.statuses.length > 0 && filters.statuses.length < DEFAULT_PIPELINE_STAGES.length) {
      result = result.filter((c) => filters.statuses.includes(c.status ?? "new"));
    }

    // Quick filters
    if (filters.quickFilters.includes("high_icp")) {
      result = result.filter((c) => c.icpScore >= 80);
    }
    if (filters.quickFilters.includes("has_signals")) {
      result = result.filter((c) => c.signals.length > 0);
    }
    if (filters.quickFilters.includes("not_in_hubspot")) {
      result = result.filter((c) => c.hubspotStatus === "none");
    }
    if (filters.quickFilters.includes("not_in_freshsales")) {
      result = result.filter((c) => c.freshsalesStatus === "none");
    }

    // Triage filter
    const triageFilter = get().triageFilter;
    const decisions = get().companyDecisions;
    if (triageFilter === "unreviewed") {
      result = result.filter((c) => !decisions[c.domain]);
    } else if (triageFilter === "interested") {
      result = result.filter((c) => decisions[c.domain] === "interested");
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "icp_score": cmp = a.icpScore - b.icpScore; break;
        case "name": cmp = a.name.localeCompare(b.name); break;
        case "employee_count": cmp = a.employeeCount - b.employeeCount; break;
        default: cmp = a.icpScore - b.icpScore;
      }
      return sortDirection === "desc" ? -cmp : cmp;
    });

    // Float exact match to top
    const exactIdx = result.findIndex((c) => c.exactMatch);
    if (exactIdx > 0) {
      const [exact] = result.splice(exactIdx, 1);
      result.unshift(exact);
    }

    return result;
  },

  updateContact: (domain: string, contactId: string, updated: Contact) => {
    const current = get().contactsByDomain[domain] ?? [];
    set({
      contactsByDomain: {
        ...get().contactsByDomain,
        [domain]: current.map((c) => (c.id === contactId ? updated : c)),
      },
    });
  },

  setContactsForDomain: (domain: string, contacts: Contact[]) => {
    set({
      contactsByDomain: {
        ...get().contactsByDomain,
        [domain]: contacts,
      },
    });
  },

  setCompanyStatus: (domain, status, userName) => {
    const now = new Date().toISOString();
    const updateFn = (c: CompanyEnriched) =>
      c.domain === domain ? { ...c, status, statusChangedBy: userName, statusChangedAt: now } : c;
    set((state) => ({
      companies: state.companies.map(updateFn),
      searchResults: state.searchResults?.map(updateFn) ?? null,
    }));
    // Persist to API
    fetch(`/api/company/${encodeURIComponent(domain)}/status`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, userName }),
    }).catch(() => {
      get().addToast({ message: "Failed to update status", type: "error" });
    });
  },

  searchSimilar: (company) => {
    const sizeBucket = getSizeBucket(company.employeeCount);
    set({
      filters: {
        ...defaultFilters,
        verticals: [company.vertical],
        regions: [company.region],
        sizes: [sizeBucket],
      },
      pendingFilterSearch: true,
    });
  },

  selectedCompany: () => {
    const { companies, searchResults, selectedCompanyDomain } = get();
    if (!selectedCompanyDomain) return null;
    if (searchResults) {
      const fromSearch = searchResults.find((c) => c.domain === selectedCompanyDomain);
      if (fromSearch) return fromSearch;
    }
    return companies.find((c) => c.domain === selectedCompanyDomain) ?? null;
  },

  companyContacts: (domain: string) => {
    return get().contactsByDomain[domain] ?? [];
  },

  companyNotes: (domain: string) => {
    return get().notesByDomain[domain] ?? [];
  },
}));
