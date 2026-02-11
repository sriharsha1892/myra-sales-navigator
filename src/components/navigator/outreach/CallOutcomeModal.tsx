"use client";

import { useState, useCallback, useRef } from "react";
import { Overlay } from "@/components/primitives/Overlay";
import { useStore } from "@/lib/navigator/store";
import type { CallLog } from "@/lib/navigator/types";

interface CallOutcomeModalProps {
  contactId: string;
  companyDomain: string;
  contactName: string;
  onClose: () => void;
  onLogged?: () => void;
}

type CallOutcome = CallLog["outcome"];

const OUTCOME_OPTIONS: { value: CallOutcome; label: string }[] = [
  { value: "connected", label: "Connected" },
  { value: "voicemail", label: "Voicemail" },
  { value: "no_answer", label: "No Answer" },
  { value: "busy", label: "Busy" },
  { value: "wrong_number", label: "Wrong Number" },
];

export function CallOutcomeModal({
  contactId,
  companyDomain,
  contactName,
  onClose,
  onLogged,
}: CallOutcomeModalProps) {
  const addUndoToast = useStore((s) => s.addUndoToast);
  const userName = useStore((s) => s.userName);

  const [outcome, setOutcome] = useState<CallOutcome>("connected");
  const [notes, setNotes] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("");

  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSubmit = useCallback(() => {
    const parsed = durationMinutes ? parseFloat(durationMinutes) : NaN;
    const durationSeconds =
      !isNaN(parsed) && isFinite(parsed) && parsed > 0
        ? Math.round(parsed * 60)
        : null;

    const payload = {
      contactId,
      companyDomain,
      userName: userName ?? "Unknown",
      outcome,
      notes: notes.trim() || null,
      durationSeconds,
    };

    // Close modal immediately, show undo toast, delay actual POST by 2s
    onClose();

    const timer = setTimeout(async () => {
      pendingTimerRef.current = null;
      try {
        const res = await fetch("/api/outreach/call-log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to log call");
        }
        onLogged?.();
      } catch {
        useStore.getState().addToast({
          message: "Failed to log call outcome",
          type: "error",
        });
      }
    }, 2000);
    pendingTimerRef.current = timer;

    addUndoToast("Call outcome logged", () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    });
  }, [contactId, companyDomain, userName, outcome, notes, durationMinutes, addUndoToast, onLogged, onClose]);

  return (
    <Overlay open={true} onClose={onClose} backdrop="blur" placement="center">
      <div className="w-full max-w-[420px] rounded-card border border-surface-3 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-medium text-text-primary">
              Log Call Outcome
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary">{contactName}</p>
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
        <div className="space-y-4 px-5 py-4">
          {/* Outcome */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Outcome
            </label>
            <div className="flex flex-wrap gap-1.5">
              {OUTCOME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setOutcome(opt.value)}
                  className={`rounded-input px-3 py-1.5 text-xs transition-colors duration-[180ms] ${
                    outcome === opt.value
                      ? "bg-accent-secondary/15 text-accent-secondary font-medium"
                      : "bg-surface-2 text-text-secondary hover:bg-surface-3 hover:text-text-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Duration (minutes, optional)
            </label>
            <input
              type="number"
              min={0}
              step={0.5}
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              placeholder="e.g. 5"
              className="w-28 rounded-input border border-surface-3 bg-surface-0 px-3 py-2 font-mono text-sm text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Key points from the conversation..."
              className="w-full resize-y rounded-input border border-surface-3 bg-surface-0 px-3 py-2 text-xs text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-surface-3 px-5 py-3">
          <button
            onClick={onClose}
            className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity duration-[180ms] hover:opacity-90"
          >
            Log Call
          </button>
        </div>
      </div>
    </Overlay>
  );
}
