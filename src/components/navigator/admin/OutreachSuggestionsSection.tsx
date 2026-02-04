"use client";

import { useStore } from "@/lib/navigator/store";

export function OutreachSuggestionsSection() {
  const rules = useStore((s) => s.adminConfig.outreachSuggestionRules) ?? [];
  const updateAdminConfig = useStore((s) => s.updateAdminConfig);

  const toggleRule = (id: string) => {
    const updated = rules.map((r) =>
      r.id === id ? { ...r, enabled: !r.enabled } : r
    );
    updateAdminConfig({ outreachSuggestionRules: updated });
  };

  const moveRule = (index: number, direction: "up" | "down") => {
    const arr = [...rules];
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= arr.length) return;
    [arr[index], arr[target]] = [arr[target], arr[index]];
    updateAdminConfig({ outreachSuggestionRules: arr });
  };

  return (
    <div className="rounded-card border border-surface-3 bg-surface-1 p-5">
      <h3 className="text-sm font-semibold text-text-primary">Outreach Suggestion Rules</h3>
      <p className="mt-1 text-xs text-text-tertiary">
        Toggle and reorder rules that auto-suggest channel + template when drafting outreach.
        Higher rules take priority.
      </p>

      <div className="mt-4 space-y-1">
        {rules.map((rule, i) => (
          <div
            key={rule.id}
            className="flex items-center gap-3 rounded-input border border-surface-3 bg-surface-0 px-3 py-2"
          >
            <input
              type="checkbox"
              checked={rule.enabled}
              onChange={() => toggleRule(rule.id)}
              className="accent-accent-primary"
            />
            <span className="flex-1 text-xs text-text-secondary">{rule.name}</span>
            <span className="font-mono text-xs text-text-tertiary">#{i + 1}</span>
            <div className="flex gap-0.5">
              <button
                onClick={() => moveRule(i, "up")}
                disabled={i === 0}
                className="rounded px-1 py-0.5 text-xs text-text-tertiary hover:text-text-primary disabled:opacity-30"
              >
                &uarr;
              </button>
              <button
                onClick={() => moveRule(i, "down")}
                disabled={i === rules.length - 1}
                className="rounded px-1 py-0.5 text-xs text-text-tertiary hover:text-text-primary disabled:opacity-30"
              >
                &darr;
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
