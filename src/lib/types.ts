export type ResultSource = "exa" | "apollo" | "hubspot";

export type HubSpotStatus =
  | "new"
  | "open"
  | "in_progress"
  | "closed_won"
  | "closed_lost"
  | "none";

export type SignalType = "hiring" | "funding" | "expansion" | "news";

export type ConfidenceLevel = "high" | "medium" | "low" | "none";

export type ViewMode = "companies" | "contacts";

export type SortField = "icp_score" | "name" | "employee_count" | "relevance";

export type SortDirection = "asc" | "desc";

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

  // Cached enrichment (from Exa/Apollo/HubSpot via KV)
  industry: string;
  vertical: string;
  employeeCount: number;
  location: string;
  region: string;
  description: string;
  icpScore: number;
  hubspotStatus: HubSpotStatus;
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
  emailConfidence: number;
  confidenceLevel: ConfidenceLevel;
  sources: ResultSource[];
  seniority: "c_level" | "vp" | "director" | "manager" | "staff";
  lastVerified: string | null;
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
  type: "company" | "domain" | "email";
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
  hideExcluded: boolean;
  quickFilters: QuickFilter[];
}

export type SizeBucket = "1-50" | "51-200" | "201-1000" | "1000+";

export type QuickFilter =
  | "high_icp"
  | "has_signals"
  | "not_in_hubspot"
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
}

export interface AnalyticsSettings {
  kpiTargets: { exportsThisWeek: number; avgIcpScore: number };
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
  authLog: AuthLogEntry[];
  authRequests: AuthAccessRequest[];
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
  mode: "csv" | "clipboard";
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
}

export interface EmailDraftResponse {
  subject: string;
  body: string;
}

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

export interface EmailPromptsConfig {
  companyDescription: string;
  valueProposition: string;
  toneInstructions: Record<EmailTone, string>;
  templateInstructions: Record<EmailTemplate, string>;
  systemPromptSuffix: string;
  defaultTone: EmailTone;
  defaultTemplate: EmailTemplate;
}
