"use client";

import React from "react";
import type { OutreachSequence } from "@/lib/navigator/types";
import { pick } from "@/lib/navigator/ui-copy";

interface SequenceEnrollTabProps {
  contactFirstName: string;
  sequences: OutreachSequence[] | undefined;
  sequencesFetchError: boolean;
  selectedSequenceId: string | null;
  isEnrolling: boolean;
  onSelectSequence: (id: string | null) => void;
  onEnroll: () => void;
  onClose: () => void;
}

export const SequenceEnrollTab = React.memo(function SequenceEnrollTab({
  contactFirstName,
  sequences,
  sequencesFetchError,
  selectedSequenceId,
  isEnrolling,
  onSelectSequence,
  onEnroll,
  onClose,
}: SequenceEnrollTabProps) {
  return (
    <div className="px-5 py-4">
      <p className="mb-3 text-xs text-text-secondary">
        Enroll {contactFirstName} in a multi-step outreach sequence.
      </p>
      {sequencesFetchError ? (
        <div className="py-6 text-center text-xs text-danger">
          Failed to load sequences. Check your connection and try again.
        </div>
      ) : !sequences?.length ? (
        <div className="py-6 text-center text-xs text-text-tertiary">
          {pick("empty_sequences")}
        </div>
      ) : (
        <div className="max-h-[300px] space-y-1.5 overflow-y-auto">
          {sequences.map((seq) => (
            <button
              key={seq.id}
              onClick={() => onSelectSequence(seq.id === selectedSequenceId ? null : seq.id)}
              className={`flex w-full items-start gap-3 rounded-input border px-3 py-2.5 text-left transition-all duration-[180ms] ${
                selectedSequenceId === seq.id
                  ? "border-accent-primary/40 bg-accent-primary/5"
                  : "border-surface-3 bg-surface-0 hover:border-surface-3/80 hover:bg-surface-2/50"
              }`}
            >
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium text-text-primary">{seq.name}</span>
                {seq.description && (
                  <span className="block mt-0.5 text-[10px] text-text-tertiary truncate">{seq.description}</span>
                )}
                <span className="block mt-1 text-[10px] text-text-tertiary">
                  {seq.steps.length} step{seq.steps.length !== 1 ? "s" : ""}: {seq.steps.map((s) => s.channel.replace("_", " ")).join(" \u2192 ")}
                </span>
              </div>
              {seq.isTemplate && (
                <span className="flex-shrink-0 rounded-pill bg-accent-secondary/10 px-2 py-0.5 text-[9px] font-medium text-accent-secondary">
                  Template
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {/* Enroll footer */}
      <div className="mt-4 flex items-center justify-end gap-2">
        <button
          onClick={onClose}
          className="rounded-input px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2"
        >
          Cancel
        </button>
        <button
          onClick={onEnroll}
          disabled={!selectedSequenceId || isEnrolling}
          className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isEnrolling ? "Enrolling..." : "Enroll"}
        </button>
      </div>
    </div>
  );
});
