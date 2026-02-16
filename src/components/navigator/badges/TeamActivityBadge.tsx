"use client";

import { useState } from "react";

interface TeamActivityBadgeProps {
  activity: {
    viewers: { user: string; at: string }[];
    exporters: { user: string; at: string; count: number }[];
    decisions: { user: string; decision: string; at: string }[];
  };
}

export function TeamActivityBadge({ activity }: TeamActivityBadgeProps) {
  const [now] = useState(() => Date.now());

  // Collect unique users with their most recent activity
  const userMap = new Map<string, { type: string; at: string }>();
  for (const v of activity.viewers) userMap.set(v.user, { type: "view", at: v.at });
  for (const e of activity.exporters) userMap.set(e.user, { type: "export", at: e.at });
  for (const d of activity.decisions) userMap.set(d.user, { type: d.decision, at: d.at });

  const users = [...userMap.entries()]
    .sort((a, b) => new Date(b[1].at).getTime() - new Date(a[1].at).getTime())
    .slice(0, 3);

  const overflow = userMap.size - 3;
  if (users.length === 0) return null;

  const getInitials = (name: string) => {
    const parts = name.split(" ");
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase();
  };

  const getBg = (type: string) => {
    if (type === "export") return "bg-accent-primary/20 text-accent-primary";
    if (type === "interested") return "bg-success/20 text-success";
    if (type === "pass") return "bg-danger/20 text-danger";
    return "bg-surface-2 text-text-tertiary";
  };

  const daysAgo = (dateStr: string) => {
    const d = Math.floor((now - new Date(dateStr).getTime()) / 86400000);
    return d === 0 ? "today" : d === 1 ? "1d ago" : `${d}d ago`;
  };

  // Build tooltip text
  const tooltipLines = [...userMap.entries()].map(([name, info]) => {
    const action =
      info.type === "view" ? "viewed" : info.type === "export" ? "exported" : info.type;
    return `${name} ${action} ${daysAgo(info.at)}`;
  });

  return (
    <div className="flex items-center" title={tooltipLines.join(" \u00B7 ")}>
      {users.map(([name, info], i) => (
        <div
          key={name}
          className={`flex h-4 w-4 items-center justify-center rounded-full border border-surface-1 text-[7px] font-bold ${getBg(info.type)}`}
          style={{ marginLeft: i > 0 ? "-4px" : 0, zIndex: 3 - i }}
        >
          {getInitials(name)}
        </div>
      ))}
      {overflow > 0 && (
        <span className="ml-0.5 text-[8px] text-text-tertiary">+{overflow}</span>
      )}
    </div>
  );
}
