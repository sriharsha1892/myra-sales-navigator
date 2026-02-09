"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import type { OutreachEnrollment, OutreachSequence } from "@/lib/navigator/types";

interface DueStepItem {
  enrollment: OutreachEnrollment;
  sequence: OutreachSequence;
  contactName: string;
  companyName: string;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "#d4a012",
  call: "#22d3ee",
  linkedin_connect: "#0077B5",
  linkedin_inmail: "#0077B5",
  whatsapp: "#25D366",
};

export function DueStepsWidget() {
  const addToast = useStore((s) => s.addToast);

  const [items, setItems] = useState<DueStepItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`/api/outreach/due-steps`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch due steps");
        return res.json();
      })
      .then((data: { items: DueStepItem[] }) => {
        if (!cancelled) {
          setItems(data.items);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setItems([]);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleExecute = useCallback(
    (item: DueStepItem) => {
      const step = item.sequence.steps[item.enrollment.currentStep];
      if (!step) return;

      // Open the company dossier so the user can draft outreach from there
      const state = useStore.getState();
      state.selectCompany(item.enrollment.companyDomain);

      addToast({
        message: `Opened ${item.companyName} — draft outreach from dossier`,
        type: "info",
      });
    },
    [addToast]
  );

  if (loading) {
    return (
      <div className="rounded-card border border-surface-3 bg-surface-1 p-4">
        <div className="mb-3 h-4 w-40 animate-pulse rounded bg-surface-2" />
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-12 animate-pulse rounded-input bg-surface-2"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-surface-3 bg-surface-1">
      {/* Header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            className={`text-text-tertiary transition-transform duration-[180ms] ${
              collapsed ? "-rotate-90" : ""
            }`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Steps Due Today
          </span>
          {items.length > 0 && (
            <span className="rounded-pill bg-accent-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-accent-primary">
              {items.length}
            </span>
          )}
        </div>
      </button>

      {/* Content */}
      {!collapsed && (
        <div className="border-t border-surface-3 px-4 py-3">
          {items.length === 0 ? (
            <p className="py-4 text-center text-xs text-text-tertiary">
              No steps due today
            </p>
          ) : (
            <div className="space-y-1.5">
              {items.map((item) => {
                const step = item.sequence.steps[item.enrollment.currentStep];
                if (!step) return null;
                const channelOpt = CHANNEL_OPTIONS.find(
                  (o) => o.value === step.channel
                );
                const color = CHANNEL_COLORS[step.channel] ?? "#6b6b80";

                return (
                  <div
                    key={item.enrollment.id}
                    className="flex items-center justify-between rounded-input border border-surface-3 bg-surface-2 px-3 py-2 transition-colors duration-[180ms] hover:border-surface-3/80"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate text-xs font-medium text-text-primary">
                          {item.contactName}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          at {item.companyName}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5">
                        <span
                          className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                          style={{
                            color,
                            backgroundColor: `${color}1a`,
                          }}
                        >
                          {channelOpt?.label ?? step.channel}
                        </span>
                        <span className="text-[10px] text-text-tertiary">
                          Step {item.enrollment.currentStep + 1}/{item.sequence.steps.length}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleExecute(item)}
                      className="ml-2 flex-shrink-0 rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-accent-primary/10 hover:text-accent-primary hover:border-accent-primary/30"
                    >
                      Execute
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
