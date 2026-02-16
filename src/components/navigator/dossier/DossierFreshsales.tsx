"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import type { CompanyEnriched, FreshsalesIntel, FreshsalesStatus } from "@/lib/navigator/types";
import { useStore } from "@/lib/navigator/store";
import { defaultFreshsalesSettings } from "@/lib/navigator/mock-data";
import { MissingData } from "@/components/navigator/shared/MissingData";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import { CreateTaskInline } from "@/components/navigator/freshsales/CreateTaskInline";
import { pick } from "@/lib/navigator/ui-copy";

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

function formatSyncTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  if (isNaN(then)) return "Unknown";
  const diffMs = now - then;
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DossierFreshsales({ company }: DossierFreshsalesProps) {
  const raw = useStore((s) => s.adminConfig.freshsalesSettings);
  const settings = { ...defaultFreshsalesSettings, ...raw };
  const isAdmin = useStore((s) => s.isAdmin);
  const intel: FreshsalesIntel | null = company.freshsalesIntel ?? null;
  const status = company.freshsalesStatus ?? "none";
  const colors = statusColors[status] ?? statusColors.none;
  const statusLabel = settings.statusLabels[status] ?? status;
  const freshsalesAvailable = company.freshsalesAvailable ?? true;
  const [showCreateTask, setShowCreateTask] = useState(false);

  if (!settings.enabled) return null;

  // Safe array accessors for intel fields
  const deals = (intel && Array.isArray(intel.deals)) ? intel.deals : [];
  const contacts = (intel && Array.isArray(intel.contacts)) ? intel.contacts : [];
  const recentActivity = (intel && Array.isArray(intel.recentActivity)) ? intel.recentActivity : [];

  // Recency banner
  const showRecencyBanner =
    intel?.lastContactDate &&
    daysAgo(intel.lastContactDate) <= settings.recentActivityDaysThreshold;

  return (
    <div className="px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          {settings.sectionTitle}
        </h3>
        {intel?.fetchedAt && (
          <span className="text-[10px] font-mono text-text-tertiary">
            Synced {formatSyncTime(intel.fetchedAt)}
          </span>
        )}
      </div>

      {/* CRM Status Callout — visually distinct */}
      {status !== "none" && intel && (
        <div className="mb-3 rounded-input border border-[#3EA67B]/20 bg-[#3EA67B]/5 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded bg-[#3EA67B]/15 text-[10px] font-bold text-[#3EA67B]">F</span>
              <span className={`text-sm font-medium ${colors.color}`}>{statusLabel}</span>
              {intel.account?.owner && (
                <span className="text-[10px] text-text-tertiary">&middot; Owner: {intel.account.owner.name}</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-text-tertiary">
              {deals.length > 0 && <span>{deals.length} deal{deals.length !== 1 ? "s" : ""}</span>}
              {contacts.length > 0 && <span>{contacts.length} contact{contacts.length !== 1 ? "s" : ""}</span>}
              {intel.lastContactDate && <span>Last: {daysAgo(intel.lastContactDate)}d ago</span>}
            </div>
          </div>
          {deals.length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-text-secondary">{deals[0].name}</span>
              <span className="text-text-tertiary">&middot;</span>
              <span className="text-text-secondary">{deals[0].stage}</span>
              {deals[0].amount != null && (
                <span className="font-mono text-text-primary">
                  {deals[0].amount >= 1000 ? `$${(deals[0].amount / 1000).toFixed(0)}K` : `$${deals[0].amount}`}
                </span>
              )}
              {deals[0].daysInStage != null && deals[0].daysInStage > (settings?.stalledDealThresholdDays ?? 30) && (
                <span className="text-[10px] font-medium text-danger">Stalled ({deals[0].daysInStage}d)</span>
              )}
            </div>
          )}
        </div>
      )}
      {/* Fallback status badge when no intel */}
      {(status === "none" || !intel) && (
        <div className="mb-3">
          <span
            className={`inline-flex items-center rounded-pill px-2 py-0.5 text-[11px] font-medium ${colors.color} ${colors.bg}`}
          >
            {statusLabel}
          </span>
        </div>
      )}

      {/* Warmth bar */}
      {intel?.lastContactDate && (
        <div className="mb-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-text-tertiary">CRM Engagement</span>
            <span className="text-[9px] text-text-tertiary">{daysAgo(intel.lastContactDate)}d since last contact</span>
          </div>
          <div className="h-1 rounded-full bg-surface-2 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${Math.max(5, 100 - daysAgo(intel.lastContactDate))}%`,
                backgroundColor: daysAgo(intel.lastContactDate) <= 14 ? "#c9a227" :
                                daysAgo(intel.lastContactDate) <= 60 ? "#67b5c4" : "#6b6b80",
              }}
            />
          </div>
        </div>
      )}

      {/* Recency banner */}
      {showRecencyBanner && intel?.lastContactDate && (
        <div className="mb-3 rounded-input border border-warning/30 bg-warning/10 px-3 py-2">
          <span className="text-xs font-medium text-warning">
            Research team contacted {daysAgo(intel.lastContactDate)} days ago
          </span>
        </div>
      )}

      {settings.enabled && !freshsalesAvailable ? (
        isAdmin ? (
          <p className="text-xs text-warning/80">Freshsales integration not configured (API key or domain missing)</p>
        ) : (
          <MissingData label={settings.emptyStateLabel} />
        )
      ) : status === "none" || !intel ? (
        <MissingData label={`No Freshsales records for ${company.domain}`} />
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
              {settings.showOwner && intel.account.owner && (
                <div className="mt-1 flex items-center gap-1.5">
                  <span className="text-[10px] text-text-tertiary">CRM Owner:</span>
                  <span className="text-xs font-medium text-accent-secondary">{intel.account.owner.name}</span>
                </div>
              )}
            </div>
          )}

          {/* Deals */}
          {settings.showDeals !== false && deals.length > 0 && (
            <div>
              <span className="block text-[10px] text-text-tertiary mb-1">
                Deals ({deals.length})
              </span>
              <div className="space-y-1.5">
                {deals.slice(0, 5).map((deal) => (
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
                        {settings.showDealVelocity !== false && deal.daysInStage != null && (
                          <span className={cn(
                            "ml-1 font-mono",
                            deal.daysInStage > (settings.stalledDealThresholdDays ?? 30) ? "text-danger" :
                            deal.daysInStage > 14 ? "text-warning" :
                            "text-success"
                          )}>
                            {deal.daysInStage}d
                          </span>
                        )}
                        {deal.expectedClose
                          ? ` \u00b7 Close ${formatDate(deal.expectedClose)}`
                          : ""}
                      </span>
                      {deal.lostReason && (
                        <span className="block text-[9px] text-danger/60">
                          Lost reason: {deal.lostReason}
                        </span>
                      )}
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
          {settings.showContacts !== false && contacts.length > 0 && (
            <div>
              <span className="block text-[10px] text-text-tertiary mb-1">
                Contacts ({contacts.length})
              </span>
              <div className="space-y-1.5">
                {contacts.slice(0, 5).map((c) => (
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
                      {settings.showTags && c.tags && c.tags.length > 0 && (
                        <div className="mt-0.5 flex flex-wrap gap-1">
                          {c.tags.slice(0, 3).map((tag) => {
                            const isBoost = (settings.tagScoringRules?.boostTags || [])
                              .some((bt) => bt.toLowerCase() === tag.toLowerCase());
                            const isPenalty = (settings.tagScoringRules?.penaltyTags || [])
                              .some((pt) => pt.toLowerCase() === tag.toLowerCase());
                            return (
                              <span
                                key={tag}
                                className={cn(
                                  "rounded-pill px-1.5 py-0.5 text-[9px] font-medium",
                                  isBoost ? "bg-success-light text-success" :
                                  isPenalty ? "bg-danger/10 text-danger/70" :
                                  "bg-surface-2 text-text-tertiary"
                                )}
                              >
                                {tag}
                              </span>
                            );
                          })}
                          {c.tags.length > 3 && (
                            <Tooltip text={c.tags.slice(3).join(", ")}>
                              <span className="text-[9px] text-text-tertiary">+{c.tags.length - 3}</span>
                            </Tooltip>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Activity */}
          {settings.showActivity !== false && (
            <div>
              <span className="block text-[10px] text-text-tertiary mb-1">
                Recent Activity
              </span>
              {recentActivity.length > 0 ? (
                <div className="space-y-1.5">
                  {recentActivity.slice(0, 5).map((act, i) => (
                    <div key={i} className="flex items-start gap-2 py-1">
                      <span className={cn(
                        "mt-0.5 flex-shrink-0 rounded-pill px-1.5 py-0.5 text-[9px] font-medium",
                        act.type === "email" ? "bg-info-light text-accent-primary" :
                        act.type === "call" ? "bg-success-light text-success" :
                        act.type === "meeting" ? "bg-warning-light text-warning" :
                        "bg-surface-2 text-text-tertiary"
                      )}>
                        {act.type}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 text-[11px]">
                          <span className="font-medium text-text-primary">{act.actor}</span>
                          <span className="text-text-tertiary">&middot;</span>
                          <span className="text-text-tertiary">
                            {daysAgo(act.date) === 0 ? "today" : `${daysAgo(act.date)}d ago`}
                          </span>
                        </div>
                        <p className="truncate text-[10px] text-text-secondary">{act.title}</p>
                        {act.outcome && (
                          <span className="text-[9px] text-text-tertiary">Outcome: {act.outcome}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[10px] italic text-text-tertiary">{pick("empty_activity")}</p>
              )}
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

          {/* Create Task */}
          {settings.enableTaskCreation && freshsalesAvailable && intel?.account && (
            <div className="mt-3 border-t border-surface-3 pt-2">
              {showCreateTask ? (
                <CreateTaskInline
                  companyName={intel.account.name}
                  accountId={intel.account.id}
                  contacts={contacts}
                  defaultDueDays={settings.defaultTaskDueDays ?? 3}
                  onCreated={() => setShowCreateTask(false)}
                  onCancel={() => setShowCreateTask(false)}
                />
              ) : (
                <button
                  onClick={() => setShowCreateTask(true)}
                  className="w-full rounded-input border border-dashed border-surface-3 py-2 text-[10px] font-medium text-text-tertiary transition-colors hover:border-accent-primary hover:text-accent-primary"
                >
                  + Create follow-up task
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
