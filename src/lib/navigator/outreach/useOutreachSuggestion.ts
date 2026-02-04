"use client";

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { suggestTemplate, type TemplateSuggestion } from "./suggestTemplate";
import type { CompanyEnriched, Contact } from "../types";

/**
 * Fetches existing draft channels for a contact, then runs suggestTemplate()
 * with admin rule toggles to produce a TemplateSuggestion.
 *
 * @param company  The enriched company (or null)
 * @param contact  The contact to suggest outreach for (or null)
 * @param enabled  Only fetch/compute when true (e.g. when modal is open)
 */
export function useOutreachSuggestion(
  company: CompanyEnriched | null | undefined,
  contact: Contact | null | undefined,
  enabled: boolean
): TemplateSuggestion | null {
  const rules = useStore((s) => s.adminConfig?.outreachSuggestionRules) ?? [];

  const { data: existingDraftChannels } = useQuery<string[]>({
    queryKey: ["outreach-drafts", contact?.id],
    queryFn: async () => {
      const res = await fetch(`/api/outreach/drafts?contactId=${contact!.id}`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.drafts ?? []).map((d: { channel: string }) => d.channel);
    },
    enabled: enabled && !!contact?.id,
    staleTime: 60_000,
  });

  if (!company || !contact || !enabled) return null;
  return suggestTemplate(company, contact, rules, existingDraftChannels ?? []);
}
