export type ResultSource = "exa" | "apollo" | "hubspot" | "clearout" | "mordor" | "freshsales";

export type HubSpotStatus =
  | "new"
  | "open"
  | "in_progress"
  | "closed_won"
  | "closed_lost"
  | "none";

export type FreshsalesStatus =
  | "none"
  | "new_lead"
  | "contacted"
  | "negotiation"
  | "won"
  | "lost"
  | "customer";

export interface FreshsalesDeal {
  id: number;
  name: string;
  amount: number | null;
  stage: string;
  probability: number | null;
  expectedClose: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  daysInStage: number | null;
  lostReason?: string | null;
}

export interface FreshsalesActivity {
  type: string;        // "email" | "call" | "meeting" | "note" | "task"
  title: string;
  date: string;
  actor: string;       // team member who performed
  outcome?: string;    // "interested", "not_interested", "no_response", etc.
  contactName?: string; // which contact was this with
}

export interface FreshsalesIntel {
  domain: string;
  status: FreshsalesStatus;
  account: {
    id: number;
    name: string;
    website: string | null;
    industry: string | null;
    employees: number | null;
    owner: { id: number; name: string; email: string } | null;
  } | null;
  contacts: Contact[];
  deals: FreshsalesDeal[];
  recentActivity: FreshsalesActivity[];
  lastContactDate: string | null;
}

export interface FreshsalesSettings {
  enabled: boolean;
  domain: string;
  sectionTitle: string;
  emptyStateLabel: string;
  statusLabels: Record<FreshsalesStatus, string>;
  showDeals: boolean;
  showContacts: boolean;
  showActivity: boolean;
  recentActivityDaysThreshold: number;
  cacheTtlMinutes: number;
  icpWeights: {
    freshsalesLead: number;
    freshsalesCustomer: number;
    freshsalesRecentContact: number;
  };
  showOwner: boolean;
  showTags: boolean;
  showDealVelocity: boolean;
  stalledDealThresholdDays?: number;
  tagScoringRules: {
    boostTags: string[];
    boostPoints: number;
    penaltyTags: string[];
    penaltyPoints: number;
    excludeTags: string[];
  };
  enablePushContact: boolean;
  enableTaskCreation: boolean;
  defaultTaskDueDays: number;
}

export type SignalType = "hiring" | "funding" | "expansion" | "news";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export type ViewMode = "companies" | "exported";

export type SortField = "icp_score" | "name" | "employee_count" | "relevance";

export type SortDirection = "asc" | "desc";

export interface PipelineStage {
  id: string;
  label: string;
  color: string;
  order: number;
}

export const DEFAULT_PIPELINE_STAGES: PipelineStage[] = [
  { id: "new", label: "New", color: "#B5B3AD", order: 0 },
  { id: "researching", label: "Researching", color: "#2D2D2D", order: 1 },
  { id: "contacted", label: "Contacted", color: "#1B4D3E", order: 2 },
  { id: "demo_scheduled", label: "Demo Scheduled", color: "#16a34a", order: 3 },
  { id: "passed", label: "Passed", color: "#dc2626", order: 4 },
];

export type CompanyStatus = string; // pipeline stage id

// ---------------------------------------------------------------------------
// DB anchor — what lives in Supabase (domain PK, lightweight)
// ---------------------------------------------------------------------------
export interface CompanyRecord {
  domain: string;
  name: string;
  firstViewedBy: string;
  firstViewedAt: string;
  lastViewedBy: string;
  lastViewedAt: string;
  source: string;
  noteCount: number;
  lastNoteAt: string | null;
  extractionCount: number;
  lastExtractionAt: string | null;
  excluded: boolean;
  excludedBy: string | null;
  excludedAt: string | null;
  exclusionReason: string | null;
  status: string;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  viewedBy: string | null;
}

// ---------------------------------------------------------------------------
// Enriched company — anchor + cached enrichment + computed ICP (UI display)
// ---------------------------------------------------------------------------
export interface CompanyEnriched {
  // Anchor fields
  domain: string;
  name: string;
  firstViewedBy: string;
  firstViewedAt: string;
  lastViewedBy: string;
  lastViewedAt: string;
  source: string;
  noteCount: number;
  lastNoteAt: string | null;
  extractionCount: number;
  lastExtractionAt: string | null;
  excluded: boolean;
  excludedBy: string | null;
  excludedAt: string | null;
  exclusionReason: string | null;
  status: string;
  statusChangedBy: string | null;
  statusChangedAt: string | null;
  viewedBy: string | null;

  // Cached enrichment (from Exa/Apollo/HubSpot via KV)
  industry: string;
  vertical: string;
  employeeCount: number;
  location: string;
  region: string;
  description: string;
  icpScore: number;
  hubspotStatus: HubSpotStatus;
  freshsalesStatus: FreshsalesStatus;
  freshsalesIntel: FreshsalesIntel | null;
  freshsalesAvailable?: boolean;
  sources: ResultSource[];
  signals: Signal[];
  contactCount: number;
  lastRefreshed: string;
  logoUrl?: string;
  revenue?: string;
  founded?: string;
  website?: string;
  phone?: string;
  aiSummary?: string;
  exactMatch?: boolean;
  icpBreakdown?: { factor: string; points: number; matched: boolean }[];
  exaRelevanceScore?: number;
}


/**
 * @deprecated Use CompanyEnriched instead. Kept as alias during migration.
 */
export type Company = CompanyEnriched;

// ---------------------------------------------------------------------------
// Contact extraction log — stored in DB
// ---------------------------------------------------------------------------
export interface ContactExtraction {
  id: string;
  companyDomain: string;
  extractedBy: string;
  extractedAt: string;
  destination: "clipboard" | "csv" | "clearout" | "apollo";
  contacts: ContactSnapshot[];
}

export interface ContactSnapshot {
  name: string;
  title: string;
  email: string | null;
  company: string;
}

// ---------------------------------------------------------------------------
// Contact — lives in cache only
// ---------------------------------------------------------------------------
export interface Contact {
  id: string;
  companyDomain: string;
  companyName: string;
  firstName: string;
  lastName: string;
  title: string;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  headline?: string | null;
  emailConfidence: number;
  confidenceLevel: ConfidenceLevel;
  sources: ResultSource[];
  seniority: "c_level" | "vp" | "director" | "manager" | "staff";
  lastVerified: string | null;
  fieldSources?: Partial<Record<"email" | "phone" | "title" | "linkedinUrl", ResultSource>>;
  crmStatus?: string;
  tags?: string[];
  freshsalesOwnerId?: number;
  freshsalesOwnerName?: string;
  verificationStatus?: "unverified" | "valid" | "valid_risky" | "invalid" | "unknown";
  safeToSend?: boolean;
}

export interface Signal {
  id: string;
  companyDomain: string;
  type: SignalType;
  title: string;
  description: string;
  date: string;
  sourceUrl: string | null;
  source: ResultSource;
}

export interface Exclusion {
  id: string;
  type: "company" | "domain" | "email" | "contact_id";
  value: string;
  reason?: string;
  addedBy: string;
  addedAt: string;
  source: "manual" | "csv_upload";
}

export interface SearchPreset {
  id: string;
  name: string;
  filters: FilterState;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface CompanyNote {
  id: string;
  companyDomain: string;
  content: string;
  authorName: string;
  createdAt: string;
  updatedAt: string | null;
  mentions: string[];
}

export interface FilterState {
  sources: ResultSource[];
  verticals: string[];
  regions: string[];
  sizes: SizeBucket[];
  signals: SignalType[];
  statuses: string[];
  hideExcluded: boolean;
  quickFilters: QuickFilter[];
}

export type SizeBucket = "1-50" | "51-200" | "201-1000" | "1000+";

export type ContactSortField = "seniority" | "email_confidence" | "icp_score" | "last_contacted";

export interface ContactTabFilters {
  seniority: string[];
  hasEmail: boolean;
  sources: string[];
  sortBy: ContactSortField;
}

export type QuickFilter =
  | "high_icp"
  | "has_signals"
  | "not_in_hubspot"
  | "not_in_freshsales"
  | "verified_email";

export interface IcpWeights {
  verticalMatch: number;
  sizeMatch: number;
  regionMatch: number;
  buyingSignals: number;
  negativeSignals: number;
  exaRelevance: number;
  hubspotLead: number;
  hubspotCustomer: number;
  freshsalesLead: number;
  freshsalesCustomer: number;
  freshsalesRecentContact: number;
  freshsalesTagBoost: number;
  freshsalesTagPenalty: number;
  freshsalesDealStalled: number;
}

export interface AnalyticsSettings {
  kpiTargets: { exportsThisWeek: number; avgIcpScore: number };
}

export interface EnrichmentLimits {
  maxSearchEnrich: number;
  maxContactAutoEnrich: number;
  maxClearoutFinds: number;
}

export interface IcpProfile {
  id: string;
  name: string;
  verticals: string[];
  sizeMin: number;
  sizeMax: number;
  regions: string[];
  signalTypes: string[];
  isDefault: boolean;
}

export interface AdminConfig {
  icpWeights: IcpWeights;
  verticals: string[];
  sizeSweetSpot: { min: number; max: number };
  signalTypes: { type: string; enabled: boolean }[];
  teamMembers: TeamMember[];
  cacheDurations: CacheDurations;
  copyFormats: CopyFormat[];
  defaultCopyFormat: string;
  apiKeys: ApiKeyEntry[];
  dataSources: CustomDataSource[];
  exportSettings: ExportSettings;
  emailVerification: EmailVerificationSettings;
  scoringSettings: ScoringSettings;
  rateLimits: RateLimitSettings;
  notifications: NotificationSettings;
  dataRetention: DataRetentionSettings;
  authSettings: AuthSettings;
  uiPreferences: AdminUiPreferences;
  emailPrompts: EmailPromptsConfig;
  analyticsSettings: AnalyticsSettings;
  freshsalesSettings: FreshsalesSettings;
  enrichmentLimits: EnrichmentLimits;
  icpProfiles: IcpProfile[];
  authLog: AuthLogEntry[];
  authRequests: AuthAccessRequest[];
  // Multi-channel outreach (Section 1)
  outreachChannelConfig: {
    enabledChannels: OutreachChannel[];
    defaultChannel: OutreachChannel;
    channelInstructions: Partial<Record<OutreachChannel, string>>;
    writingRulesDefault: string;
  };
  // Smart template suggestion rules (Section 2)
  outreachSuggestionRules: { id: string; name: string; enabled: boolean }[];
  // Recommended next action rules (Section 3)
  actionRecommendationRules: { id: string; name: string; enabled: boolean }[];
  actionRecommendationEnabled: boolean;
}

export interface TeamMember {
  name: string;
  email: string;
  isAdmin: boolean;
  lastLoginAt?: string;
  lastMentionReadAt?: string;
}

export interface AuthLogEntry {
  action: string;
  actor: string;
  target: string;
  timestamp: string;
}

export interface AuthAccessRequest {
  email: string;
  name: string;
  requestedAt: string;
}

export interface CacheDurations {
  exa: number;
  apollo: number;
  hubspot: number;
  clearout: number;
  freshsales: number;
}

export interface CopyFormat {
  id: string;
  name: string;
  template: string;
}

export interface UserSettings {
  userName: string;
  defaultCopyFormat: string;
  defaultView: ViewMode;
  defaultSort: { field: SortField; direction: SortDirection };
  recentDomains: string[];
}

export interface SearchHistoryEntry {
  id: string;
  userId: string;
  filters: FilterState;
  resultCount: number;
  timestamp: string;
  label?: string;
}

export type ToastType = "success" | "info" | "warning" | "error";
export type ToastVariant = "standard" | "progress" | "undo";
export type ToastPhase = "entering" | "visible" | "exiting";

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  variant: ToastVariant;
  phase: ToastPhase;
  action?: { label: string; onClick: () => void };
  duration?: number; // 0 = persistent
  progress?: {
    status: "loading" | "resolved" | "rejected";
    loadingMessage: string;
    resolvedMessage?: string;
    rejectedMessage?: string;
  };
  undoAction?: () => void;
  undoDeadline?: number;
  dedupKey?: string;
  count?: number;
  createdAt: number;
}

export interface ProgressToastHandle {
  resolve: (msg?: string) => void;
  reject: (msg?: string) => void;
}

export interface InlineFeedback {
  id: string;
  message: string;
  type: "success" | "error";
  phase: ToastPhase;
}

export interface ExportFlowState {
  step: "picking" | "verify" | "exporting" | "done" | "error";
  contactIds: string[];
  verificationResults: Map<string, VerificationResult>;
  verifiedCount: number;
  totalCount: number;
  errorMessage?: string;
  mode: "csv" | "clipboard" | "excel";
}

export interface VerificationResult {
  email: string;
  status: "valid" | "invalid" | "unknown";
  score: number;
}

// ---------------------------------------------------------------------------
// API Key Management
// ---------------------------------------------------------------------------

export interface ApiKeyEntry {
  id: string;
  source: string; // 'exa' | 'apollo' | 'hubspot' | 'clearout' | custom
  label: string;
  encryptedKey: string; // AES-256-GCM encrypted
  iv: string;
  lastRotated: string;
  lastTested: string | null;
  testStatus: "success" | "failed" | "untested";
  addedBy: string;
}

export interface ApiKeyAuditEntry {
  id: string;
  sourceId: string;
  action: "created" | "rotated" | "tested" | "deleted";
  actor: string;
  result: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Custom Data Sources
// ---------------------------------------------------------------------------

export interface CustomDataSource {
  id: string;
  name: string;
  type: "rest" | "graphql";
  baseUrl: string;
  authType: "api_key" | "bearer" | "basic" | "none";
  apiKeyRef: string; // references ApiKeyEntry.id
  enabled: boolean;
  endpoints: DataSourceEndpoint[];
  fieldMapping: FieldMapping[];
  rateLimitPerMin: number;
  cacheTtlMinutes: number;
  addedBy: string;
  addedAt: string;
}

export interface DataSourceEndpoint {
  id: string;
  name: string; // 'search' | 'company' | 'contacts' | 'signals'
  method: "GET" | "POST";
  path: string;
  headers: Record<string, string>;
  bodyTemplate: string; // JSON template with {{param}} placeholders
}

export interface FieldMapping {
  sourceField: string; // JSONPath expression: $.results[*].name
  targetField: string; // our field: company.name
  transform?: "lowercase" | "uppercase" | "trim" | "parseInt" | "parseDate" | null;
}

// ---------------------------------------------------------------------------
// Settings Sections
// ---------------------------------------------------------------------------

export interface ExportSettings {
  defaultFormat: "csv" | "clipboard";
  csvColumns: string[];
  confidenceThreshold: number; // min confidence % to include in export
  autoVerifyOnExport: boolean;
  includeCompanyContext: boolean;
}

export interface EmailVerificationSettings {
  clearoutThreshold: number; // min score to consider "verified" (0-100)
  autoVerifyAboveConfidence: number; // auto-verify if Apollo confidence > X
  dailyMaxVerifications: number;
  verifyOnContactLoad: boolean;
  emailFinderEnabled: boolean;
  emailFinderMaxPerBatch: number;
  emailFinderMinConfidenceToSkip: number;
}

export interface ScoringSettings {
  displayThreshold: number; // min ICP score to show on cards (0-100)
  perSourceConfidence: Record<string, number>; // { exa: 80, apollo: 90, hubspot: 85 }
  stalenessDecayDays: number;
  stalenessDecayPercent: number; // % penalty per decay period
}

export interface RateLimitSettings {
  perSource: Record<string, { maxPerMin: number; warningAt: number }>;
  slackWebhookUrl: string | null;
  alertRecipients: string[];
}

export interface NotificationSettings {
  dailyDigest: boolean;
  digestRecipients: string[];
  slackWebhookUrl: string | null;
  alertOnRateLimit: boolean;
  alertOnKeyExpiry: boolean;
}

export interface DataRetentionSettings {
  cachePurgeIntervalHours: number;
  searchHistoryRetentionDays: number;
  extractionLogRetentionDays: number;
  autoPurge: boolean;
}

export interface AuthSettings {
  sessionTimeoutMinutes: number;
  welcomeMessage: string;
  sessionDurationDays: number;
  magicLinkExpiryMinutes: number;
  teamsWebhookUrl?: string;
}

// ---------------------------------------------------------------------------
// Email Draft (LLM-powered)
// ---------------------------------------------------------------------------

export type EmailTone = "formal" | "casual" | "direct";

export type EmailTemplate = "intro" | "follow_up" | "re_engagement";

export interface EmailDraftRequest {
  contactName: string;
  contactTitle: string;
  companyName: string;
  companyIndustry: string;
  signals: Signal[];
  hubspotStatus: HubSpotStatus;
  template?: EmailTemplate;
  tone: EmailTone;
  // Richer context (Item 5)
  contactHeadline?: string;
  contactSeniority?: string;
  icpScore?: number;
  icpBreakdown?: { factor: string; points: number; matched: boolean }[];
  freshsalesStatus?: string;
  freshsalesDealStage?: string;
  freshsalesDealAmount?: number;
  customTemplateId?: string;
}

export interface EmailDraftResponse {
  subject: string;
  body: string;
}

// ---------------------------------------------------------------------------
// Multi-Channel Outreach
// ---------------------------------------------------------------------------

export type OutreachChannel = "email" | "linkedin_connect" | "linkedin_inmail" | "whatsapp";

export interface ChannelConstraints {
  maxChars: number | null; // null = no limit
  maxWords: number | null;
  hasSubject: boolean;
  outputFields: ("subject" | "message")[];
  platformGuidance: string;
}

export interface OutreachDraftRequest extends EmailDraftRequest {
  channel: OutreachChannel;
  contactId?: string;
  writingRules?: string;
  contextPlaceholders?: Record<string, string>;
}

export interface OutreachDraftResponse {
  channel: OutreachChannel;
  subject?: string;
  message: string;
}

// ---------------------------------------------------------------------------
// Chatbot Config (admin-configurable)
// ---------------------------------------------------------------------------

export interface ChatbotConfig {
  enabled: boolean;
  systemPrompt: string;
  appHelpContext: string;
  companyAnalysisPrompt: string;
  customInstructions: string;
  greeting: string;
  maxHistoryMessages: number;
  temperature: number;
}

export const DEFAULT_CHATBOT_CONFIG: ChatbotConfig = {
  enabled: true,
  systemPrompt: `You are myRA Assistant, a helpful chatbot embedded in the myRA Sales Navigator tool. You help the sales team with:
1. How to use the app (searching, filtering, exporting, pipeline stages, etc.)
2. Answering questions about companies using their dossier data
3. General sales prospecting advice

Be concise and practical. Use markdown for formatting.`,
  appHelpContext: `myRA Sales Navigator features:
- Search: Use the search bar or Cmd+K for semantic search powered by Exa
- Filters: Vertical, Region, Company Size, Signals, Status in the left panel
- Pipeline Stages: Track companies through New -> Researching -> Contacted -> Demo Scheduled -> Passed
- Export: Select companies/contacts, then Copy or CSV export. Email verification runs on export.
- Exclusions: Mark companies as excluded to hide them from results
- Presets: Save filter combinations as team-shared presets
- Notes: Add notes to companies visible to the whole team
- Bulk Actions: Select multiple companies to exclude, set status, or add notes in bulk
- Keyboard: Cmd+K (search), Arrow keys (navigate), Space (select), Cmd+E (export)
- Admin: /admin page for ICP weights, pipeline stages, API keys, and more`,
  companyAnalysisPrompt: "When asked about a specific company, use the provided dossier data including signals, contacts, ICP score, and HubSpot status to give actionable insights.",
  customInstructions: "",
  greeting: "Hi! I can help you navigate the app or analyze companies. What do you need?",
  maxHistoryMessages: 20,
  temperature: 0.4,
};

// ---------------------------------------------------------------------------
// Admin UI Preferences
// ---------------------------------------------------------------------------

export interface AdminUiPreferences {
  defaultPanelWidths: { left: number; right: number };
  defaultViewMode: ViewMode;
  autoRefreshIntervalMin: number; // 0 = disabled
  showConfidenceBadges: boolean;
  compactMode: boolean;
}

// ---------------------------------------------------------------------------
// Email Prompts Config (admin-configurable)
// ---------------------------------------------------------------------------

export interface CustomEmailTemplate {
  id: string;
  name: string;
  tone: EmailTone;
  type: EmailTemplate | "custom";
  promptSuffix: string;
  exampleOutput?: string;
}

export interface EmailPromptsConfig {
  companyDescription: string;
  valueProposition: string;
  toneInstructions: Record<EmailTone, string>;
  templateInstructions: Record<EmailTemplate, string>;
  systemPromptSuffix: string;
  defaultTone: EmailTone;
  defaultTemplate: EmailTemplate;
  customTemplates?: CustomEmailTemplate[];
}

// ---------------------------------------------------------------------------
// Extracted Entities from NL search (for editable chips)
// ---------------------------------------------------------------------------

export interface ExtractedEntities {
  verticals: string[];
  regions: string[];
  signals: string[];
}
