"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";
import { AdminSection } from "./AdminSection";
import type { EmailTone, EmailTemplate, EmailPromptsConfig } from "@/lib/types";

const TONE_KEYS: { key: EmailTone; label: string }[] = [
  { key: "formal", label: "Formal" },
  { key: "casual", label: "Casual" },
  { key: "direct", label: "Direct" },
];

const TEMPLATE_KEYS: { key: EmailTemplate; label: string }[] = [
  { key: "intro", label: "Cold Intro" },
  { key: "follow_up", label: "Follow-up" },
  { key: "re_engagement", label: "Re-engagement" },
];

export function EmailPromptsSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const ep = config.emailPrompts;

  const [expandedTone, setExpandedTone] = useState<EmailTone | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<EmailTemplate | null>(null);

  const update = (partial: Partial<EmailPromptsConfig>) => {
    updateConfig({ emailPrompts: { ...ep, ...partial } });
  };

  return (
    <div className="space-y-6">
      <AdminSection title="Email Prompts">
        <p className="mb-4 text-xs text-text-tertiary">
          Configure the LLM prompt used when generating email drafts. Changes apply to all new drafts.
        </p>

        <div className="space-y-5">
          {/* Company Description */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Company Description
            </label>
            <input
              type="text"
              value={ep.companyDescription}
              onChange={(e) => update({ companyDescription: e.target.value })}
              placeholder="a technology company"
              className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-text-tertiary">
              One-liner describing your company for LLM context. Used in: &quot;You are a B2B sales email writer for myRA, [this value].&quot;
            </p>
          </div>

          {/* Value Proposition */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Value Proposition
            </label>
            <textarea
              value={ep.valueProposition}
              onChange={(e) => update({ valueProposition: e.target.value })}
              placeholder="What does your company offer? Leave empty to omit from prompt."
              rows={3}
              className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-text-tertiary">
              Injected as &quot;Our value proposition: [this value]&quot; in the system prompt. Leave empty to skip.
            </p>
          </div>

          {/* Tone Instructions */}
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase text-text-tertiary">
              Tone Instructions
            </label>
            <div className="space-y-2">
              {TONE_KEYS.map(({ key, label }) => (
                <div key={key} className="rounded-lg border border-surface-3 bg-surface-0">
                  <button
                    onClick={() => setExpandedTone(expandedTone === key ? null : key)}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs text-text-primary"
                  >
                    <span className="font-medium">{label}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-text-tertiary transition-transform duration-180 ${expandedTone === key ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {expandedTone === key && (
                    <div className="border-t border-surface-3 px-3 py-2">
                      <textarea
                        value={ep.toneInstructions[key]}
                        onChange={(e) =>
                          update({
                            toneInstructions: { ...ep.toneInstructions, [key]: e.target.value },
                          })
                        }
                        rows={3}
                        className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Template Instructions */}
          <div>
            <label className="mb-2 block text-[10px] font-medium uppercase text-text-tertiary">
              Template Instructions
            </label>
            <div className="space-y-2">
              {TEMPLATE_KEYS.map(({ key, label }) => (
                <div key={key} className="rounded-lg border border-surface-3 bg-surface-0">
                  <button
                    onClick={() => setExpandedTemplate(expandedTemplate === key ? null : key)}
                    className="flex w-full items-center justify-between px-3 py-2 text-xs text-text-primary"
                  >
                    <span className="font-medium">{label}</span>
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className={`text-text-tertiary transition-transform duration-180 ${expandedTemplate === key ? "rotate-180" : ""}`}
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {expandedTemplate === key && (
                    <div className="border-t border-surface-3 px-3 py-2">
                      <textarea
                        value={ep.templateInstructions[key]}
                        onChange={(e) =>
                          update({
                            templateInstructions: { ...ep.templateInstructions, [key]: e.target.value },
                          })
                        }
                        rows={4}
                        className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* System Prompt Suffix */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              System Prompt Suffix
            </label>
            <textarea
              value={ep.systemPromptSuffix}
              onChange={(e) => update({ systemPromptSuffix: e.target.value })}
              placeholder='Extra rules appended to the system prompt, e.g. "Never mention competitors by name"'
              rows={3}
              className="w-full resize-y rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
            />
            <p className="mt-1 text-[10px] text-text-tertiary">
              Appended at the end of the system prompt. Use for guardrails or special instructions.
            </p>
          </div>

          {/* Default Tone */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Default Tone
            </label>
            <div className="flex gap-1">
              {TONE_KEYS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => update({ defaultTone: key })}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    ep.defaultTone === key
                      ? "bg-accent-primary/15 text-accent-primary"
                      : "bg-surface-0 text-text-secondary hover:bg-surface-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-text-tertiary">
              Pre-selected tone when opening the Draft Email modal.
            </p>
          </div>

          {/* Default Template */}
          <div>
            <label className="mb-1 block text-[10px] font-medium uppercase text-text-tertiary">
              Default Template
            </label>
            <div className="flex gap-1">
              {TEMPLATE_KEYS.map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => update({ defaultTemplate: key })}
                  className={`rounded-lg px-3 py-1.5 text-xs transition-colors ${
                    ep.defaultTemplate === key
                      ? "bg-accent-primary/15 text-accent-primary"
                      : "bg-surface-0 text-text-secondary hover:bg-surface-2"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10px] text-text-tertiary">
              Pre-selected template when opening the Draft Email modal.
            </p>
          </div>
        </div>
      </AdminSection>
    </div>
  );
}
