"use client";

import { useStore } from "@/lib/navigator/store";
import { SourceBadge } from "@/components/navigator/badges";
import { getVerificationDotColor, getConfidenceDotColor } from "@/lib/navigator/verification";

const seniorityOrder: Record<string, number> = {
  c_level: 0, vp: 1, director: 2, manager: 3, staff: 4,
};

interface ContactPreviewPopoverProps {
  domain: string;
}

export function ContactPreviewPopover({ domain }: ContactPreviewPopoverProps) {
  const contacts = useStore((s) => s.contactsByDomain[domain]);

  if (!contacts || contacts.length === 0) {
    return (
      <div className="absolute bottom-full right-0 z-20 mb-1 hidden w-64 rounded-card border border-surface-3 bg-surface-1 p-2.5 shadow-lg group-hover/contacts:block">
        <p className="text-xs italic text-text-tertiary">Open dossier to see contacts</p>
      </div>
    );
  }

  const sorted = [...contacts].sort(
    (a, b) => (seniorityOrder[a.seniority] ?? 5) - (seniorityOrder[b.seniority] ?? 5)
  );
  const top3 = sorted.slice(0, 3);
  const remaining = contacts.length - 3;

  return (
    <div className="absolute bottom-full right-0 z-20 mb-1 hidden w-64 rounded-card border border-surface-3 bg-surface-1 p-2.5 shadow-lg group-hover/contacts:block">
      <div className="space-y-1.5">
        {top3.map((c) => (
          <div key={c.id} className="flex items-center gap-1.5 text-[10px]">
            <span className="truncate font-medium text-text-primary">
              {c.firstName} {c.lastName}
            </span>
            <span className="truncate text-text-tertiary">{c.title}</span>
            {c.email && (
              <span className="ml-auto flex shrink-0 items-center gap-1 max-w-[120px]">
                <span className="truncate font-mono text-text-secondary">
                  {c.email}
                </span>
                <span
                  className={`h-[5px] w-[5px] flex-shrink-0 rounded-full ${getVerificationDotColor(c)}`}
                  title={c.verificationStatus ?? "unverified"}
                />
                <span
                  className={`h-[5px] w-[5px] flex-shrink-0 rounded-full ${getConfidenceDotColor(c)}`}
                  title={`Confidence: ${c.emailConfidence}%`}
                />
              </span>
            )}
            {c.sources[0] && <SourceBadge source={c.sources[0]} />}
          </div>
        ))}
      </div>
      {remaining > 0 && (
        <p className="mt-1.5 text-[10px] text-text-tertiary">
          +{remaining} more in dossier
        </p>
      )}
    </div>
  );
}
