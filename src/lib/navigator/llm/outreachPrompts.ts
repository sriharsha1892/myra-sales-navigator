import type { EmailDraftRequest, OutreachDraftRequest, EmailPromptsConfig } from "../types";
import { CHANNEL_CONSTRAINTS } from "../outreach/channelConfig";
import { buildEmailPrompt } from "./emailPrompts";
import { defaultEmailPrompts } from "../mock-data";

/**
 * Build shared prospect context lines from a draft request.
 * Used by both email and multi-channel outreach prompts.
 */
export function buildProspectContext(request: EmailDraftRequest): {
  contactLines: string[];
  companyLines: string[];
  signalContext: string;
  relationshipLines: string[];
} {
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

  const signalContext =
    request.signals.length > 0
      ? request.signals
          .map(
            (s) =>
              `- ${s.type}: ${s.title}${s.date && s.date !== "unknown" ? ` (${s.date})` : ""} — ${s.description}`
          )
          .join("\n")
      : "No specific signals available.";

  const relationshipLines: string[] = [];
  if (request.hubspotStatus !== "none") {
    relationshipLines.push(
      `HubSpot status: ${request.hubspotStatus}. We have an existing relationship.`
    );
  } else {
    relationshipLines.push("No existing HubSpot relationship. This is a net-new prospect.");
  }
  if (request.freshsalesStatus && request.freshsalesStatus !== "none") {
    let fsLine = `Freshsales status: ${request.freshsalesStatus}`;
    if (request.freshsalesDealStage) fsLine += ` (stage: ${request.freshsalesDealStage})`;
    if (request.freshsalesDealAmount)
      fsLine += ` — deal value: $${(request.freshsalesDealAmount / 1000).toFixed(0)}K`;
    relationshipLines.push(fsLine);
  }

  return { contactLines, companyLines, signalContext, relationshipLines };
}

/**
 * Build an outreach prompt for any channel.
 * For email, delegates to existing buildEmailPrompt for full backward compat.
 */
export function buildOutreachPrompt(
  request: OutreachDraftRequest,
  config?: EmailPromptsConfig
): string {
  // Email channel: delegate to existing builder
  if (request.channel === "email") {
    return buildEmailPrompt(request, config);
  }

  const c = config ?? defaultEmailPrompts;
  const constraints = CHANNEL_CONSTRAINTS[request.channel];
  const { contactLines, companyLines, signalContext, relationshipLines } =
    buildProspectContext(request);

  const companyDesc = c.companyDescription || defaultEmailPrompts.companyDescription;
  const valueProp = c.valueProposition
    ? `\nOur value proposition: ${c.valueProposition}`
    : "";

  // Character/word limit instructions
  const limitParts: string[] = [];
  if (constraints.maxChars) {
    limitParts.push(`STRICT: Must be under ${constraints.maxChars} characters total.`);
  }
  if (constraints.maxWords) {
    limitParts.push(`Keep it under ${constraints.maxWords} words.`);
  }
  const limitInstructions = limitParts.join(" ");

  // Determine output format
  const outputFormat = constraints.hasSubject
    ? 'Return JSON: { "subject": "...", "message": "..." }'
    : 'Return JSON: { "message": "..." }';

  // Tone
  const toneInstructions =
    c.toneInstructions[request.tone] || defaultEmailPrompts.toneInstructions[request.tone];

  // Writing rules
  const writingRulesBlock = request.writingRules
    ? `\n\nADDITIONAL WRITING RULES:\n${request.writingRules}`
    : "";

  // Context placeholders
  const placeholderBlock =
    request.contextPlaceholders && Object.keys(request.contextPlaceholders).length > 0
      ? `\n\nADDITIONAL CONTEXT:\n${Object.entries(request.contextPlaceholders)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

  return `You are a B2B sales outreach writer for myRA, ${companyDesc}.${valueProp}

${outputFormat}
The message should use plain text. No HTML. No markdown formatting.

PLATFORM: ${constraints.platformGuidance}

${limitInstructions}

INSTRUCTIONS:
1. Identify the single most relevant signal or insight about this prospect. Build the message around that specific hook.
2. Write a concise, human-sounding message.
3. ${constraints.hasSubject ? "The subject line must be specific to the prospect." : "No subject line needed."}

DO NOT:
- Use generic openers like "I hope this finds you well" or "I came across your company"
- Mention AI, automation, or that this message was generated
- Use buzzwords like "synergy", "leverage", "revolutionize", "cutting-edge", "game-changer"
- Use filler phrases or corporate jargon

Tone: ${toneInstructions}

--- About the contact ---
${contactLines.join("\n")}

--- About the company ---
${companyLines.join("\n")}

--- Relationship history ---
${relationshipLines.join("\n")}

--- Company signals ---
${signalContext}${writingRulesBlock}${placeholderBlock}

Write the message now.`;
}
