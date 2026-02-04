import type { EmailDraftRequest, EmailPromptsConfig } from "../types";
import { defaultEmailPrompts } from "../mock-data";

// ---------------------------------------------------------------------------
// Build the full prompt from request data + admin-configurable config
// ---------------------------------------------------------------------------

export function buildEmailPrompt(
  request: EmailDraftRequest,
  config?: EmailPromptsConfig
): string {
  const c = config ?? defaultEmailPrompts;

  const companyDesc = c.companyDescription || defaultEmailPrompts.companyDescription;
  const valueProp = c.valueProposition
    ? `\nOur value proposition: ${c.valueProposition}`
    : "";
  const suffix = c.systemPromptSuffix
    ? `\n\n${c.systemPromptSuffix}`
    : "";

  const toneInstructions = c.toneInstructions[request.tone]
    || defaultEmailPrompts.toneInstructions[request.tone];

  const templateKey = request.template ?? "intro";
  const templateInstruction = c.templateInstructions[templateKey]
    || defaultEmailPrompts.templateInstructions[templateKey];

  const signalContext = request.signals.length > 0
    ? request.signals
        .map((s) => `- ${s.type}: ${s.title} — ${s.description}`)
        .join("\n")
    : "No specific signals available.";

  const hubspotContext = request.hubspotStatus !== "none"
    ? `HubSpot status: ${request.hubspotStatus}. We have an existing relationship.`
    : "No existing HubSpot relationship. This is a net-new prospect.";

  return `You are a B2B sales email writer for myRA, ${companyDesc}. Write concise, human-sounding cold outreach emails. No corporate jargon, no filler phrases, no "I hope this finds you well." Get to the point. Reference specific signals or company details to show genuine research. Keep it under 150 words.${valueProp}

Return JSON: { "subject": "...", "body": "..." }

The body should use plain text with line breaks (\\n). No HTML. No markdown formatting.${suffix}

Tone: ${toneInstructions}

Template type: ${templateInstruction}

Prospect details:
- Name: ${request.contactName}
- Title: ${request.contactTitle}
- Company: ${request.companyName}
- Industry: ${request.companyIndustry}
- ${hubspotContext}

Company signals:
${signalContext}

Write the email now.`;
}
