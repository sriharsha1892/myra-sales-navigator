"use client";

import { useState, useEffect } from "react";

interface TeamActivity {
  type: string;
  text: string;
  user: string;
  at: string;
}

function timeAgoShort(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export function TeamPulseWidget() {
  const [expanded, setExpanded] = useState(false);
  const [activities, setActivities] = useState<TeamActivity[]>([]);

  useEffect(() => {
    function fetchActivity() {
      fetch("/api/session/team-activity")
        .then((r) => r.json())
        .then((data) => setActivities(data.activities ?? []))
        .catch(() => {});
    }
    fetchActivity();
    const interval = setInterval(fetchActivity, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (activities.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-40">
      {expanded ? (
        <div
          className="w-72 rounded-card border border-surface-3 bg-surface-1 shadow-2xl"
          style={{ animation: "fadeInUp 180ms ease-out" }}
        >
          <div className="flex items-center justify-between border-b border-surface-3 px-3 py-2">
            <span className="text-xs font-semibold text-text-secondary">Team Activity</span>
            <button
              onClick={() => setExpanded(false)}
              className="text-text-tertiary hover:text-text-primary"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto px-3 py-2">
            {activities.map((a, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5">
                <span className="flex-shrink-0 text-[10px] font-medium text-text-tertiary">{timeAgoShort(a.at)}</span>
                <div className="min-w-0">
                  <span className="text-[11px] font-medium text-accent-secondary">{a.user}</span>
                  <span className="ml-1 text-[11px] text-text-secondary">{a.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="rounded-pill border border-surface-3 bg-surface-1 px-3 py-1.5 text-xs font-medium text-text-secondary shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
        >
          Team
        </button>
      )}
    </div>
  );
}
