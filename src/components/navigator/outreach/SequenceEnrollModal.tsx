"use client";

import { useState, useCallback, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Overlay } from "@/components/primitives/Overlay";
import { useStore } from "@/lib/navigator/store";
import { SequenceBuilder } from "./SequenceBuilder";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import type { OutreachSequence, SequenceStep } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

interface SequenceEnrollModalProps {
  contactIds: string[];
  companyDomain: string;
  onClose: () => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "#d4a012",
  call: "#22d3ee",
  linkedin_connect: "#0077B5",
  linkedin_inmail: "#0077B5",
  whatsapp: "#25D366",
};

export function SequenceEnrollModal({
  contactIds,
  companyDomain,
  onClose,
}: SequenceEnrollModalProps) {
  const addToast = useStore((s) => s.addToast);
  const userName = useStore((s) => s.userName);
  const queryClient = useQueryClient();

  const [sequences, setSequences] = useState<OutreachSequence[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  // Fetch available sequences
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/outreach/sequences")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch sequences");
        return res.json();
      })
      .then((data: { sequences: OutreachSequence[] }) => {
        if (!cancelled) {
          setSequences(data.sequences);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoading(false);
          addToast({ message: "Failed to load sequences", type: "error" });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [addToast]);

  const selectedSequence = sequences.find((s) => s.id === selectedId) ?? null;

  const handleEnroll = useCallback(async () => {
    if (!selectedId || contactIds.length === 0) return;
    setEnrolling(true);
    try {
      const results = await Promise.allSettled(
        contactIds.map((id) =>
          fetch("/api/outreach/enrollments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sequenceId: selectedId,
              contactId: id,
              companyDomain,
              enrolledBy: userName ?? "Unknown",
            }),
          }).then(async (res) => {
            if (res.status === 409) throw new Error("already_enrolled");
            if (!res.ok) throw new Error("failed");
            return res.json();
          })
        )
      );

      const enrolled = results.filter((r) => r.status === "fulfilled").length;
      const alreadyEnrolled = results.filter(
        (r) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.message === "already_enrolled"
      ).length;
      const failed = results.filter(
        (r) => r.status === "rejected" && (r as PromiseRejectedResult).reason?.message !== "already_enrolled"
      ).length;

      const parts: string[] = [];
      if (enrolled > 0) parts.push(`${enrolled} enrolled`);
      if (alreadyEnrolled > 0) parts.push(`${alreadyEnrolled} already in sequence`);
      if (failed > 0) parts.push(`${failed} failed`);

      addToast({
        message: parts.join(", "),
        type: enrolled > 0 ? "success" : "warning",
      });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      onClose();
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : "Enrollment failed",
        type: "error",
      });
    } finally {
      setEnrolling(false);
    }
  }, [selectedId, contactIds, companyDomain, userName, addToast, onClose]);

  const handleBuilderSave = useCallback(
    async (data: {
      name: string;
      description?: string;
      steps: SequenceStep[];
      isTemplate: boolean;
    }) => {
      try {
        const res = await fetch("/api/outreach/sequences", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...data,
            createdBy: userName ?? "Unknown",
          }),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to create sequence");
        }
        const created: OutreachSequence = await res.json();
        setSequences((prev) => [...prev, created]);
        setSelectedId(created.id);
        setShowBuilder(false);
        addToast({ message: "Sequence created", type: "success" });
      } catch (err) {
        addToast({
          message: err instanceof Error ? err.message : "Failed to create sequence",
          type: "error",
        });
      }
    },
    [userName, addToast]
  );

  return (
    <Overlay open={true} onClose={onClose} backdrop="blur" placement="center">
      <div className="w-full max-w-[560px] rounded-card border border-surface-3 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-medium text-text-primary">
              Enroll in Sequence
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {contactIds.length} contact{contactIds.length > 1 ? "s" : ""} selected
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-tertiary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">
          {showBuilder ? (
            <SequenceBuilder
              onSave={handleBuilderSave}
              onCancel={() => setShowBuilder(false)}
            />
          ) : loading ? (
            /* Skeleton loading */
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-input bg-surface-2"
                />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Sequence list */}
              {sequences.length === 0 ? (
                <p className="py-6 text-center text-xs text-text-tertiary">
                  {pick("empty_sequences")}
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sequences.map((seq) => {
                    const isSelected = selectedId === seq.id;
                    return (
                      <button
                        key={seq.id}
                        onClick={() => setSelectedId(isSelected ? null : seq.id)}
                        className={`w-full rounded-input border px-3 py-2.5 text-left transition-colors duration-[180ms] ${
                          isSelected
                            ? "border-accent-primary/50 bg-accent-primary/5"
                            : "border-surface-3 bg-surface-2 hover:border-surface-3/80"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-text-primary">
                            {seq.name}
                          </span>
                          <span className="text-[10px] text-text-tertiary">
                            {seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        {seq.description && (
                          <p className="mt-0.5 text-[10px] text-text-secondary">
                            {seq.description}
                          </p>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Selected sequence preview */}
              {selectedSequence && (
                <div className="mt-3 rounded-input border border-surface-3 bg-surface-0 px-3 py-2.5">
                  <span className="mb-2 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    Sequence Preview
                  </span>
                  <div className="relative ml-2">
                    {selectedSequence.steps.length > 1 && (
                      <div
                        className="absolute left-[5px] top-[8px] w-px bg-surface-3"
                        style={{
                          height: `calc(100% - 16px)`,
                        }}
                      />
                    )}
                    <div className="space-y-1.5">
                      {selectedSequence.steps.map((step, i) => {
                        const channelOpt = CHANNEL_OPTIONS.find(
                          (o) => o.value === step.channel
                        );
                        const color = CHANNEL_COLORS[step.channel] ?? "#6b6b80";
                        return (
                          <div key={i} className="flex items-center gap-2">
                            <div
                              className="h-[11px] w-[11px] flex-shrink-0 rounded-full border-2"
                              style={{ borderColor: color }}
                            />
                            <span className="font-mono text-[10px] text-text-tertiary">
                              {step.delayDays === 0 ? "Day 0" : `Day ${step.delayDays}`}
                            </span>
                            <span
                              className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                              style={{
                                color,
                                backgroundColor: `${color}1a`,
                              }}
                            >
                              {channelOpt?.label ?? step.channel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Create new */}
              <button
                onClick={() => setShowBuilder(true)}
                className="w-full rounded-input border border-dashed border-surface-3 py-2 text-xs text-text-tertiary transition-colors duration-[180ms] hover:border-accent-primary hover:text-accent-primary"
              >
                + Create New Sequence
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        {!showBuilder && (
          <div className="flex items-center justify-end gap-2 border-t border-surface-3 px-5 py-3">
            <button
              onClick={onClose}
              className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2"
            >
              Cancel
            </button>
            <button
              onClick={handleEnroll}
              disabled={!selectedId || enrolling}
              className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity duration-[180ms] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {enrolling ? "Enrolling..." : `Enroll ${contactIds.length} Contact${contactIds.length > 1 ? "s" : ""}`}
            </button>
          </div>
        )}
      </div>
    </Overlay>
  );
}
