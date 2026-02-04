"use client";

import type { GtmEntry } from "@/lib/gtm/v2-types";

interface AmDemoSectionProps {
  latest: GtmEntry;
}

export function AmDemoSection({ latest }: AmDemoSectionProps) {
  const demos = latest.amDemos ?? {};
  const entries = Object.entries(demos).filter(([, v]) => v > 0);

  if (entries.length === 0) return null;

  const maxCount = Math.max(...entries.map(([, v]) => v), 1);

  return (
    <div className="bg-white/70 rounded-[14px] border border-white/90 shadow-[0_4px_20px_rgba(0,0,0,0.04)] p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">
        AM Demo Performance
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {entries
          .sort(([, a], [, b]) => b - a)
          .map(([name, count]) => (
            <div key={name} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-700">{name}</span>
                <span className="text-lg font-semibold text-gray-900 font-mono tabular-nums">
                  {count}
                </span>
              </div>
              <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gray-900 rounded-full transition-all duration-[180ms]"
                  style={{ width: `${(count / maxCount) * 100}%` }}
                />
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
