"use client";

import { useState, useCallback } from "react";
import { useStore } from "@/lib/navigator/store";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import type {
  SequenceStep,
  OutreachSequence,
  OutreachChannel,
  EmailTemplate,
  EmailTone,
} from "@/lib/navigator/types";

interface SequenceBuilderProps {
  sequence?: OutreachSequence;
  onSave: (data: {
    name: string;
    description?: string;
    steps: SequenceStep[];
    isTemplate: boolean;
  }) => void;
  onCancel: () => void;
}

const CHANNEL_COLORS: Record<OutreachChannel, string> = {
  email: "#c9a227",
  call: "#67b5c4",
  linkedin_connect: "#0077B5",
  linkedin_inmail: "#0077B5",
  whatsapp: "#25D366",
};

const TONE_OPTIONS: { value: EmailTone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "direct", label: "Direct" },
];

const TEMPLATE_OPTIONS: { value: EmailTemplate; label: string }[] = [
  { value: "intro", label: "Cold Intro" },
  { value: "follow_up", label: "Follow-up" },
  { value: "re_engagement", label: "Re-engagement" },
];

function defaultStep(): SequenceStep {
  return { channel: "email", delayDays: 0 };
}

/** Returns a channel prerequisite warning message, or null if no issue. */
function getChannelWarning(
  channel: OutreachChannel,
  userConfig: { freshsalesDomain: string | null; hasLinkedinSalesNav: boolean } | null
): string | null {
  if (channel === "call" && !userConfig?.freshsalesDomain) {
    return "Set up Freshsales domain in Settings for call deep-links";
  }
  if (channel === "linkedin_inmail" && !userConfig?.hasLinkedinSalesNav) {
    return "Enable LinkedIn Sales Nav in Settings for InMail";
  }
  return null;
}

export function SequenceBuilder({ sequence, onSave, onCancel }: SequenceBuilderProps) {
  const userConfig = useStore((s) => s.userConfig);
  const [name, setName] = useState(sequence?.name ?? "");
  const [description, setDescription] = useState(sequence?.description ?? "");
  const [isTemplate, setIsTemplate] = useState(sequence?.isTemplate ?? false);
  const [steps, setSteps] = useState<SequenceStep[]>(
    sequence?.steps?.length ? sequence.steps : [defaultStep()]
  );
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      { channel: "email", delayDays: prev.length === 0 ? 0 : 3 },
    ]);
    setEditingIndex(steps.length);
  }, [steps.length]);

  const removeStep = useCallback(
    (index: number) => {
      setSteps((prev) => prev.filter((_, i) => i !== index));
      if (editingIndex === index) setEditingIndex(null);
      else if (editingIndex !== null && editingIndex > index) {
        setEditingIndex(editingIndex - 1);
      }
    },
    [editingIndex]
  );

  const updateStep = useCallback((index: number, patch: Partial<SequenceStep>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }, []);

  const moveStep = useCallback(
    (index: number, direction: "up" | "down") => {
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= steps.length) return;
      setSteps((prev) => {
        const next = [...prev];
        [next[index], next[target]] = [next[target], next[index]];
        return next;
      });
      if (editingIndex === index) setEditingIndex(target);
      else if (editingIndex === target) setEditingIndex(index);
    },
    [steps.length, editingIndex]
  );

  const addToast = useStore((s) => s.addToast);

  const handleSave = useCallback(() => {
    if (!name.trim() || steps.length === 0) return;

    // Pre-flight: check channel prerequisites
    const warnings = steps
      .map((s, i) => {
        const warning = getChannelWarning(s.channel, userConfig);
        return warning ? `Step ${i + 1}: ${warning}` : null;
      })
      .filter((w): w is string => w !== null);

    if (warnings.length > 0) {
      addToast({
        message: warnings.join(". "),
        type: "warning",
        duration: 5000,
      });
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim() || undefined,
      steps,
      isTemplate,
    });
  }, [name, description, steps, isTemplate, onSave, userConfig, addToast]);

  const canSave = name.trim().length > 0 && steps.length > 0;

  return (
    <div className="space-y-4">
      {/* Name */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Sequence Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Standard 5-step outreach"
          className="w-full rounded-input border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Description (optional)
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Brief description of this sequence..."
          className="w-full resize-y rounded-input border border-surface-3 bg-surface-0 px-3 py-2 text-xs text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
        />
      </div>

      {/* Save as template */}
      <label className="flex items-center gap-2 text-xs text-text-secondary">
        <input
          type="checkbox"
          checked={isTemplate}
          onChange={(e) => setIsTemplate(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-surface-3 bg-surface-0 accent-accent-primary"
        />
        Save as template (reusable for other contacts)
      </label>

      {/* Timeline */}
      <div className="relative">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
          Steps
        </label>

        <div className="relative ml-3">
          {/* Vertical connector line */}
          {steps.length > 1 && (
            <div
              className="absolute left-[7px] top-[14px] w-px bg-surface-3"
              style={{ height: `calc(100% - 28px)` }}
            />
          )}

          <div className="space-y-1">
            {steps.map((step, index) => {
              const channelOpt = CHANNEL_OPTIONS.find((o) => o.value === step.channel);
              const color = CHANNEL_COLORS[step.channel];
              const isEditing = editingIndex === index;
              const channelWarning = getChannelWarning(step.channel, userConfig);

              return (
                <div key={index} className="relative">
                  {/* Step node row */}
                  <div className="flex items-start gap-3">
                    {/* Dot */}
                    <div
                      className="mt-2.5 h-[15px] w-[15px] flex-shrink-0 rounded-full border-2"
                      style={{ borderColor: color, backgroundColor: isEditing ? color : "transparent" }}
                    />

                    {/* Step card */}
                    <div
                      className={`flex-1 rounded-input border px-3 py-2 transition-colors duration-[180ms] ${
                        isEditing
                          ? "border-accent-primary/50 bg-surface-2"
                          : "border-surface-3 bg-surface-1 hover:border-surface-3/80"
                      }`}
                    >
                      {/* Summary row — always visible */}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => setEditingIndex(isEditing ? null : index)}
                          className="flex flex-1 items-center gap-2 text-left"
                        >
                          <span className="font-mono text-[10px] text-text-tertiary">
                            {index + 1}
                          </span>
                          <span
                            className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                            style={{ color, backgroundColor: `${color}1a` }}
                          >
                            {channelOpt?.label ?? step.channel}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {step.delayDays === 0
                              ? "Immediately"
                              : `Day ${step.delayDays}`}
                          </span>
                          {step.template && (
                            <span className="text-[10px] text-text-tertiary">
                              {TEMPLATE_OPTIONS.find((t) => t.value === step.template)?.label}
                            </span>
                          )}
                        </button>

                        {/* Actions */}
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => moveStep(index, "up")}
                            disabled={index === 0}
                            className="rounded p-1 text-text-tertiary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move step up"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="18 15 12 9 6 15" />
                            </svg>
                          </button>
                          <button
                            onClick={() => moveStep(index, "down")}
                            disabled={index === steps.length - 1}
                            className="rounded p-1 text-text-tertiary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move step down"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                          <button
                            onClick={() => removeStep(index)}
                            className="rounded p-1 text-text-tertiary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-danger"
                            aria-label="Remove step"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Channel prerequisite warning */}
                      {channelWarning && (
                        <p className="mt-1 text-[10px] text-amber-400">{channelWarning}</p>
                      )}

                      {/* Edit panel (expanded) */}
                      {isEditing && (
                        <div className="mt-3 space-y-2.5 border-t border-surface-3 pt-3">
                          {/* Channel */}
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                              Channel
                            </label>
                            <select
                              value={step.channel}
                              onChange={(e) =>
                                updateStep(index, { channel: e.target.value as OutreachChannel })
                              }
                              className="w-full rounded-input border border-surface-3 bg-surface-0 px-2.5 py-1.5 text-xs text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary"
                            >
                              {CHANNEL_OPTIONS.map((opt) => (
                                <option key={opt.value} value={opt.value}>
                                  {opt.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* Delay days */}
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                              Delay (days from enrollment)
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={90}
                              value={step.delayDays}
                              onChange={(e) =>
                                updateStep(index, {
                                  delayDays: Math.max(0, parseInt(e.target.value) || 0),
                                })
                              }
                              className="w-24 rounded-input border border-surface-3 bg-surface-0 px-2.5 py-1.5 font-mono text-xs text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary"
                            />
                          </div>

                          {/* Template (email channels only) */}
                          {(step.channel === "email" || step.channel === "linkedin_inmail") && (
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                                Template
                              </label>
                              <select
                                value={step.template ?? ""}
                                onChange={(e) =>
                                  updateStep(index, {
                                    template: (e.target.value as EmailTemplate) || undefined,
                                  })
                                }
                                className="w-full rounded-input border border-surface-3 bg-surface-0 px-2.5 py-1.5 text-xs text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary"
                              >
                                <option value="">None</option>
                                {TEMPLATE_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* Tone (email channels only) */}
                          {(step.channel === "email" || step.channel === "linkedin_inmail") && (
                            <div>
                              <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                                Tone
                              </label>
                              <div className="flex gap-1">
                                {TONE_OPTIONS.map((opt) => (
                                  <button
                                    key={opt.value}
                                    onClick={() => updateStep(index, { tone: opt.value })}
                                    className={`rounded-input px-2.5 py-1 text-[10px] transition-colors duration-[180ms] ${
                                      step.tone === opt.value
                                        ? "bg-accent-primary/15 text-accent-primary"
                                        : "bg-surface-0 text-text-secondary hover:bg-surface-1"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Notes */}
                          <div>
                            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                              Notes (optional)
                            </label>
                            <textarea
                              value={step.notes ?? ""}
                              onChange={(e) => updateStep(index, { notes: e.target.value || undefined })}
                              rows={2}
                              placeholder="Internal notes for this step..."
                              className="w-full resize-y rounded-input border border-surface-3 bg-surface-0 px-2.5 py-1.5 text-[10px] text-text-primary outline-none transition-colors duration-[180ms] focus:border-accent-primary placeholder:text-text-tertiary"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Add Step */}
        <button
          onClick={addStep}
          className="mt-3 ml-3 flex items-center gap-1.5 rounded-input border border-dashed border-surface-3 px-3 py-1.5 text-xs text-text-tertiary transition-colors duration-[180ms] hover:border-accent-primary hover:text-accent-primary"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Add Step
        </button>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-surface-3 pt-3">
        <button
          onClick={onCancel}
          className="rounded-input border border-surface-3 px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="rounded-input bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity duration-[180ms] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Save Sequence
        </button>
      </div>
    </div>
  );
}
