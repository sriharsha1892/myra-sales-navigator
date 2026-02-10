"use client";

import { useState, useEffect, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import { ExecutionModal } from "@/components/navigator/outreach/ExecutionModal";
import { CallOutcomeModal } from "@/components/navigator/outreach/CallOutcomeModal";
import { PreCallBriefingCard } from "./PreCallBriefingCard";
import type { OutreachEnrollment, OutreachSequence, BriefingData } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

interface DueStepItem {
  enrollment: OutreachEnrollment;
  sequence: OutreachSequence;
  contactName: string;
  companyName: string;
}

interface ExecutionResult {
  type: string;
  subject?: string;
  message?: string;
  draftNote?: string;
  draftMessage?: string;
  talkingPoints?: string;
  freshsalesUrl?: string | null;
  linkedinUrl?: string | null;
  contactId?: string;
  companyDomain?: string;
  error?: string;
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

  // Execution state
  const [executingId, setExecutingId] = useState<string | null>(null);
  const [expandedCallId, setExpandedCallId] = useState<string | null>(null);
  const [callResult, setCallResult] = useState<ExecutionResult | null>(null);
  const [showCallOutcome, setShowCallOutcome] = useState(false);
  const [modalData, setModalData] = useState<{
    item: DueStepItem;
    result: ExecutionResult;
  } | null>(null);

  // Briefing state
  const [briefingData, setBriefingData] = useState<Record<string, BriefingData>>({});
  const [briefingLoading, setBriefingLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;

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

  const removeItem = useCallback((enrollmentId: string) => {
    setItems((prev) => prev.filter((i) => i.enrollment.id !== enrollmentId));
  }, []);

  const handleExecute = useCallback(
    async (item: DueStepItem) => {
      const step = item.sequence.steps[item.enrollment.currentStep];
      if (!step) return;

      const enrollmentId = item.enrollment.id;
      setExecutingId(enrollmentId);

      // Set briefing loading
      setBriefingLoading(prev => ({ ...prev, [enrollmentId]: true }));

      try {
        const [execRes, briefingRes] = await Promise.allSettled([
          fetch(
            `/api/outreach/enrollments/${enrollmentId}/execute`,
            { method: "POST", headers: { "Content-Type": "application/json" } }
          ),
          fetch(`/api/outreach/enrollments/${enrollmentId}/briefing`),
        ]);

        // Handle briefing result
        if (briefingRes.status === "fulfilled" && briefingRes.value.ok) {
          const bData = await briefingRes.value.json();
          setBriefingData(prev => ({ ...prev, [enrollmentId]: bData }));
        }
        setBriefingLoading(prev => ({ ...prev, [enrollmentId]: false }));

        // Handle execution result
        if (execRes.status !== "fulfilled") {
          throw new Error("Execution failed");
        }

        const res = execRes.value;
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Execution failed");
        }

        const data: {
          executionResult: ExecutionResult;
          completed: boolean;
        } = await res.json();

        if (data.completed) {
          addToast({ message: `Sequence completed for ${item.contactName}!`, type: "success" });
          removeItem(enrollmentId);
          setExecutingId(null);
          return;
        }

        const result = data.executionResult;

        if (result.type === "call") {
          // Inline expand for calls
          setExpandedCallId(enrollmentId);
          setCallResult(result);
          setExecutingId(null);
        } else {
          // Modal for email, linkedin, whatsapp
          setModalData({ item, result });
          setExecutingId(null);
        }
      } catch (err) {
        setBriefingLoading(prev => ({ ...prev, [enrollmentId]: false }));
        addToast({
          message: err instanceof Error ? err.message : "Failed to execute step",
          type: "error",
        });
        setExecutingId(null);
      }
    },
    [addToast, removeItem]
  );

  const handleModalDone = useCallback(() => {
    if (modalData) {
      addToast({ message: `Step completed for ${modalData.item.contactName}`, type: "success" });
      removeItem(modalData.item.enrollment.id);
      setModalData(null);
    }
  }, [modalData, addToast, removeItem]);

  const handleCallOutcomeLogged = useCallback(() => {
    if (expandedCallId) {
      removeItem(expandedCallId);
      setExpandedCallId(null);
      setCallResult(null);
      setShowCallOutcome(false);
    }
  }, [expandedCallId, removeItem]);

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
    <>
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
              <p className="py-4 text-center text-xs italic text-text-tertiary">
                {pick("empty_steps_due")}
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
                  const isExecuting = executingId === item.enrollment.id;
                  const isCallExpanded = expandedCallId === item.enrollment.id;

                  return (
                    <div key={item.enrollment.id}>
                      <div
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
                          disabled={isExecuting || isCallExpanded}
                          className="ml-2 flex-shrink-0 rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-accent-primary/10 hover:text-accent-primary hover:border-accent-primary/30 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {isExecuting ? (
                            <span className="flex items-center gap-1.5">
                              <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                              </svg>
                              Running
                            </span>
                          ) : (
                            "Execute"
                          )}
                        </button>
                      </div>

                      {/* Inline call expansion */}
                      {isCallExpanded && callResult && (
                        <div className="mt-1 rounded-input border border-accent-secondary/20 bg-accent-secondary/5 px-3 py-2.5">
                          <PreCallBriefingCard
                            data={briefingData[item.enrollment.id]}
                            loading={briefingLoading[item.enrollment.id]}
                          />
                          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-accent-secondary">
                            Talking Points
                          </p>
                          <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-secondary">
                            {callResult.talkingPoints}
                          </p>
                          <div className="mt-3 flex items-center gap-2">
                            {callResult.freshsalesUrl && (
                              <a
                                href={callResult.freshsalesUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors hover:bg-surface-2"
                              >
                                Open in Freshsales
                              </a>
                            )}
                            <button
                              onClick={() => setShowCallOutcome(true)}
                              className="rounded-input bg-accent-secondary/15 px-2.5 py-1 text-[10px] font-medium text-accent-secondary transition-colors hover:bg-accent-secondary/25"
                            >
                              Log Outcome
                            </button>
                            <button
                              onClick={() => {
                                setExpandedCallId(null);
                                setCallResult(null);
                                removeItem(item.enrollment.id);
                                addToast({ message: `Step completed for ${item.contactName}`, type: "success" });
                              }}
                              className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary"
                            >
                              Skip Log
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Execution modal for email/LinkedIn/WhatsApp */}
      {modalData && (
        <ExecutionModal
          channel={
            modalData.result.type === "email_draft"
              ? "email"
              : modalData.result.type === "whatsapp"
                ? "whatsapp"
                : modalData.item.sequence.steps[modalData.item.enrollment.currentStep]?.channel ?? "email"
          }
          contactName={modalData.item.contactName}
          companyName={modalData.item.companyName}
          draft={
            modalData.result.message ??
            modalData.result.draftNote ??
            modalData.result.draftMessage ??
            null
          }
          subject={modalData.result.subject}
          linkedinUrl={modalData.result.linkedinUrl}
          briefing={briefingData[modalData.item.enrollment.id] ?? null}
          onDone={handleModalDone}
          onClose={() => setModalData(null)}
        />
      )}

      {/* Call outcome modal */}
      {showCallOutcome && callResult && expandedCallId && (
        <CallOutcomeModal
          contactId={callResult.contactId ?? ""}
          companyDomain={callResult.companyDomain ?? ""}
          contactName={
            items.find((i) => i.enrollment.id === expandedCallId)?.contactName ?? ""
          }
          onClose={() => setShowCallOutcome(false)}
          onLogged={handleCallOutcomeLogged}
        />
      )}
    </>
  );
}
