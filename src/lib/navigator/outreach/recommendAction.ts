import type { CompanyEnriched, Contact, OutreachChannel } from "../types";

export interface RecommendedAction {
  action: "draft_outreach" | "export_contacts" | "add_note" | "re_engage" | "skip";
  label: string;
  description: string;
  contactId?: string;
  channel?: OutreachChannel;
  priority: "high" | "medium" | "low";
  reason: string;
}

interface ActionRule {
  id: string;
  name: string;
  checkFn: (ctx: ActionContext) => boolean;
  buildAction: (ctx: ActionContext) => RecommendedAction;
}

interface ActionContext {
  company: CompanyEnriched;
  contacts: Contact[];
  topContact: Contact | null;
}

function getTopContact(contacts: Contact[]): Contact | null {
  if (contacts.length === 0) return null;
  // Prefer C-level/VP with email
  const sorted = [...contacts].sort((a, b) => {
    const seniorityOrder: Record<string, number> = { c_level: 0, vp: 1, director: 2, manager: 3, staff: 4 };
    const aScore = seniorityOrder[a.seniority] ?? 5;
    const bScore = seniorityOrder[b.seniority] ?? 5;
    if (aScore !== bScore) return aScore - bScore;
    // Prefer contacts with email
    if (a.email && !b.email) return -1;
    if (!a.email && b.email) return 1;
    return 0;
  });
  return sorted[0];
}

const RULES: ActionRule[] = [
  {
    id: "high_icp_new",
    name: "High ICP + signals + no exports → Draft outreach",
    checkFn: (ctx) =>
      ctx.company.icpScore >= 75 &&
      ctx.company.signals.length > 0 &&
      ctx.company.extractionCount === 0 &&
      (ctx.company.status === "new" || ctx.company.status === "researching"),
    buildAction: (ctx) => {
      const parts: string[] = [];
      if (ctx.topContact) {
        const senLabels: Record<string, string> = { c_level: "C-level", vp: "VP", director: "Director", manager: "Manager" };
        parts.push(`${senLabels[ctx.topContact.seniority] ?? ctx.topContact.seniority}-level contact`);
        if (ctx.topContact.email) parts.push("with email");
      }
      const signalTypes = [...new Set(ctx.company.signals.map((s) => s.type))].slice(0, 2);
      if (signalTypes.length > 0) parts.push(`${signalTypes.join(" + ")} signal`);
      parts.push(`ICP ${ctx.company.icpScore}`);
      return {
        action: "draft_outreach",
        label: `Reach out to ${ctx.topContact ? `${ctx.topContact.firstName} ${ctx.topContact.lastName}` : "a contact"}`,
        description: "High ICP fit with buying signals and no exports yet.",
        contactId: ctx.topContact?.id,
        channel: "email",
        priority: "high",
        reason: parts.join(" \u00b7 "),
      };
    },
  },
  {
    id: "researching_stale",
    name: "Researching >5d → Time to act",
    checkFn: (ctx) => {
      if (ctx.company.status !== "researching") return false;
      const changed = ctx.company.statusChangedAt;
      if (!changed) return false;
      const daysSince = (Date.now() - new Date(changed).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 5;
    },
    buildAction: (ctx) => {
      const days = ctx.company.statusChangedAt
        ? Math.floor((Date.now() - new Date(ctx.company.statusChangedAt).getTime()) / (1000 * 60 * 60 * 24))
        : 0;
      return {
        action: "draft_outreach",
        label: "Time to act",
        description: `Researching for ${days} days — consider reaching out or moving on.`,
        contactId: ctx.topContact?.id,
        channel: "email",
        priority: "medium",
        reason: `In researching status for ${days} days with no outreach`,
      };
    },
  },
  {
    id: "exported_stale",
    name: "Exported >7d ago → Follow up",
    checkFn: (ctx) => {
      if (!ctx.company.lastExtractionAt) return false;
      const daysSince = (Date.now() - new Date(ctx.company.lastExtractionAt).getTime()) / (1000 * 60 * 60 * 24);
      return daysSince > 7 && ctx.company.status === "contacted";
    },
    buildAction: (ctx) => {
      const expDays = ctx.company.lastExtractionAt
        ? Math.floor((Date.now() - new Date(ctx.company.lastExtractionAt).getTime()) / (1000 * 60 * 60 * 24))
        : 7;
      return {
        action: "re_engage",
        label: "Follow up on exports",
        description: "Contacts were exported over a week ago — time for a follow-up.",
        priority: "medium",
        reason: `Contacts exported ${expDays}d ago with contacted status`,
      };
    },
  },
  {
    id: "expansion_opp",
    name: "Won + expansion signal → Expansion",
    checkFn: (ctx) =>
      (ctx.company.hubspotStatus === "closed_won" ||
        ctx.company.freshsalesStatus === "won" ||
        ctx.company.freshsalesStatus === "customer") &&
      ctx.company.signals.some((s) => s.type === "expansion" || s.type === "hiring"),
    buildAction: (ctx) => {
      const sigTypes = ctx.company.signals
        .filter((s) => s.type === "expansion" || s.type === "hiring")
        .map((s) => s.type);
      const uniqSigs = [...new Set(sigTypes)].join(" + ");
      return {
        action: "draft_outreach",
        label: "Expansion opportunity",
        description: "Existing customer with expansion/hiring signals.",
        contactId: ctx.topContact?.id,
        channel: "email",
        priority: "high",
        reason: `Existing customer with ${uniqSigs} signals`,
      };
    },
  },
  {
    id: "low_icp",
    name: "Low ICP → Consider skipping",
    checkFn: (ctx) => ctx.company.icpScore < 40,
    buildAction: (ctx) => ({
      action: "skip",
      label: "Low ICP fit",
      description: "Consider skipping — ICP score below threshold.",
      priority: "low",
      reason: `ICP score ${ctx.company.icpScore} is below 40 threshold`,
    }),
  },
  {
    id: "no_contacts",
    name: "No contacts → Load contacts",
    checkFn: (ctx) => ctx.contacts.length === 0,
    buildAction: () => ({
      action: "export_contacts",
      label: "Load contacts first",
      description: "No contacts loaded yet for this company.",
      priority: "medium",
      reason: "No contacts available to evaluate",
    }),
  },
];

/**
 * Returns a recommended action for a company dossier.
 */
export function recommendAction(
  company: CompanyEnriched,
  contacts: Contact[],
  ruleToggles: { id: string; name: string; enabled: boolean }[]
): RecommendedAction | null {
  const toggleMap = new Map(ruleToggles.map((r) => [r.id, r.enabled]));
  const topContact = getTopContact(contacts);
  const ctx: ActionContext = { company, contacts, topContact };

  for (const rule of RULES) {
    if (toggleMap.has(rule.id) && !toggleMap.get(rule.id)) continue;
    if (rule.checkFn(ctx)) return rule.buildAction(ctx);
  }

  return null;
}
