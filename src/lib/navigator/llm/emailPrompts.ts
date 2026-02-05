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

  // Check for custom template first, then built-in
  let templateInstruction: string;
  if (request.customTemplateId && c.customTemplates?.length) {
    const custom = c.customTemplates.find((t) => t.id === request.customTemplateId);
    if (custom) {
      templateInstruction = custom.promptSuffix;
      if (custom.exampleOutput) {
        templateInstruction += `\n\nExample of desired output style:\n${custom.exampleOutput}`;
      }
    } else {
      const templateKey = request.template ?? "intro";
      templateInstruction = c.templateInstructions[templateKey]
        || defaultEmailPrompts.templateInstructions[templateKey];
    }
  } else {
    const templateKey = request.template ?? "intro";
    templateInstruction = c.templateInstructions[templateKey]
      || defaultEmailPrompts.templateInstructions[templateKey];
  }

  // --- About the contact ---
  const contactLines = [
    `- Name: ${request.contactName}`,
    `- Title: ${request.contactTitle}`,
  ];
  if (request.contactHeadline) {
    contactLines.push(`- LinkedIn headline: ${request.contactHeadline}`);
  }
  if (request.contactSeniority) {
    contactLines.push(`- Seniority: ${request.contactSeniority}`);
  }

  // --- About the company ---
  const companyLines = [
    `- Company: ${request.companyName}`,
    `- Industry: ${request.companyIndustry}`,
  ];
  if (request.icpScore !== undefined) {
    companyLines.push(`- ICP fit score: ${request.icpScore}/100`);
  }
  if (request.icpBreakdown?.length) {
    const matched = request.icpBreakdown
      .filter((b) => b.matched && b.points > 0)
      .map((b) => b.factor);
    if (matched.length > 0) {
      companyLines.push(`- Strong ICP matches: ${matched.join(", ")}`);
    }
  }

  // --- Signals with dates ---
  const signalContext = request.signals.length > 0
    ? request.signals
        .map((s) => `- ${s.type}: ${s.title}${s.date && s.date !== "unknown" ? ` (${s.date})` : ""} — ${s.description}`)
        .join("\n")
    : "No specific signals available.";

  // --- Relationship history ---
  const relationshipLines: string[] = [];
  if (request.hubspotStatus !== "none") {
    relationshipLines.push(`HubSpot status: ${request.hubspotStatus}. We have an existing relationship.`);
  } else {
    relationshipLines.push("No existing HubSpot relationship. This is a net-new prospect.");
  }
  if (request.freshsalesStatus && request.freshsalesStatus !== "none") {
    let fsLine = `Freshsales status: ${request.freshsalesStatus}`;
    if (request.freshsalesDealStage) fsLine += ` (stage: ${request.freshsalesDealStage})`;
    if (request.freshsalesDealAmount) fsLine += ` — deal value: $${(request.freshsalesDealAmount / 1000).toFixed(0)}K`;
    relationshipLines.push(fsLine);
  }

  // Determine word limit by template type
  const wordLimit = request.template === "follow_up" ? 100 : 150;

  return `You are a B2B sales email writer for myRA, ${companyDesc}.${valueProp}

Return JSON: { "subject": "...", "body": "..." }
The body should use plain text with line breaks (\\n). No HTML. No markdown formatting.${suffix}

INSTRUCTIONS:
1. Use the prospect's industry and role to frame relevance. Signals are background context to shape your angle — do NOT explicitly reference them or make the email feel like surveillance.
2. Write a concise, human-sounding outreach email. Keep it under ${wordLimit} words.
3. The subject line must be specific to the prospect — no generic subjects.

DO NOT:
- Use generic openers like "I hope this finds you well" or "I came across your company"
- Mention AI, automation, or that this email was generated
- Use buzzwords like "synergy", "leverage", "revolutionize", "cutting-edge", "game-changer"
- Use filler phrases or corporate jargon
- Start with the sender's name or company — lead with value for the recipient

Tone: ${toneInstructions}

Template type: ${templateInstruction}

--- About the contact ---
${contactLines.join("\n")}

--- About the company ---
${companyLines.join("\n")}

--- Relationship history ---
${relationshipLines.join("\n")}

--- Company signals ---
${signalContext}

Write the email now.`;
}
