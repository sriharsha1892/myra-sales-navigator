"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useStore } from "@/lib/navigator/store";
import { Overlay } from "@/components/primitives/Overlay";
import { useInlineFeedback } from "@/hooks/navigator/useInlineFeedback";
import { CHANNEL_CONSTRAINTS, CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import type {
  Contact,
  CompanyEnriched,
  Signal,
  EmailTone,
  EmailTemplate,
  OutreachChannel,
  OutreachDraftResponse,
  HubSpotStatus,
  CustomEmailTemplate,
} from "@/lib/navigator/types";

interface OutreachDraftModalProps {
  contact: Contact;
  company: CompanyEnriched;
  onClose: () => void;
  /** Pre-selected channel from suggestion engine */
  suggestedChannel?: OutreachChannel;
  suggestedTemplate?: EmailTemplate | "";
  suggestedTone?: EmailTone;
  suggestionReason?: string;
}

const TONE_OPTIONS: { value: EmailTone; label: string }[] = [
  { value: "formal", label: "Formal" },
  { value: "casual", label: "Casual" },
  { value: "direct", label: "Direct" },
];

const BUILT_IN_TEMPLATES: { value: EmailTemplate; label: string }[] = [
  { value: "intro", label: "Cold Intro" },
  { value: "follow_up", label: "Follow-up" },
  { value: "re_engagement", label: "Re-engagement" },
];

export function OutreachDraftModal({
  contact,
  company,
  onClose,
  suggestedChannel,
  suggestedTemplate,
  suggestedTone,
  suggestionReason,
}: OutreachDraftModalProps) {
  const addToast = useStore((s) => s.addToast);
  const emailPrompts = useStore((s) => s.adminConfig.emailPrompts);
  const outreachConfig = useStore((s) => s.adminConfig.outreachChannelConfig);
  const writingRulesSession = useStore((s) => s.writingRulesSession);
  const setWritingRules = useStore((s) => s.setWritingRules);
  const { trigger, FeedbackLabel } = useInlineFeedback();

  const customTemplates: CustomEmailTemplate[] = emailPrompts.customTemplates ?? [];

  // Enabled channels from admin config
  const enabledChannels = useMemo(() => {
    if (!outreachConfig?.enabledChannels?.length) return CHANNEL_OPTIONS.map((o) => o.value);
    return outreachConfig.enabledChannels;
  }, [outreachConfig]);

  // WhatsApp disabled if no CRM relationship
  const whatsappDisabled =
    company.hubspotStatus === "none" && company.freshsalesStatus === "none";

  const defaultChannel = suggestedChannel ?? outreachConfig?.defaultChannel ?? "email";
  const [channel, setChannel] = useState<OutreachChannel>(
    enabledChannels.includes(defaultChannel) ? defaultChannel : enabledChannels[0] ?? "email"
  );
  const [tone, setTone] = useState<EmailTone>(
    suggestedTone ?? emailPrompts.defaultTone
  );
  const [template, setTemplate] = useState<EmailTemplate | "">(
    suggestedTemplate ?? emailPrompts.defaultTemplate
  );
  const [customTemplateId, setCustomTemplateId] = useState<string>("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasGenerated, setHasGenerated] = useState(false);
  const [showWritingRules, setShowWritingRules] = useState(false);
  const [writingRulesLocal, setWritingRulesLocal] = useState(
    writingRulesSession || outreachConfig?.writingRulesDefault || ""
  );
  const [showSuggestion, setShowSuggestion] = useState(!!suggestionReason);

  // Context placeholders
  const [showPlaceholders, setShowPlaceholders] = useState(false);
  const [placeholderValues, setPlaceholderValues] = useState<Record<string, string>>({});

  // Detect {{...}} placeholders in custom template promptSuffix
  const detectedPlaceholders = useMemo(() => {
    const currentCustom = customTemplateId
      ? customTemplates.find((t) => t.id === customTemplateId)
      : null;
    if (!currentCustom?.promptSuffix) return [];
    const matches = currentCustom.promptSuffix.match(/\{\{([^}]+)\}\}/g);
    if (!matches) return [];
    const standardVars = new Set([
      "contactName", "contactTitle", "companyName", "companyIndustry",
      "signals", "hubspotStatus", "freshsalesStatus",
    ]);
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim()))].filter(
      (p) => !standardVars.has(p)
    );
  }, [customTemplateId, customTemplates]);

  const constraints = CHANNEL_CONSTRAINTS[channel];

  // Lock tone for certain channels
  useEffect(() => {
    if (channel === "linkedin_connect" && tone === "formal") {
      setTone("casual");
    }
    if (channel === "whatsapp" && tone !== "casual") {
      setTone("casual");
    }
  }, [channel, tone]);

  const handleTemplateChange = (value: string) => {
    if (value.startsWith("custom:")) {
      setCustomTemplateId(value.replace("custom:", ""));
      setTemplate("");
    } else {
      setCustomTemplateId("");
      setTemplate(value as EmailTemplate);
    }
  };

  const generate = useCallback(async () => {
    setIsGenerating(true);
    // Persist writing rules to session store
    if (writingRulesLocal.trim()) {
      setWritingRules(writingRulesLocal.trim());
    }

    try {
      const deal = company.freshsalesIntel?.deals?.[0];
      const res = await fetch("/api/outreach/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contactName: `${contact.firstName} ${contact.lastName}`,
          contactId: contact.id,
          contactTitle: contact.title,
          companyName: company.name,
          companyIndustry: company.industry || company.vertical || "Technology",
          signals: company.signals?.slice(0, 5) ?? ([] as Signal[]),
          hubspotStatus: (company.hubspotStatus || "none") as HubSpotStatus,
          template: template || undefined,
          tone,
          channel,
          contactHeadline: contact.headline ?? undefined,
          contactSeniority: contact.seniority ?? undefined,
          icpScore: company.icpScore ?? undefined,
          icpBreakdown: company.icpBreakdown ?? undefined,
          freshsalesStatus:
            company.freshsalesStatus !== "none" ? company.freshsalesStatus : undefined,
          freshsalesDealStage: deal?.stage ?? undefined,
          freshsalesDealAmount: deal?.amount ?? undefined,
          customTemplateId: customTemplateId || undefined,
          writingRules: writingRulesLocal.trim() || undefined,
          contextPlaceholders:
            Object.keys(placeholderValues).length > 0 ? placeholderValues : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Generation failed");
      }

      const draft: OutreachDraftResponse = await res.json();
      setSubject(draft.subject ?? "");
      setMessage(draft.message);
      setHasGenerated(true);
    } catch (err) {
      addToast({
        message: err instanceof Error ? err.message : "Draft generation failed — check your connection and try again",
        type: "error",
      });
    } finally {
      setIsGenerating(false);
    }
  }, [
    contact, company, tone, template, channel, customTemplateId,
    writingRulesLocal, placeholderValues, addToast, setWritingRules,
  ]);

  const handleCopy = useCallback(() => {
    const parts: string[] = [];
    if (subject && constraints.hasSubject) parts.push(`Subject: ${subject}`);
    parts.push(message);
    navigator.clipboard
      .writeText(parts.join("\n\n"))
      .then(() => trigger("Copied"))
      .catch(() => trigger("Copy failed", "error"));
  }, [subject, message, constraints.hasSubject, trigger]);

  // Character counter
  const charCount = message.length;
  const charLimit = constraints.maxChars;
  const charWarning = charLimit ? charCount >= charLimit * 0.9 : false;
  const charOver = charLimit ? charCount > charLimit : false;

  // Filtered tone options by channel
  const availableTones = useMemo(() => {
    if (channel === "linkedin_connect") return TONE_OPTIONS.filter((t) => t.value !== "formal");
    if (channel === "whatsapp") return TONE_OPTIONS.filter((t) => t.value === "casual");
    return TONE_OPTIONS;
  }, [channel]);

  return (
    <Overlay open={true} onClose={onClose} backdrop="blur" placement="center">
      <div className="w-full max-w-[600px] rounded-card border border-surface-3 bg-surface-1 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-3 px-5 py-3.5">
          <div>
            <h3 className="font-display text-base font-medium text-text-primary">
              Draft Outreach
            </h3>
            <p className="mt-0.5 text-xs text-text-tertiary">
              {contact.firstName} {contact.lastName} at {company.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Suggestion pill */}
        {showSuggestion && suggestionReason && (
          <div className="flex items-center gap-2 border-b border-surface-3 bg-accent-primary/5 px-5 py-2">
            <span className="text-xs text-accent-primary">Suggested:</span>
            <span className="text-xs text-text-secondary">{suggestionReason}</span>
            <button
              onClick={() => setShowSuggestion(false)}
              className="ml-auto rounded-lg p-1.5 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-primary"
              aria-label="Dismiss suggestion"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Channel selector */}
        <div className="flex gap-1 border-b border-surface-3 px-5 py-2.5">
          {CHANNEL_OPTIONS.filter((opt) => enabledChannels.includes(opt.value)).map((opt) => {
            const isDisabled = opt.value === "whatsapp" && whatsappDisabled;
            const isActive = channel === opt.value;
            const btn = (
              <button
                key={opt.value}
                onClick={() => !isDisabled && setChannel(opt.value)}
                disabled={isDisabled}
                className={`rounded-pill px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-accent-primary/15 text-accent-primary font-medium"
                    : isDisabled
                      ? "cursor-not-allowed text-text-tertiary/40"
                      : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            );
            return isDisabled ? (
              <Tooltip key={opt.value} text="Requires prior CRM contact">{btn}</Tooltip>
            ) : btn;
          })}
        </div>

        {/* Controls */}
        <div className="flex gap-3 border-b border-surface-3 px-5 py-3">
          {/* Template selector */}
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Template
            </label>
            <select
              value={customTemplateId ? `custom:${customTemplateId}` : template}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-2.5 py-1.5 text-xs text-text-primary outline-none transition-colors focus:border-accent-primary"
            >
              {BUILT_IN_TEMPLATES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
              {customTemplates.length > 0 && (
                <optgroup label="Custom Templates">
                  {customTemplates.map((t) => (
                    <option key={t.id} value={`custom:${t.id}`}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Tone selector */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Tone
            </label>
            <div className="flex gap-1">
              {availableTones.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTone(opt.value)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    tone === opt.value
                      ? "bg-accent-primary/15 text-accent-primary"
                      : "bg-surface-0 text-text-secondary hover:bg-surface-2"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Writing rules (collapsible) */}
        <div className="border-b border-surface-3 px-5">
          <button
            onClick={() => setShowWritingRules(!showWritingRules)}
            className="flex w-full items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary"
          >
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className={`transition-transform duration-[180ms] ${showWritingRules ? "" : "-rotate-90"}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            Writing Rules
            {writingRulesLocal.trim() && (
              <span className="ml-1 text-xs text-accent-primary">active</span>
            )}
          </button>
          {showWritingRules && (
            <textarea
              value={writingRulesLocal}
              onChange={(e) => setWritingRulesLocal(e.target.value)}
              rows={3}
              placeholder="Add custom writing rules (e.g., mention a specific product, avoid certain topics...)"
              className="mb-2 w-full resize-y rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
            />
          )}
        </div>

        {/* Context placeholders (collapsible) */}
        {detectedPlaceholders.length > 0 && (
          <div className="border-b border-surface-3 px-5">
            <button
              onClick={() => setShowPlaceholders(!showPlaceholders)}
              className="flex w-full items-center gap-1.5 py-2 text-xs font-semibold uppercase tracking-wider text-text-secondary hover:text-text-primary"
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className={`transition-transform duration-[180ms] ${showPlaceholders ? "" : "-rotate-90"}`}
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
              Context Variables ({detectedPlaceholders.length})
            </button>
            {showPlaceholders && (
              <div className="mb-2 space-y-1.5">
                {detectedPlaceholders.map((key) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="min-w-[100px] font-mono text-xs text-text-secondary">
                      {`{{${key}}}`}
                    </span>
                    <input
                      type="text"
                      value={placeholderValues[key] ?? ""}
                      onChange={(e) =>
                        setPlaceholderValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      className="flex-1 rounded-lg border border-surface-3 bg-surface-0 px-2 py-1 text-xs text-text-primary outline-none focus:border-accent-primary"
                      placeholder={`Value for ${key}`}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Draft area */}
        <div className="px-5 py-4">
          {!hasGenerated && !isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <p className="mb-3 text-sm text-text-secondary">
                Generate a personalized {channel === "email" ? "email" : channel.replace("_", " ")} draft based on prospect data and signals.
              </p>
              <button
                onClick={generate}
                className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                Generate Draft
              </button>
            </div>
          ) : isGenerating ? (
            <div className="flex flex-col items-center justify-center py-8">
              <div className="mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
              <p className="text-xs text-text-tertiary">Generating draft...</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Subject (only for channels that have it) */}
              {constraints.hasSubject && (
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary"
                  />
                </div>
              )}

              {/* Message */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                    Message
                  </label>
                  {charLimit && (
                    <span
                      className={`font-mono text-xs ${
                        charOver
                          ? "text-danger"
                          : charWarning
                            ? "text-warning"
                            : "text-text-tertiary"
                      }`}
                    >
                      {charCount}/{charLimit}
                    </span>
                  )}
                </div>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={channel === "linkedin_connect" || channel === "whatsapp" ? 5 : 10}
                  className={`w-full resize-y rounded-lg border bg-surface-0 px-3 py-2 font-mono text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-accent-primary ${
                    charOver ? "border-danger" : "border-surface-3"
                  }`}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        {hasGenerated && !isGenerating && (
          <div className="flex items-center justify-between border-t border-surface-3 px-5 py-3">
            <button
              onClick={generate}
              className="rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
            >
              Regenerate
            </button>
            <div className="flex items-center gap-2">
              {FeedbackLabel}
              <button
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-xs text-text-secondary transition-colors hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={handleCopy}
                className="rounded-lg bg-accent-primary px-4 py-1.5 text-xs font-medium text-surface-0 transition-opacity hover:opacity-90"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        )}
      </div>
    </Overlay>
  );
}
