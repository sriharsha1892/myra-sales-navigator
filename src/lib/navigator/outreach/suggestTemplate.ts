import type {
  OutreachChannel,
  EmailTemplate,
  EmailTone,
  CompanyEnriched,
  Contact,
} from "../types";

export interface TemplateSuggestion {
  channel: OutreachChannel;
  template: EmailTemplate | string;
  tone: EmailTone;
  reason: string;
}

interface SuggestionRule {
  id: string;
  name: string;
  checkFn: (ctx: SuggestionContext) => boolean;
  suggestion: TemplateSuggestion;
}

interface SuggestionContext {
  company: CompanyEnriched;
  contact: Contact;
  existingDraftChannels: string[];
}

const RULES: SuggestionRule[] = [
  {
    id: "net_new_connect",
    name: "Net-new → LinkedIn Connect",
    checkFn: (ctx) =>
      (ctx.company.hubspotStatus === "none" || ctx.company.hubspotStatus === "new") &&
      ctx.company.freshsalesStatus === "none" &&
      !ctx.existingDraftChannels.includes("linkedin_connect"),
    suggestion: {
      channel: "linkedin_connect",
      template: "intro",
      tone: "casual",
      reason: "Net-new — connect first",
    },
  },
  {
    id: "net_new_has_connect",
    name: "Has connect draft → Email intro",
    checkFn: (ctx) =>
      (ctx.company.hubspotStatus === "none" || ctx.company.hubspotStatus === "new") &&
      ctx.existingDraftChannels.includes("linkedin_connect"),
    suggestion: {
      channel: "email",
      template: "intro",
      tone: "direct",
      reason: "Already connected — send intro email",
    },
  },
  {
    id: "open_deal_stale",
    name: "Open deal stale >30d → Re-engagement",
    checkFn: (ctx) => {
      if (ctx.company.hubspotStatus !== "open" && ctx.company.hubspotStatus !== "in_progress")
        return false;
      const changed = ctx.company.statusChangedAt;
      if (!changed) return false;
      const daysSince = (Date.now() - new Date(changed).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 30;
    },
    suggestion: {
      channel: "email",
      template: "re_engagement",
      tone: "formal",
      reason: "Deal gone cold — re-engage",
    },
  },
  {
    id: "won_customer",
    name: "Won/customer → Follow-up",
    checkFn: (ctx) =>
      ctx.company.hubspotStatus === "closed_won" ||
      ctx.company.freshsalesStatus === "won" ||
      ctx.company.freshsalesStatus === "customer",
    suggestion: {
      channel: "email",
      template: "follow_up",
      tone: "casual",
      reason: "Expansion opportunity — existing customer",
    },
  },
  {
    id: "high_icp_signals",
    name: "High ICP + signals → Email intro",
    checkFn: (ctx) => ctx.company.icpScore >= 80 && ctx.company.signals.length > 0,
    suggestion: {
      channel: "email",
      template: "intro",
      tone: "direct",
      reason: "Strong ICP fit with buying signals",
    },
  },
  {
    id: "c_level_inmail",
    name: "C-level/VP → InMail",
    checkFn: (ctx) =>
      ctx.contact.seniority === "c_level" || ctx.contact.seniority === "vp",
    suggestion: {
      channel: "linkedin_inmail",
      template: "intro",
      tone: "formal",
      reason: "Senior contact — InMail recommended",
    },
  },
  {
    id: "fallback",
    name: "Default → Email intro",
    checkFn: () => true,
    suggestion: {
      channel: "email",
      template: "intro",
      tone: "formal",
      reason: "Default outreach",
    },
  },
];

/**
 * Returns the first matching template suggestion based on priority rules.
 */
export function suggestTemplate(
  company: CompanyEnriched,
  contact: Contact,
  ruleToggles: { id: string; name: string; enabled: boolean }[],
  existingDraftChannels: string[] = []
): TemplateSuggestion {
  const toggleMap = new Map(ruleToggles.map((r) => [r.id, r.enabled]));
  const ctx: SuggestionContext = { company, contact, existingDraftChannels };

  for (const rule of RULES) {
    // If admin has explicitly disabled this rule, skip it
    if (toggleMap.has(rule.id) && !toggleMap.get(rule.id)) continue;
    if (rule.checkFn(ctx)) return rule.suggestion;
  }

  // Should never reach here due to fallback, but just in case
  return RULES[RULES.length - 1].suggestion;
}
