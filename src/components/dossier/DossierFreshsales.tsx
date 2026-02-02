"use client";

import type { CompanyEnriched, FreshsalesIntel, FreshsalesStatus } from "@/lib/types";
import { useStore } from "@/lib/store";
import { MissingData } from "@/components/shared/MissingData";

interface DossierFreshsalesProps {
  company: CompanyEnriched;
}

const statusColors: Record<
  FreshsalesStatus,
  { color: string; bg: string }
> = {
  none: { color: "text-text-tertiary", bg: "bg-surface-2" },
  new_lead: { color: "text-accent-primary", bg: "bg-accent-primary-light" },
  contacted: { color: "text-warning", bg: "bg-warning-light" },
  negotiation: { color: "text-accent-highlight", bg: "bg-accent-highlight-light" },
  won: { color: "text-success", bg: "bg-success-light" },
  customer: { color: "text-success", bg: "bg-success-light" },
  lost: { color: "text-danger", bg: "bg-danger-light" },
};

function formatCurrency(amount: number | null): string {
  if (!amount) return "\u2014";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(date: string | null): string {
  if (!date) return "\u2014";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function daysAgo(dateStr: string): number {
  const now = new Date();
  const then = new Date(dateStr);
  return Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
}

export function DossierFreshsales({ company }: DossierFreshsalesProps) {
  const settings = useStore((s) => s.adminConfig.freshsalesSettings);
  const intel: FreshsalesIntel | null = company.freshsalesIntel ?? null;
  const status = company.freshsalesStatus ?? "none";
  const colors = statusColors[status] ?? statusColors.none;
  const statusLabel = settings.statusLabels[status] ?? status;

  if (!settings.enabled) return null;

  // Recency banner
  const showRecencyBanner =
    intel?.lastContactDate &&
    daysAgo(intel.lastContactDate) <= settings.recentActivityDaysThreshold;

  return (
    <div className="px-4 py-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {settings.sectionTitle}
      </h3>

      {/* Status badge */}
      <div className="mb-3">
        <span
          className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${colors.color} ${colors.bg}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Recency banner */}
      {showRecencyBanner && intel?.lastContactDate && (
        <div className="mb-3 rounded-input border border-warning/30 bg-warning/10 px-3 py-2">
          <span className="text-xs font-medium text-warning">
            Research team contacted {daysAgo(intel.lastContactDate)} days ago
          </span>
        </div>
      )}

      {status === "none" || !intel ? (
        <MissingData label={settings.emptyStateLabel} />
      ) : (
        <div className="space-y-3">
          {/* Account info */}
          {intel.account && (
            <div className="space-y-1">
              <span className="block text-[10px] text-text-tertiary">Account</span>
              <span className="text-xs font-medium text-text-primary">
                {intel.account.name}
              </span>
              {intel.account.industry && (
                <span className="block text-[11px] text-text-secondary">
                  {intel.account.industry}
                  {intel.account.employees
                    ? ` \u00b7 ${intel.account.employees.toLocaleString()} employees`
                    : ""}
                </span>
              )}
            </div>
          )}

          {/* Deals */}
          {settings.showDeals && intel.deals.length > 0 && (
            <div>
              <span className="block text-[10px] text-text-tertiary mb-1">
                Deals ({intel.deals.length})
              </span>
              <div className="space-y-1.5">
                {intel.deals.slice(0, 5).map((deal) => (
                  <div
                    key={deal.id}
                    className="flex items-center justify-between rounded-input bg-surface-1 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-text-primary">
                        {deal.name}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {deal.stage}
                        {deal.expectedClose
                          ? ` \u00b7 Close ${formatDate(deal.expectedClose)}`
                          : ""}
                      </span>
                    </div>
                    <span className="ml-2 flex-shrink-0 text-xs font-mono text-text-secondary">
                      {formatCurrency(deal.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Contacts */}
          {settings.showContacts && intel.contacts.length > 0 && (
            <div>
              <span className="block text-[10px] text-text-tertiary mb-1">
                Contacts ({intel.contacts.length})
              </span>
              <div className="space-y-1.5">
                {intel.contacts.slice(0, 5).map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between rounded-input bg-surface-1 px-2 py-1.5"
                  >
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium text-text-primary">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="text-[10px] text-text-tertiary">
                        {c.title}{c.email ? ` \u00b7 ${c.email}` : ""}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {settings.showActivity && intel.recentActivity.length > 0 && (
            <div>
              <span className="block text-[10px] text-text-tertiary mb-1">
                Recent Activity
              </span>
              <div className="space-y-1">
                {intel.recentActivity.slice(0, 5).map((act, i) => (
                  <div key={i} className="flex items-start gap-2 text-[11px]">
                    <span className="flex-shrink-0 text-text-tertiary">
                      {formatDate(act.date)}
                    </span>
                    <span className="text-text-secondary">{act.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Last Contact Date */}
          {intel.lastContactDate && (
            <div>
              <span className="block text-[10px] text-text-tertiary">Last Contact</span>
              <span className="text-xs text-text-secondary">
                {formatDate(intel.lastContactDate)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
