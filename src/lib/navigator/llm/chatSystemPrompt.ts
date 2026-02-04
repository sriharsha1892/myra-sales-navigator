import type { ChatbotConfig } from "../types";
import { DEFAULT_CHATBOT_CONFIG } from "../types";

interface CompanyContext {
  companyName?: string;
  companyDomain?: string;
  industry?: string;
  employeeCount?: number;
  location?: string;
  icpScore?: number;
  hubspotStatus?: string;
  signals?: { type: string; title: string }[];
  contacts?: { name: string; title: string; email?: string }[];
  status?: string;
}

export function buildChatSystemPrompt(
  config: ChatbotConfig | undefined,
  companyContext?: CompanyContext
): string {
  const cfg = config ?? DEFAULT_CHATBOT_CONFIG;
  const parts: string[] = [];

  // Core system prompt
  parts.push(cfg.systemPrompt);

  // App help context
  if (cfg.appHelpContext) {
    parts.push("\n--- APP HELP KNOWLEDGE ---");
    parts.push(cfg.appHelpContext);
  }

  // Custom admin instructions
  if (cfg.customInstructions) {
    parts.push("\n--- ADDITIONAL INSTRUCTIONS ---");
    parts.push(cfg.customInstructions);
  }

  // Company context injection
  if (companyContext?.companyName) {
    parts.push("\n--- CURRENTLY SELECTED COMPANY ---");
    parts.push(cfg.companyAnalysisPrompt);
    parts.push(`Company: ${companyContext.companyName}`);
    if (companyContext.companyDomain) parts.push(`Domain: ${companyContext.companyDomain}`);
    if (companyContext.industry) parts.push(`Industry: ${companyContext.industry}`);
    if (companyContext.employeeCount) parts.push(`Employees: ${companyContext.employeeCount}`);
    if (companyContext.location) parts.push(`Location: ${companyContext.location}`);
    if (companyContext.icpScore !== undefined) parts.push(`ICP Score: ${companyContext.icpScore}/100`);
    if (companyContext.hubspotStatus && companyContext.hubspotStatus !== "none") parts.push(`HubSpot Status: ${companyContext.hubspotStatus}`);
    if (companyContext.status) parts.push(`Pipeline Status: ${companyContext.status}`);

    if (companyContext.signals && companyContext.signals.length > 0) {
      parts.push("Signals:");
      for (const s of companyContext.signals.slice(0, 5)) {
        parts.push(`  - [${s.type}] ${s.title}`);
      }
    }

    if (companyContext.contacts && companyContext.contacts.length > 0) {
      parts.push("Key Contacts:");
      for (const c of companyContext.contacts.slice(0, 5)) {
        parts.push(`  - ${c.name} (${c.title})${c.email ? ` - ${c.email}` : ""}`);
      }
    }
  }

  return parts.join("\n");
}
