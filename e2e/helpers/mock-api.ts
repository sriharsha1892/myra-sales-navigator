import { type Page } from "@playwright/test";

/**
 * When E2E_REAL_API=true, all mocks are skipped and requests hit real endpoints.
 * Otherwise (default / CI), every /api/** route is intercepted with canned data.
 */
export const USE_REAL_API = process.env.E2E_REAL_API === "true";

// ---------------------------------------------------------------------------
// Canned response data
// ---------------------------------------------------------------------------

export const MOCK_COMPANY_ACME = {
  domain: "acme.com",
  name: "Acme Corporation",
  industry: "Chemicals",
  vertical: "Industrial Chemicals",
  employeeCount: 450,
  location: "Houston, TX",
  region: "North America",
  description: "A leading manufacturer of industrial chemicals and coatings used in manufacturing.",
  icpScore: 82,
  hubspotStatus: "none" as const,
  freshsalesStatus: "none" as const,
  freshsalesIntel: null,
  freshsalesAvailable: false,
  sources: ["exa"] as string[],
  signals: [
    {
      id: "sig-1",
      companyDomain: "acme.com",
      type: "hiring" as const,
      title: "Acme hiring VP of Sales — APAC expansion",
      description: "Job posting indicates expansion into Asia-Pacific region.",
      date: "2026-01-15",
      sourceUrl: "https://example.com/acme-hiring",
      source: "exa" as const,
    },
  ],
  contactCount: 5,
  lastRefreshed: new Date().toISOString(),
  logoUrl: null,
  firstViewedBy: "Adi",
  firstViewedAt: new Date().toISOString(),
  lastViewedBy: "Adi",
  lastViewedAt: new Date().toISOString(),
  source: "exa",
  noteCount: 0,
  lastNoteAt: null,
  extractionCount: 0,
  lastExtractionAt: null,
  excluded: false,
  excludedBy: null,
  excludedAt: null,
  exclusionReason: null,
  status: "new",
  statusChangedBy: null,
  statusChangedAt: null,
  viewedBy: null,
  revenue: "$120M",
  founded: "1998",
  website: "https://acme.com",
  phone: "+1-555-100-2000",
};

export const MOCK_COMPANY_GLOBEX = {
  ...MOCK_COMPANY_ACME,
  domain: "globex.io",
  name: "Globex Industries",
  industry: "Food & Beverage",
  vertical: "Food Ingredients",
  employeeCount: 220,
  location: "London, UK",
  region: "Europe",
  description: "Specialty food ingredient distributor expanding across the EU.",
  icpScore: 74,
  signals: [
    {
      id: "sig-2",
      companyDomain: "globex.io",
      type: "expansion" as const,
      title: "Globex opens new distribution center in Frankfurt",
      description: "Major distribution expansion in continental Europe.",
      date: "2026-02-01",
      sourceUrl: null,
      source: "exa" as const,
    },
  ],
  contactCount: 3,
};

export const MOCK_SEARCH_RESULTS = [MOCK_COMPANY_ACME, MOCK_COMPANY_GLOBEX];

export const MOCK_CONTACTS = [
  {
    id: "contact-1",
    companyDomain: "acme.com",
    companyName: "Acme Corporation",
    firstName: "Jane",
    lastName: "Smith",
    title: "VP of Sales",
    email: "jane.smith@acme.com",
    phone: "+1-555-111-0001",
    linkedinUrl: "https://linkedin.com/in/janesmith",
    emailConfidence: 92,
    confidenceLevel: "high" as const,
    sources: ["apollo"] as string[],
    seniority: "vp" as const,
    lastVerified: "2026-02-01",
  },
  {
    id: "contact-2",
    companyDomain: "acme.com",
    companyName: "Acme Corporation",
    firstName: "Robert",
    lastName: "Johnson",
    title: "Director of Business Development",
    email: "r.johnson@acme.com",
    phone: null,
    linkedinUrl: "https://linkedin.com/in/rjohnson",
    emailConfidence: 78,
    confidenceLevel: "medium" as const,
    sources: ["apollo"] as string[],
    seniority: "director" as const,
    lastVerified: null,
  },
  {
    id: "contact-3",
    companyDomain: "acme.com",
    companyName: "Acme Corporation",
    firstName: "Emily",
    lastName: "Chen",
    title: "CEO",
    email: "emily.chen@acme.com",
    phone: "+1-555-111-0003",
    linkedinUrl: null,
    emailConfidence: 95,
    confidenceLevel: "high" as const,
    sources: ["apollo", "freshsales"] as string[],
    seniority: "c_level" as const,
    lastVerified: "2026-02-05",
  },
];

export const MOCK_SEQUENCE = {
  id: "seq-001",
  name: "Standard Outreach",
  description: "3-step email + call sequence",
  createdBy: "Adi",
  isTemplate: true,
  steps: [
    { channel: "email", delayDays: 0, tone: "formal", template: "intro" },
    { channel: "call", delayDays: 3 },
    { channel: "email", delayDays: 5, tone: "casual", template: "follow_up" },
  ],
  createdAt: "2026-02-01T00:00:00.000Z",
  updatedAt: "2026-02-01T00:00:00.000Z",
};

export const MOCK_ENROLLMENT = {
  id: "enroll-001",
  sequenceId: "seq-001",
  contactId: "contact-1",
  companyDomain: "acme.com",
  enrolledBy: "Adi",
  currentStep: 0,
  status: "active" as const,
  nextStepDueAt: new Date(Date.now() + 86400000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Route interceptor
// ---------------------------------------------------------------------------

/**
 * Register all API route mocks on the given page.
 * MUST be called BEFORE page.goto() so routes are intercepted from the first request.
 * Skips entirely when E2E_REAL_API=true.
 */
export async function setupMockApi(page: Page): Promise<void> {
  if (USE_REAL_API) return;

  // --- Auth ---
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        name: "Adi",
        isAdmin: true,
        lastLoginAt: new Date(Date.now() - 3600000).toISOString(),
        unreadMentions: [],
      }),
    })
  );

  await page.route("**/api/auth/logout", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ success: true }),
    })
  );

  // --- Admin config ---
  await page.route("**/api/admin/config", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        icpWeights: {
          verticalMatch: 30, sizeMatch: 20, regionMatch: 10, buyingSignals: 20,
          negativeSignals: -30, exaRelevance: 10, hubspotLead: 15, hubspotCustomer: -50,
          freshsalesLead: 15, freshsalesCustomer: -50, freshsalesRecentContact: 10,
          freshsalesTagBoost: 5, freshsalesTagPenalty: -10, freshsalesDealStalled: -15,
        },
        verticals: ["Chemicals", "Food & Beverage", "SaaS", "Logistics"],
        sizeSweetSpot: { min: 50, max: 500 },
        signalTypes: [
          { type: "hiring", enabled: true }, { type: "funding", enabled: true },
          { type: "expansion", enabled: true }, { type: "news", enabled: true },
        ],
        teamMembers: [
          { name: "Adi", email: "adi@myra.com", isAdmin: true },
          { name: "Satish", email: "satish@myra.com", isAdmin: false },
        ],
        cacheDurations: { exa: 360, apollo: 1440, hubspot: 60, clearout: 43200, freshsales: 120 },
        copyFormats: [{ id: "default", name: "Name <email>", template: "{{first_name}} {{last_name}} <{{email}}>" }],
        defaultCopyFormat: "default",
        apiKeys: [], dataSources: [],
        exportSettings: { defaultFormat: "clipboard", csvColumns: [], confidenceThreshold: 0, autoVerifyOnExport: false, includeCompanyContext: true },
        emailVerification: {}, scoringSettings: {}, rateLimits: {}, notifications: {},
        dataRetention: {}, authSettings: {}, uiPreferences: {}, emailPrompts: {},
        analyticsSettings: {},
        freshsalesSettings: { enabled: false, domain: "" },
        enrichmentLimits: { maxSearchEnrich: 10, maxContactAutoEnrich: 5, maxClearoutFinds: 10 },
        icpProfiles: [], authLog: [], authRequests: [],
        outreachChannelConfig: {
          enabledChannels: ["email", "call", "linkedin_connect"],
          defaultChannel: "email", channelInstructions: {}, writingRulesDefault: "",
        },
        outreachSuggestionRules: [], actionRecommendationRules: [],
        actionRecommendationEnabled: false, discoveryEngine: "exa",
      }),
    })
  );

  // --- Search companies ---
  await page.route("**/api/search/companies", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        companies: MOCK_SEARCH_RESULTS,
        query: "chemicals in Europe",
        criteria: null,
        excludedCount: 0,
        engineUsed: "exa",
      }),
    })
  );

  // --- Company contacts ---
  await page.route("**/api/company/*/contacts**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        contacts: MOCK_CONTACTS,
        sources: { apollo: true, hubspot: false, freshsales: false },
      }),
    })
  );

  // --- Company signals ---
  await page.route("**/api/company/*/signals**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ signals: MOCK_COMPANY_ACME.signals }),
    })
  );

  // --- Company peers ---
  await page.route("**/api/company/*/peers**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ peers: [MOCK_COMPANY_GLOBEX] }),
    })
  );

  // --- Company notes ---
  await page.route("**/api/company/*/notes**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ notes: [] }),
    })
  );

  // --- Company status ---
  await page.route("**/api/company/*/status**", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "new" }),
    })
  );

  // --- Company dossier (must come AFTER more-specific sub-routes) ---
  await page.route("**/api/company/*", (route) => {
    const url = route.request().url();
    // Skip if this is a sub-route (contacts, signals, peers, notes, status)
    const afterCompany = url.split("/api/company/")[1] || "";
    const parts = afterCompany.split("/").filter(Boolean);
    if (parts.length > 1) {
      return route.fallback();
    }

    const match = url.match(/\/api\/company\/([^/?]+)/);
    const domain = match ? decodeURIComponent(match[1]) : "";
    const company = MOCK_SEARCH_RESULTS.find((c) => c.domain === domain) ?? MOCK_COMPANY_ACME;

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...company,
        aiSummary: `${company.name} is a promising prospect in the ${company.industry} sector.`,
      }),
    });
  });

  // --- Export clipboard ---
  await page.route("**/api/export/clipboard", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        text: MOCK_CONTACTS.filter((c) => c.email).map((c) => `${c.firstName} ${c.lastName} <${c.email}>`).join("\n"),
        count: MOCK_CONTACTS.filter((c) => c.email).length,
        skipped: 0,
      }),
    })
  );

  // --- Export CSV ---
  await page.route("**/api/export/csv", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ csv: "First Name,Last Name,Email\nJane,Smith,jane.smith@acme.com", count: 1, skipped: 0 }),
    })
  );

  // --- Export log ---
  await page.route("**/api/export/log", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  );

  // --- ICP score ---
  await page.route("**/api/icp/score", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ scores: [] }) })
  );

  // --- Exclusions ---
  await page.route("**/api/exclusions**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ exclusions: [] }) })
  );

  // --- Search history ---
  await page.route("**/api/search/history**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ history: [] }) })
  );

  // --- Presets ---
  await page.route("**/api/presets**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ presets: [] }) })
  );

  // --- Contact verification ---
  await page.route("**/api/contact/verify", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ results: MOCK_CONTACTS.map((c) => ({ email: c.email, status: "valid", score: 95 })) }),
    })
  );

  // --- Contact enrich ---
  await page.route("**/api/contact/enrich**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ contact: MOCK_CONTACTS[0] }) })
  );

  // --- Contact find-emails ---
  await page.route("**/api/contact/find-emails", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ results: [], found: 0 }) })
  );

  // --- Contact log-copy ---
  await page.route("**/api/contact/log-copy", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  );

  // --- Contact export history ---
  await page.route("**/api/contact/export-history**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ extractions: [] }) })
  );

  // --- Contact persist-email ---
  await page.route("**/api/contact/persist-email", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  );

  // --- Company decisions ---
  await page.route("**/api/company-decisions**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ decisions: {} }) })
  );

  // --- Prospect list ---
  await page.route("**/api/prospect-list**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ domains: [] }) })
  );

  // --- Settings user ---
  await page.route("**/api/settings/user**", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        userName: "Adi", defaultCopyFormat: "default", defaultView: "companies",
        defaultSort: { field: "icp_score", direction: "desc" }, recentDomains: [],
      }),
    })
  );

  // --- User config ---
  await page.route("**/api/user/config**", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ userName: "Adi", freshsalesDomain: null, hasLinkedinSalesNav: false, preferences: {} }),
    })
  );

  // --- HubSpot ---
  await page.route("**/api/hubspot/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "none", contacts: [] }) })
  );

  // --- Outreach sequences ---
  await page.route("**/api/outreach/sequences", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ sequences: [MOCK_SEQUENCE] }),
      });
    }
    return route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify({ ...MOCK_SEQUENCE, id: "seq-new-" + Date.now(), name: "New Sequence" }),
    });
  });

  // --- Outreach sequence by ID ---
  await page.route("**/api/outreach/sequences/*", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(MOCK_SEQUENCE) })
  );

  // --- Outreach enrollment execute ---
  await page.route("**/api/outreach/enrollments/*/execute", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ channel: "email", subject: "Introduction from myRA", message: "Hi Jane, I wanted to reach out about..." }),
    })
  );

  // --- Outreach enrollment briefing ---
  await page.route("**/api/outreach/enrollments/*/briefing", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({
        contact: { name: "Jane Smith", title: "VP of Sales", seniority: "vp", phone: "+1-555-111-0001", linkedinUrl: null, emailConfidence: 92 },
        company: { name: "Acme Corporation", domain: "acme.com", industry: "Chemicals", employeeCount: 450, location: "Houston, TX", icpScore: 82, icpReasoning: null },
        crm: { status: "none", warmth: "cold", lastContactDate: null, topDeal: null, lastActivity: null },
        topSignal: { type: "hiring", title: "VP of Sales hiring", date: "2026-01-15" },
        previousSteps: [], suggestedOpener: "I noticed Acme is expanding its sales team...",
      }),
    })
  );

  // --- Outreach enrollment by ID ---
  await page.route("**/api/outreach/enrollments/*", (route) => {
    const url = route.request().url();
    if (url.includes("/execute") || url.includes("/briefing")) return route.fallback();

    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({
          enrollment: MOCK_ENROLLMENT,
          stepLogs: [{
            id: "log-1", enrollmentId: MOCK_ENROLLMENT.id, stepIndex: 0,
            channel: "email", status: "pending", completedAt: null, outcome: null, notes: null, draftContent: null,
          }],
        }),
      });
    }
    // PUT — advance / pause / resume / unenroll
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ enrollment: { ...MOCK_ENROLLMENT, currentStep: 1 }, completed: false }),
    });
  });

  // --- Outreach enrollments list ---
  await page.route("**/api/outreach/enrollments", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ enrollments: [MOCK_ENROLLMENT] }),
      });
    }
    return route.fulfill({
      status: 201, contentType: "application/json",
      body: JSON.stringify(MOCK_ENROLLMENT),
    });
  });

  // --- Outreach draft ---
  await page.route("**/api/outreach/draft", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ channel: "email", subject: "Quick intro from myRA", message: "Hi Jane,\n\nI noticed Acme is expanding into APAC.\n\nBest,\nAdi" }),
    })
  );

  // --- Due steps ---
  await page.route("**/api/outreach/due-steps**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ dueSteps: [] }) })
  );

  // --- Call log ---
  await page.route("**/api/outreach/call-log", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  );

  // --- Email draft ---
  await page.route("**/api/email/draft", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ subject: "Introduction", body: "Hi..." }) })
  );

  // --- Outreach drafts list ---
  await page.route("**/api/outreach/drafts**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ drafts: [] }) })
  );

  // --- Session endpoints ---
  await page.route("**/api/session/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );

  // --- Team activity ---
  await page.route("**/api/team-activity/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ entries: [], similar: [] }) })
  );

  // --- Bulk endpoints ---
  await page.route("**/api/bulk/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  );

  // --- Credits ---
  await page.route("**/api/admin/credits", (route) =>
    route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ apollo: { used: 100, limit: 4000, replenishDate: "2026-03-01" }, clearout: { used: 50, limit: 50000 } }),
    })
  );

  // --- Freshsales ---
  await page.route("**/api/freshsales/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ tasks: [], contacts: [] }) })
  );

  // --- Chat ---
  await page.route("**/api/chat", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "I can help!" }) })
  );

  // --- Health ---
  await page.route("**/api/health/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: "ok" }) })
  );

  // --- Analytics ---
  await page.route("**/api/analytics/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({}) })
  );

  // --- Teams ---
  await page.route("**/api/teams/**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) })
  );

  // --- Admin user-activity ---
  await page.route("**/api/admin/user-activity**", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ activity: [] }) })
  );
}
