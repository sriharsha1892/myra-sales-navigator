import { create } from "zustand";
import type {
  CompanyEnriched,
  Contact,
  Exclusion,
  SearchPreset,
  AdminConfig,
  CompanyNote,
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
} from "./types";
import {
  mockCompaniesEnriched,
  mockContactsCache,
  mockExclusions,
  mockPresets,
  defaultAdminConfig,
  mockNotes,
} from "./mock-data";

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

  // Auth
  userName: string | null;
  isAdmin: boolean;

  // Recent companies
  recentDomains: string[];

  // Export
  userCopyFormat: string;
  exportState: ExportFlowState | null;
  triggerExport: "csv" | "clipboard" | null;

  // Cmd+K free-text search
  pendingFreeTextSearch: string | null;

  // Filter-based search trigger
  pendingFilterSearch: boolean;

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
  setUserName: (name: string | null) => void;
  addNote: (domain: string, content: string, mentions?: string[]) => void;
  editNote: (noteId: string, domain: string, content: string, mentions?: string[]) => void;
  deleteNote: (noteId: string, domain: string) => void;
  logExtraction: (domain: string, destination: string, contacts: ContactSnapshot[]) => void;
  updateAdminConfig: (config: Partial<AdminConfig>) => void;
  saveAdminConfig: () => Promise<void>;
  loadPreset: (presetId: string) => void;
  savePreset: (name: string) => void;
  deletePreset: (id: string) => void;
  setSearchResults: (companies: CompanyEnriched[] | null) => void;
  setSearchError: (error: string | null) => void;
  setUserCopyFormat: (formatId: string) => void;
  setExportState: (s: ExportFlowState | null) => void;
  setTriggerExport: (v: "csv" | "clipboard" | null) => void;
  setPendingFreeTextSearch: (text: string | null) => void;
  setPendingFilterSearch: (pending: boolean) => void;
  setExclusions: (exclusions: Exclusion[]) => void;
  setPresets: (presets: SearchPreset[]) => void;
  updateContact: (domain: string, contactId: string, updated: Contact) => void;
  setContactsForDomain: (domain: string, contacts: Contact[]) => void;

  // Computed / derived
  filteredCompanies: () => CompanyEnriched[];
  selectedCompany: () => CompanyEnriched | null;
  companyContacts: (domain: string) => Contact[];
  companyNotes: (domain: string) => CompanyNote[];
}

const defaultFilters: FilterState = {
  sources: [],
  verticals: [],
  regions: [],
  sizes: [],
  signals: [],
  hideExcluded: true,
  quickFilters: [],
};

// Build initial contactsByDomain and notesByDomain from mock data
function buildContactsByDomain(): Record<string, Contact[]> {
  return { ...mockContactsCache };
}

function buildNotesByDomain(): Record<string, CompanyNote[]> {
  const map: Record<string, CompanyNote[]> = {};
  for (const note of mockNotes) {
    const existing = map[note.companyDomain] ?? [];
    existing.push(note);
    map[note.companyDomain] = existing;
  }
  return map;
}

let toastCounter = 0;

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
  notesByDomain: buildNotesByDomain(),

  searchResults: null,
  searchError: null,

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

  userName: null,
  isAdmin: false,

  recentDomains: [],

  userCopyFormat: "name_email",
  exportState: null,
  triggerExport: null,
  pendingFreeTextSearch: null,
  pendingFilterSearch: false,

  setViewMode: (mode) => set({ viewMode: mode }),

  selectCompany: (domain) => {
    set({ selectedCompanyDomain: domain, slideOverOpen: !!domain });
    if (domain) {
      const recent = get().recentDomains.filter((r) => r !== domain);
      recent.unshift(domain);
      set({ recentDomains: recent.slice(0, 10) });
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
    const domain = get().selectedCompanyDomain;
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
    // Optimistic local toggle
    set((state) => ({
      companies: state.companies.map((c) =>
        c.domain === domain ? { ...c, excluded: true } : c
      ),
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
        // Revert on failure
        set((state) => ({
          companies: state.companies.map((c) =>
            c.domain === domain ? { ...c, excluded: false } : c
          ),
        }));
        get().addToast({ message: "Failed to exclude company", type: "error" });
      });
  },

  undoExclude: (domain) => {
    // Optimistic local revert
    set((state) => ({
      companies: state.companies.map((c) =>
        c.domain === domain ? { ...c, excluded: false } : c
      ),
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
        // Re-add on failure
        set((state) => ({
          companies: state.companies.map((c) =>
            c.domain === domain ? { ...c, excluded: true } : c
          ),
          exclusions: [...state.exclusions, exclusion],
        }));
        get().addToast({ message: "Failed to undo exclusion", type: "error" });
      });
    }
  },

  setSlideOverOpen: (open) => set({ slideOverOpen: open }),

  setUserName: (name) => {
    const config = get().adminConfig;
    const member = config.teamMembers.find((m) => m.name === name);
    set({ userName: name, isAdmin: member?.isAdmin ?? false });
  },

  addNote: (domain, content, mentions = []) => {
    const userName = get().userName ?? "Unknown";
    const note: CompanyNote = {
      id: `n-${Date.now()}`,
      companyDomain: domain,
      content,
      authorName: userName,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      mentions,
    };
    set((state) => {
      const existing = state.notesByDomain[domain] ?? [];
      return {
        notesByDomain: {
          ...state.notesByDomain,
          [domain]: [...existing, note],
        },
      };
    });
  },

  editNote: (noteId, domain, content, mentions = []) => {
    const userName = get().userName ?? "Unknown";
    set((state) => {
      const domainNotes = state.notesByDomain[domain] ?? [];
      return {
        notesByDomain: {
          ...state.notesByDomain,
          [domain]: domainNotes.map((n) =>
            n.id === noteId && n.authorName === userName
              ? { ...n, content, updatedAt: new Date().toISOString(), mentions }
              : n
          ),
        },
      };
    });
  },

  deleteNote: (noteId, domain) => {
    const userName = get().userName ?? "Unknown";
    set((state) => {
      const domainNotes = state.notesByDomain[domain] ?? [];
      return {
        notesByDomain: {
          ...state.notesByDomain,
          [domain]: domainNotes.filter(
            (n) => !(n.id === noteId && n.authorName === userName)
          ),
        },
      };
    });
  },

  logExtraction: (_domain, _destination, _contacts) => {
    get().addToast({
      message: `Logged extraction of ${_contacts.length} contacts`,
      type: "info",
    });
  },

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
      set({ filters: { ...preset.filters } });
    }
  },

  savePreset: (name) => {
    const filters = get().filters;
    const userName = get().userName ?? "Unknown";
    const preset: SearchPreset = {
      id: `sp-${Date.now()}`,
      name,
      filters: { ...filters },
      createdBy: userName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    set((state) => ({ presets: [...state.presets, preset] }));
  },

  deletePreset: (id) =>
    set((state) => ({ presets: state.presets.filter((p) => p.id !== id) })),

  setSearchResults: (companies) => set({ searchResults: companies }),
  setSearchError: (error) => set({ searchError: error }),
  setUserCopyFormat: (formatId) => set({ userCopyFormat: formatId }),
  setExportState: (s) => set({ exportState: s }),
  setTriggerExport: (v) => set({ triggerExport: v }),
  setPendingFreeTextSearch: (text) => set({ pendingFreeTextSearch: text }),
  setPendingFilterSearch: (pending) => set({ pendingFilterSearch: pending }),
  setExclusions: (exclusions) => set({ exclusions }),
  setPresets: (presets) => set({ presets }),

  filteredCompanies: () => {
    const { companies, searchResults, filters, sortField, sortDirection } = get();
    let result = [...(searchResults ?? companies)];

    if (filters.hideExcluded) {
      result = result.filter((c) => !c.excluded);
    }

    if (filters.sources.length > 0) {
      result = result.filter((c) =>
        filters.sources.some((s: ResultSource) => c.sources.includes(s))
      );
    }

    if (filters.verticals.length > 0) {
      result = result.filter((c) => filters.verticals.includes(c.vertical));
    }

    if (filters.regions.length > 0) {
      result = result.filter((c) => filters.regions.includes(c.region));
    }

    if (filters.sizes.length > 0) {
      result = result.filter((c) => {
        return filters.sizes.some((bucket: SizeBucket) => {
          switch (bucket) {
            case "1-50": return c.employeeCount >= 1 && c.employeeCount <= 50;
            case "51-200": return c.employeeCount >= 51 && c.employeeCount <= 200;
            case "201-1000": return c.employeeCount >= 201 && c.employeeCount <= 1000;
            case "1000+": return c.employeeCount > 1000;
            default: return true;
          }
        });
      });
    }

    if (filters.signals.length > 0) {
      result = result.filter((c) =>
        c.signals.some((s) => filters.signals.includes(s.type as SignalType))
      );
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

  selectedCompany: () => {
    const { companies, selectedCompanyDomain } = get();
    if (!selectedCompanyDomain) return null;
    return companies.find((c) => c.domain === selectedCompanyDomain) ?? null;
  },

  companyContacts: (domain: string) => {
    return get().contactsByDomain[domain] ?? [];
  },

  companyNotes: (domain: string) => {
    return get().notesByDomain[domain] ?? [];
  },
}));
