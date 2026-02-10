"use client";

import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";

export function TeamMomentumLine() {
  const searchResults = useStore((s) => s.searchResults);

  const { data } = useQuery({
    queryKey: ["team-daily-summary"],
    queryFn: async () => {
      const res = await fetch("/api/team-activity/daily-summary");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60 * 60 * 1000, // 1 hour
    enabled: searchResults === null, // only on home screen
  });

  if (
    !data ||
    (data.companiesReviewed === 0 &&
      data.contactsExported === 0 &&
      data.outreachSteps === 0)
  ) {
    return null;
  }

  const parts: string[] = [];
  if (data.companiesReviewed > 0) parts.push(`${data.companiesReviewed} reviewed`);
  if (data.contactsExported > 0) parts.push(`${data.contactsExported} exported`);
  if (data.outreachSteps > 0) parts.push(`${data.outreachSteps} outreach steps`);
  if (data.activeMembers > 0) parts.push(`${data.activeMembers} active`);

  return (
    <div className="mt-3 border-t border-surface-3 pt-2">
      <p className="text-xs text-text-tertiary">
        Yesterday: {parts.join(" \u00B7 ")}
      </p>
    </div>
  );
}
