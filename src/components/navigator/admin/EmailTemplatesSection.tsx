"use client";

import { useState } from "react";
import { AdminSection } from "./AdminSection";
import { useStore } from "@/lib/navigator/store";
import { cn } from "@/lib/cn";
import type { CustomEmailTemplate, EmailTone, EmailTemplate } from "@/lib/navigator/types";

const TONE_OPTIONS: EmailTone[] = ["formal", "casual", "direct"];
const TYPE_OPTIONS: (EmailTemplate | "custom")[] = ["intro", "follow_up", "re_engagement", "custom"];

function generateId(): string {
  return `tmpl_${Date.now().toString(36)}`;
}

function TemplateEditor({
  template,
  onChange,
  onDelete,
}: {
  template: CustomEmailTemplate;
  onChange: (updated: CustomEmailTemplate) => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-lg border border-surface-3 bg-surface-0 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Template Name
            </label>
            <input
              type="text"
              value={template.name}
              onChange={(e) => onChange({ ...template, name: e.target.value })}
              className="w-full rounded-lg border border-surface-3 bg-surface-1 px-3 py-1.5 text-sm text-text-primary outline-none focus:border-accent-primary"
              placeholder="e.g., Post-Funding Outreach"
            />
          </div>

          <div className="flex gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Default Tone
              </label>
              <div className="flex gap-1">
                {TONE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => onChange({ ...template, tone: t })}
                    className={cn(
                      "rounded-lg px-2 py-1 text-xs capitalize transition-colors",
                      template.tone === t
                        ? "bg-accent-primary/15 text-accent-primary"
                        : "bg-surface-1 text-text-secondary hover:bg-surface-2"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-tertiary">
                Base Type
              </label>
              <div className="flex gap-1">
                {TYPE_OPTIONS.map((t) => (
                  <button
                    key={t}
                    onClick={() => onChange({ ...template, type: t })}
                    className={cn(
                      "rounded-lg px-2 py-1 text-xs capitalize transition-colors",
                      template.type === t
                        ? "bg-accent-secondary/15 text-accent-secondary"
                        : "bg-surface-1 text-text-secondary hover:bg-surface-2"
                    )}
                  >
                    {t.replace("_", " ")}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Prompt Instructions
            </label>
            <textarea
              value={template.promptSuffix}
              onChange={(e) => onChange({ ...template, promptSuffix: e.target.value })}
              rows={3}
              className="w-full resize-y rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-primary"
              placeholder="Instructions for the LLM when using this template..."
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              Example Output (optional)
            </label>
            <textarea
              value={template.exampleOutput ?? ""}
              onChange={(e) => onChange({ ...template, exampleOutput: e.target.value || undefined })}
              rows={3}
              className="w-full resize-y rounded-lg border border-surface-3 bg-surface-1 px-3 py-2 font-mono text-xs text-text-primary outline-none focus:border-accent-primary"
              placeholder="An example email to guide the LLM style..."
            />
          </div>
        </div>

        <button
          onClick={onDelete}
          className="flex-shrink-0 rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-danger/10 hover:text-danger"
          aria-label="Delete template"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export function EmailTemplatesSection() {
  const config = useStore((s) => s.adminConfig);
  const updateAdminConfig = useStore((s) => s.updateAdminConfig);
  const [expanded, setExpanded] = useState(false);

  const templates: CustomEmailTemplate[] = config.emailPrompts?.customTemplates ?? [];

  const handleAdd = () => {
    const newTemplate: CustomEmailTemplate = {
      id: generateId(),
      name: "",
      tone: "direct",
      type: "custom",
      promptSuffix: "",
    };
    updateAdminConfig({
      emailPrompts: {
        ...config.emailPrompts,
        customTemplates: [...templates, newTemplate],
      },
    });
    setExpanded(true);
  };

  const handleUpdate = (index: number, updated: CustomEmailTemplate) => {
    const next = [...templates];
    next[index] = updated;
    updateAdminConfig({
      emailPrompts: {
        ...config.emailPrompts,
        customTemplates: next,
      },
    });
  };

  const handleDelete = (index: number) => {
    const next = templates.filter((_, i) => i !== index);
    updateAdminConfig({
      emailPrompts: {
        ...config.emailPrompts,
        customTemplates: next,
      },
    });
  };

  return (
    <AdminSection
      title="Email Templates"
      description="Create custom email templates that your team can select when drafting outreach. Built-in templates (Cold Intro, Follow-up, Re-engagement) are always available."
    >
      {templates.length > 0 && (
        <div className="mb-4">
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-1.5 text-xs text-text-secondary transition-colors hover:text-text-primary"
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={cn("transition-transform", expanded && "rotate-90")}
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
            {templates.length} custom template{templates.length !== 1 ? "s" : ""}
          </button>
        </div>
      )}

      {expanded && templates.length > 0 && (
        <div className="mb-4 space-y-3">
          {templates.map((t, i) => (
            <TemplateEditor
              key={t.id}
              template={t}
              onChange={(updated) => handleUpdate(i, updated)}
              onDelete={() => handleDelete(i)}
            />
          ))}
        </div>
      )}

      <button
        onClick={handleAdd}
        className="rounded-lg border border-dashed border-surface-3 px-3 py-2 text-xs text-text-secondary transition-colors hover:border-accent-primary hover:text-accent-primary"
      >
        + Add Custom Template
      </button>
    </AdminSection>
  );
}
