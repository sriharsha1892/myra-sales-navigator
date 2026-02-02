"use client";

import Link from "next/link";
import { useAuth } from "@/providers/AuthProvider";
import { useState, useEffect, useCallback } from "react";
import { AdminTabs, ADMIN_TABS } from "@/components/admin/AdminTabs";
import { cn } from "@/lib/cn";

// Existing sections
import { IcpWeightsSection } from "@/components/admin/IcpWeightsSection";
import { VerticalConfigSection } from "@/components/admin/VerticalConfigSection";
import { SizeSweetSpotSection } from "@/components/admin/SizeSweetSpotSection";
import { SignalTypesSection } from "@/components/admin/SignalTypesSection";
import { TeamMembersSection } from "@/components/admin/TeamMembersSection";
import { CacheSettingsSection } from "@/components/admin/CacheSettingsSection";
import { CopyFormatSection } from "@/components/admin/CopyFormatSection";
import { ExclusionManagerSection } from "@/components/admin/ExclusionManagerSection";
import { PresetManagerSection } from "@/components/admin/PresetManagerSection";

// New sections
import { ApiKeysSection } from "@/components/admin/ApiKeysSection";
import { DataSourcesSection } from "@/components/admin/DataSourcesSection";
import { ExportSettingsSection } from "@/components/admin/ExportSettingsSection";
import { EmailVerificationSection } from "@/components/admin/EmailVerificationSection";
import { ScoringTuningSection } from "@/components/admin/ScoringTuningSection";
import { RateLimitSection } from "@/components/admin/RateLimitSection";
import { NotificationSection } from "@/components/admin/NotificationSection";
import { DataRetentionSection } from "@/components/admin/DataRetentionSection";
import { AuthSettingsSection } from "@/components/admin/AuthSettingsSection";
import { AuthActivityLog } from "@/components/admin/AuthActivityLog";
import { UiPreferencesSection } from "@/components/admin/UiPreferencesSection";
import { EmailPromptsSection } from "@/components/admin/EmailPromptsSection";

// Analytics dashboard
import { WeeklyKpiCards } from "@/components/admin/analytics/WeeklyKpiCards";
import { DiscoveryFunnel } from "@/components/admin/analytics/DiscoveryFunnel";
import { TeamActivity } from "@/components/admin/analytics/TeamActivity";
import { SourcePerformance } from "@/components/admin/analytics/SourcePerformance";
import { FilterHeatmap } from "@/components/admin/analytics/FilterHeatmap";
import { ExclusionInsights } from "@/components/admin/analytics/ExclusionInsights";
import { DateRangeSelector } from "@/components/admin/analytics/DateRangeSelector";
import { KpiTargetEditor } from "@/components/admin/analytics/KpiTargetEditor";

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
      // Re-fetch analytics to get updated targets
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

  const kpiTargets = analytics?.kpiTargets ?? { exportsThisWeek: 20, avgIcpScore: 60 };

  return (
    <div className="min-h-screen bg-surface-0 px-6 py-8">
      <div className={cn("mx-auto", activeTab === "analytics" ? "max-w-6xl" : "max-w-4xl")}>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl text-text-primary">Admin Settings</h1>
            <p className="mt-1 text-sm text-text-secondary">Logged in as {userName}</p>
          </div>
          <Link href="/" className="rounded-input border border-surface-3 px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-hover">
            &larr; Back to Navigator
          </Link>
        </div>

        <AdminTabs activeTab={activeTab} onTabChange={handleTabChange} />

        <div className="space-y-6">
          {activeTab === "general" && (
            <>
              <IcpWeightsSection />
              <VerticalConfigSection />
              <SizeSweetSpotSection />
              <SignalTypesSection />
              <TeamMembersSection />
              <CacheSettingsSection />
              <CopyFormatSection />
              <ExclusionManagerSection />
              <PresetManagerSection />
            </>
          )}
          {activeTab === "api-keys" && <ApiKeysSection />}
          {activeTab === "data-sources" && <DataSourcesSection />}
          {activeTab === "export" && <ExportSettingsSection />}
          {activeTab === "verification" && <EmailVerificationSection />}
          {activeTab === "scoring" && <ScoringTuningSection />}
          {activeTab === "rate-limits" && <RateLimitSection />}
          {activeTab === "notifications" && <NotificationSection />}
          {activeTab === "retention" && <DataRetentionSection />}
          {activeTab === "auth" && (
            <>
              <AuthSettingsSection />
              <AuthActivityLog />
            </>
          )}
          {activeTab === "ui" && <UiPreferencesSection />}
          {activeTab === "email-prompts" && <EmailPromptsSection />}
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
              <WeeklyKpiCards data={analytics?.kpis ?? null} targets={kpiTargets} />
              <DiscoveryFunnel data={analytics?.funnel ?? null} />
              <TeamActivity data={analytics?.teamActivity ?? null} />
              <SourcePerformance data={analytics?.sourcePerformance ?? null} />
              <FilterHeatmap data={analytics?.filterHeatmap ?? null} />
              <ExclusionInsights data={analytics?.exclusions ?? null} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
