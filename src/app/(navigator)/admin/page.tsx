"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useAuth } from "@/providers/AuthProvider";
import { useState, useEffect, useCallback, useRef } from "react";
import { AdminTabs, ADMIN_TABS } from "@/components/navigator/admin/AdminTabs";
import { AdminSaveBar } from "@/components/navigator/admin/AdminSaveBar";
import { useStore } from "@/lib/navigator/store";
import { cn } from "@/lib/cn";

// Lazy-loaded admin section components — only loaded when their tab is active
const IcpWeightsSection = dynamic(() => import("@/components/navigator/admin/IcpWeightsSection").then((m) => ({ default: m.IcpWeightsSection })));
const VerticalConfigSection = dynamic(() => import("@/components/navigator/admin/VerticalConfigSection").then((m) => ({ default: m.VerticalConfigSection })));
const SizeSweetSpotSection = dynamic(() => import("@/components/navigator/admin/SizeSweetSpotSection").then((m) => ({ default: m.SizeSweetSpotSection })));
const SignalTypesSection = dynamic(() => import("@/components/navigator/admin/SignalTypesSection").then((m) => ({ default: m.SignalTypesSection })));
const TeamMembersSection = dynamic(() => import("@/components/navigator/admin/TeamMembersSection").then((m) => ({ default: m.TeamMembersSection })));
const CacheSettingsSection = dynamic(() => import("@/components/navigator/admin/CacheSettingsSection").then((m) => ({ default: m.CacheSettingsSection })));
const CopyFormatSection = dynamic(() => import("@/components/navigator/admin/CopyFormatSection").then((m) => ({ default: m.CopyFormatSection })));
const ExclusionManagerSection = dynamic(() => import("@/components/navigator/admin/ExclusionManagerSection").then((m) => ({ default: m.ExclusionManagerSection })));
const PresetManagerSection = dynamic(() => import("@/components/navigator/admin/PresetManagerSection").then((m) => ({ default: m.PresetManagerSection })));
const ApiKeysSection = dynamic(() => import("@/components/navigator/admin/ApiKeysSection").then((m) => ({ default: m.ApiKeysSection })));
const DataSourcesSection = dynamic(() => import("@/components/navigator/admin/DataSourcesSection").then((m) => ({ default: m.DataSourcesSection })));
const ExportSettingsSection = dynamic(() => import("@/components/navigator/admin/ExportSettingsSection").then((m) => ({ default: m.ExportSettingsSection })));
const EmailVerificationSection = dynamic(() => import("@/components/navigator/admin/EmailVerificationSection").then((m) => ({ default: m.EmailVerificationSection })));
const ScoringTuningSection = dynamic(() => import("@/components/navigator/admin/ScoringTuningSection").then((m) => ({ default: m.ScoringTuningSection })));
const RateLimitSection = dynamic(() => import("@/components/navigator/admin/RateLimitSection").then((m) => ({ default: m.RateLimitSection })));
const NotificationSection = dynamic(() => import("@/components/navigator/admin/NotificationSection").then((m) => ({ default: m.NotificationSection })));
const DataRetentionSection = dynamic(() => import("@/components/navigator/admin/DataRetentionSection").then((m) => ({ default: m.DataRetentionSection })));
const AuthSettingsSection = dynamic(() => import("@/components/navigator/admin/AuthSettingsSection").then((m) => ({ default: m.AuthSettingsSection })));
const AuthActivityLog = dynamic(() => import("@/components/navigator/admin/AuthActivityLog").then((m) => ({ default: m.AuthActivityLog })));
const UiPreferencesSection = dynamic(() => import("@/components/navigator/admin/UiPreferencesSection").then((m) => ({ default: m.UiPreferencesSection })));
const EmailPromptsSection = dynamic(() => import("@/components/navigator/admin/EmailPromptsSection").then((m) => ({ default: m.EmailPromptsSection })));
const EmailTemplatesSection = dynamic(() => import("@/components/navigator/admin/EmailTemplatesSection").then((m) => ({ default: m.EmailTemplatesSection })));
const OutreachChannelsSection = dynamic(() => import("@/components/navigator/admin/OutreachChannelsSection").then((m) => ({ default: m.OutreachChannelsSection })));
const OutreachSuggestionsSection = dynamic(() => import("@/components/navigator/admin/OutreachSuggestionsSection").then((m) => ({ default: m.OutreachSuggestionsSection })));
const ActionRecommendationsSection = dynamic(() => import("@/components/navigator/admin/ActionRecommendationsSection").then((m) => ({ default: m.ActionRecommendationsSection })));
const PipelineStagesSection = dynamic(() => import("@/components/navigator/admin/PipelineStagesSection").then((m) => ({ default: m.PipelineStagesSection })));
const ChatbotConfigSection = dynamic(() => import("@/components/navigator/admin/ChatbotConfigSection").then((m) => ({ default: m.ChatbotConfigSection })));
const FreshsalesSettingsSection = dynamic(() => import("@/components/navigator/admin/FreshsalesSettingsSection").then((m) => ({ default: m.FreshsalesSettingsSection })));
const EnrichmentConfigSection = dynamic(() => import("@/components/navigator/admin/EnrichmentConfigSection").then((m) => ({ default: m.EnrichmentConfigSection })));
const UserActivitySection = dynamic(() => import("@/components/navigator/admin/UserActivitySection").then((m) => ({ default: m.UserActivitySection })));
const IcpProfilesSection = dynamic(() => import("@/components/navigator/admin/IcpProfilesSection").then((m) => ({ default: m.IcpProfilesSection })));

// Analytics dashboard — lazy-loaded
const WeeklyKpiCards = dynamic(() => import("@/components/navigator/admin/analytics/WeeklyKpiCards").then((m) => ({ default: m.WeeklyKpiCards })));
const DiscoveryFunnel = dynamic(() => import("@/components/navigator/admin/analytics/DiscoveryFunnel").then((m) => ({ default: m.DiscoveryFunnel })));
const TeamActivity = dynamic(() => import("@/components/navigator/admin/analytics/TeamActivity").then((m) => ({ default: m.TeamActivity })));
const SourcePerformance = dynamic(() => import("@/components/navigator/admin/analytics/SourcePerformance").then((m) => ({ default: m.SourcePerformance })));
const FilterHeatmap = dynamic(() => import("@/components/navigator/admin/analytics/FilterHeatmap").then((m) => ({ default: m.FilterHeatmap })));
const ExclusionInsights = dynamic(() => import("@/components/navigator/admin/analytics/ExclusionInsights").then((m) => ({ default: m.ExclusionInsights })));
const DateRangeSelector = dynamic(() => import("@/components/navigator/admin/analytics/DateRangeSelector").then((m) => ({ default: m.DateRangeSelector })));
const KpiTargetEditor = dynamic(() => import("@/components/navigator/admin/analytics/KpiTargetEditor").then((m) => ({ default: m.KpiTargetEditor })));
const HealthDashboard = dynamic(() => import("@/components/navigator/admin/health/HealthDashboard").then((m) => ({ default: m.HealthDashboard })));
const UsageAnalytics = dynamic(() => import("@/components/navigator/admin/analytics/UsageAnalytics").then((m) => ({ default: m.UsageAnalytics })));
const RelevanceInsightsSection = dynamic(() => import("@/components/navigator/admin/RelevanceInsightsSection").then((m) => ({ default: m.RelevanceInsightsSection })));

function getTabFromHash(): string {
  if (typeof window === "undefined") return "general";
  const hash = window.location.hash.replace("#", "");
  return ADMIN_TABS.some((t) => t.id === hash) ? hash : "general";
}

function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface AnalyticsDashboard {
  kpis: { exportsThisWeek: number; prospectsDiscovered: number; activeUsers: number; avgIcpScore: number };
  kpiTargets?: { exportsThisWeek: number; avgIcpScore: number };
  funnel: { searches: number; companiesViewed: number; contactsExtracted: number };
  teamActivity: { name: string; searches: number; exports: number; notes: number; companiesViewed: number; lastActive: string }[];
  sourcePerformance: { source: string; companies: number; avgIcp: number; contacts: number; extractionRate: number }[];
  filterHeatmap: { verticals: Record<string, number>; regions: Record<string, number> };
  exclusions: { byType: Record<string, number>; topReasons: { reason: string; count: number }[]; bySource: Record<string, number>; recent: { type: string; value: string; reason: string | null; addedBy: string | null; addedAt: string }[] };
}

export default function AdminPage() {
  const { userName, isAdmin, isLoading } = useAuth();
  const [activeTab, setActiveTab] = useState(() => getTabFromHash());
  const [analytics, setAnalytics] = useState<AnalyticsDashboard | null>(null);
  const [dateRange, setDateRange] = useState({ from: daysAgoISO(7), to: todayISO() });
  const [savingTargets, setSavingTargets] = useState(false);
  const [saving, setSaving] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [adminSearch, setAdminSearch] = useState("");

  const adminConfig = useStore((s) => s.adminConfig);
  const setAdminConfig = useStore((s) => s.setAdminConfig);
  const saveAdminConfig = useStore((s) => s.saveAdminConfig);

  // Snapshot for dirty detection
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const initializedRef = useRef(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const autoSavingRef = useRef(false);
  const autoSaveFadeRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!initializedRef.current && adminConfig) {
      setSavedSnapshot(JSON.stringify(adminConfig));
      initializedRef.current = true;
    }
  }, [adminConfig]);

  const isDirty = savedSnapshot !== null && JSON.stringify(adminConfig) !== savedSnapshot;

  // Auto-save: debounce 2s after dirty state changes
  useEffect(() => {
    if (!isDirty || autoSavingRef.current) return;
    clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      autoSavingRef.current = true;
      setAutoSaveStatus("saving");
      saveAdminConfig()
        .then(() => {
          setSavedSnapshot(JSON.stringify(useStore.getState().adminConfig));
          setAutoSaveStatus("saved");
          clearTimeout(autoSaveFadeRef.current);
          autoSaveFadeRef.current = setTimeout(() => setAutoSaveStatus("idle"), 2000);
        })
        .catch(() => {
          setAutoSaveStatus("idle");
        })
        .finally(() => {
          autoSavingRef.current = false;
        });
    }, 2000);
    return () => clearTimeout(autoSaveTimerRef.current);
  }, [isDirty, saveAdminConfig]);

  const handleSave = async () => {
    clearTimeout(autoSaveTimerRef.current);
    setSaving(true);
    try {
      await saveAdminConfig();
      setSavedSnapshot(JSON.stringify(adminConfig));
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = () => {
    clearTimeout(autoSaveTimerRef.current);
    if (savedSnapshot) {
      setAdminConfig(JSON.parse(savedSnapshot));
    }
  };

  useEffect(() => {
    const onHash = () => setActiveTab(getTabFromHash());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const fetchAnalytics = useCallback((range: { from: string; to: string }) => {
    const params = new URLSearchParams({ from: range.from, to: range.to });
    fetch(`/api/analytics/dashboard?${params}`)
      .then((r) => r.json())
      .then((d) => setAnalytics(d))
      .catch(() => setAnalytics(null));
  }, []);

  useEffect(() => {
    if (activeTab !== "analytics") return;
    fetchAnalytics(dateRange);
  }, [activeTab, dateRange, fetchAnalytics]);

  const handleDateRangeChange = (range: { from: string; to: string }) => {
    setDateRange(range);
  };

  const handleSaveTargets = async (targets: { exportsThisWeek: number; avgIcpScore: number }) => {
    setSavingTargets(true);
    try {
      await fetch("/api/admin/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyticsSettings: { kpiTargets: targets } }),
      });
      fetchAnalytics(dateRange);
    } finally {
      setSavingTargets(false);
    }
  };

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    window.location.hash = tabId;
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="text-center">
          <div className="shimmer mx-auto h-8 w-32 rounded-card" />
          <p className="mt-3 text-sm text-text-tertiary">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-0">
        <div className="text-center">
          <h1 className="font-display text-xl text-text-primary">Access Denied</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Admin access is restricted. Contact Adi or JVS for access.
          </p>
          <Link href="/" className="mt-4 inline-block text-sm text-accent-primary hover:text-accent-primary-hover">
            &larr; Back to Navigator
          </Link>
        </div>
      </div>
    );
  }

  const activeTabDef = ADMIN_TABS.find((t) => t.id === activeTab);
  const kpiTargets = analytics?.kpiTargets ?? { exportsThisWeek: 20, avgIcpScore: 60 };

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-8">
      <div className={cn("mx-auto", activeTab === "analytics" ? "max-w-6xl" : "max-w-4xl")}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="font-display text-2xl text-text-primary">Admin Settings</h1>
              {autoSaveStatus === "saving" && (
                <span className="flex items-center gap-1.5 text-xs text-text-tertiary">
                  <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-surface-3 border-t-accent-primary" />
                  Saving...
                </span>
              )}
              {autoSaveStatus === "saved" && (
                <span className="text-xs text-success transition-opacity duration-300">
                  Auto-saved
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-text-secondary">Logged in as {userName}</p>
          </div>
          <Link href="/" className="rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover">
            &larr; Back to Navigator
          </Link>
        </div>

        {/* Search input */}
        <div className="mb-4">
          <input
            type="text"
            value={adminSearch}
            onChange={(e) => setAdminSearch(e.target.value)}
            placeholder="Search settings..."
            className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          />
        </div>

        {!adminSearch && <AdminTabs activeTab={activeTab} onTabChange={handleTabChange} />}

        {!adminSearch && activeTabDef && activeTab !== "analytics" && (
          <p className="mb-4 text-sm text-text-secondary">{activeTabDef.description}</p>
        )}

        <div className={cn("space-y-6", isDirty && "pb-16")}>
          {adminSearch ? (
            <AdminSearchResults query={adminSearch} />
          ) : (
            <>
              {activeTab === "general" && (
                <>
                  <EnrichmentConfigSection />
                  <IcpProfilesSection />
                  <IcpWeightsSection />
                  <VerticalConfigSection />
                  <SizeSweetSpotSection />
                  <SignalTypesSection />
                  <TeamMembersSection />
                  <ExclusionManagerSection />
                  <PresetManagerSection />
                </>
              )}
              {activeTab === "pipeline" && (
                <>
                  <PipelineStagesSection />
                  <ScoringTuningSection />
                  <EmailVerificationSection />
                  <ExportSettingsSection />
                  <CopyFormatSection />
                </>
              )}
              {activeTab === "system" && (
                <>
                  <RateLimitSection />
                  <FreshsalesSettingsSection />
                  <DataRetentionSection />
                  <NotificationSection />
                  <CacheSettingsSection />
                </>
              )}
              {activeTab === "api-keys" && <ApiKeysSection />}
              {activeTab === "auth" && (
                <>
                  <AuthSettingsSection />
                  <AuthActivityLog />
                </>
              )}
              {activeTab === "email-prompts" && (
                <>
                  <EmailPromptsSection />
                  <EmailTemplatesSection />
                  <OutreachChannelsSection />
                  <OutreachSuggestionsSection />
                  <ActionRecommendationsSection />
                </>
              )}
              {activeTab === "ui" && (
                <>
                  <UiPreferencesSection />
                  <DataSourcesSection />
                  <ChatbotConfigSection />
                </>
              )}
              {activeTab === "health" && <HealthDashboard />}
          {activeTab === "analytics" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <DateRangeSelector value={dateRange} onChange={handleDateRangeChange} />
                <KpiTargetEditor
                  targets={kpiTargets}
                  onSave={handleSaveTargets}
                  saving={savingTargets}
                />
              </div>
              <UserActivitySection />
              <WeeklyKpiCards data={analytics?.kpis ?? null} targets={kpiTargets} />
              <DiscoveryFunnel data={analytics?.funnel ?? null} />
              <TeamActivity data={analytics?.teamActivity ?? null} />
              <SourcePerformance data={analytics?.sourcePerformance ?? null} />
              <FilterHeatmap data={analytics?.filterHeatmap ?? null} />
              <ExclusionInsights data={analytics?.exclusions ?? null} />
              <UsageAnalytics />
              <RelevanceInsightsSection
                dateRange={Math.max(
                  1,
                  Math.round(
                    (new Date(dateRange.to).getTime() -
                      new Date(dateRange.from).getTime()) /
                      86400000
                  )
                )}
              />
            </>
          )}
            </>
          )}
        </div>
      </div>

      <AdminSaveBar
        isDirty={isDirty}
        onSave={handleSave}
        onDiscard={handleDiscard}
        saving={saving}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Admin search index & results component
// ---------------------------------------------------------------------------

interface AdminSearchEntry {
  component: React.ComponentType;
  tab: string;
  keywords: string[];
}

const ADMIN_SEARCH_INDEX: AdminSearchEntry[] = [
  { component: EnrichmentConfigSection, tab: "General", keywords: ["enrichment", "apollo", "clearout", "enrich", "contacts", "limit", "batch"] },
  { component: IcpProfilesSection, tab: "General", keywords: ["icp", "profile", "ideal", "customer"] },
  { component: IcpWeightsSection, tab: "General", keywords: ["icp", "scoring", "weights", "vertical", "size", "region", "signals", "freshsales", "hubspot"] },
  { component: VerticalConfigSection, tab: "General", keywords: ["vertical", "industry", "verticals", "match"] },
  { component: SizeSweetSpotSection, tab: "General", keywords: ["size", "sweet spot", "employee", "headcount", "company size"] },
  { component: SignalTypesSection, tab: "General", keywords: ["signal", "signals", "hiring", "funding", "expansion", "news"] },
  { component: TeamMembersSection, tab: "General", keywords: ["team", "members", "users", "people", "admin"] },
  { component: ExclusionManagerSection, tab: "General", keywords: ["exclusion", "exclude", "block", "csv", "domain", "company", "email"] },
  { component: PresetManagerSection, tab: "General", keywords: ["preset", "saved", "search", "filter", "presets"] },
  { component: PipelineStagesSection, tab: "Pipeline", keywords: ["pipeline", "stages", "status", "workflow", "kanban"] },
  { component: ScoringTuningSection, tab: "Pipeline", keywords: ["scoring", "tuning", "calibration", "score"] },
  { component: EmailVerificationSection, tab: "Pipeline", keywords: ["email", "verification", "clearout", "verify", "bounce"] },
  { component: ExportSettingsSection, tab: "Pipeline", keywords: ["export", "csv", "excel", "clipboard", "download"] },
  { component: CopyFormatSection, tab: "Pipeline", keywords: ["copy", "format", "clipboard", "template"] },
  { component: RateLimitSection, tab: "System", keywords: ["rate", "limit", "throttle", "api", "requests"] },
  { component: FreshsalesSettingsSection, tab: "System", keywords: ["freshsales", "crm", "domain", "api"] },
  { component: DataRetentionSection, tab: "System", keywords: ["data", "retention", "cleanup", "delete", "purge"] },
  { component: NotificationSection, tab: "System", keywords: ["notification", "notifications", "teams", "webhook", "alert"] },
  { component: CacheSettingsSection, tab: "System", keywords: ["cache", "ttl", "duration", "refresh", "stale"] },
  { component: ApiKeysSection, tab: "API Keys", keywords: ["api", "key", "keys", "exa", "apollo", "hubspot", "clearout", "groq", "gemini"] },
  { component: AuthSettingsSection, tab: "Auth", keywords: ["auth", "password", "authentication", "login", "access"] },
  { component: AuthActivityLog, tab: "Auth", keywords: ["auth", "activity", "log", "login", "session"] },
  { component: EmailPromptsSection, tab: "Email Prompts", keywords: ["email", "prompt", "llm", "tone", "writing"] },
  { component: EmailTemplatesSection, tab: "Email Prompts", keywords: ["email", "template", "templates", "draft"] },
  { component: OutreachChannelsSection, tab: "Email Prompts", keywords: ["outreach", "channel", "channels", "linkedin", "call", "whatsapp"] },
  { component: OutreachSuggestionsSection, tab: "Email Prompts", keywords: ["outreach", "suggestion", "suggestions", "rules", "recommend"] },
  { component: ActionRecommendationsSection, tab: "Email Prompts", keywords: ["action", "recommendation", "recommendations", "next", "suggest"] },
  { component: UiPreferencesSection, tab: "UI", keywords: ["ui", "preferences", "panel", "width", "view", "display"] },
  { component: DataSourcesSection, tab: "UI", keywords: ["data", "source", "sources", "provider", "custom"] },
  { component: ChatbotConfigSection, tab: "UI", keywords: ["chatbot", "chat", "assistant", "ai", "copilot"] },
];

function AdminSearchResults({ query }: { query: string }) {
  const lowerQuery = query.toLowerCase();
  const matches = ADMIN_SEARCH_INDEX.filter((entry) =>
    entry.keywords.some((kw) => kw.includes(lowerQuery))
  );

  if (matches.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-text-tertiary">
        No settings matching &ldquo;{query}&rdquo;
      </p>
    );
  }

  // Group matches by tab
  const grouped = new Map<string, AdminSearchEntry[]>();
  for (const m of matches) {
    const existing = grouped.get(m.tab) ?? [];
    existing.push(m);
    grouped.set(m.tab, existing);
  }

  return (
    <>
      {[...grouped.entries()].map(([tab, entries]) => (
        <div key={tab}>
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
            {tab}
          </p>
          <div className="space-y-4">
            {entries.map((entry, i) => {
              const Component = entry.component;
              return <Component key={i} />;
            })}
          </div>
        </div>
      ))}
    </>
  );
}
