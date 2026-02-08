"use client";

import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";

const ACTION_LABELS: Record<string, string> = {
  generated_link: "Generated login link",
  logged_in: "Logged in",
  revoked: "Revoked access",
  requested_access: "Requested access",
  added_member: "Added member",
  removed_member: "Removed member",
};

function formatIST(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export function AuthActivityLog() {
  const authLog = useStore((s) => s.adminConfig.authLog) ?? [];

  // Show newest first
  const sortedLog = [...authLog].reverse();

  return (
    <AdminSection title="Auth Activity Log">
      {sortedLog.length === 0 ? (
        <p className="text-xs text-text-tertiary">No auth activity recorded yet.</p>
      ) : (
        <div className="max-h-80 overflow-y-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-surface-3 text-left text-[10px] uppercase text-text-tertiary">
                <th className="pb-2 pr-3">Time (IST)</th>
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">Actor</th>
                <th className="pb-2">Target</th>
              </tr>
            </thead>
            <tbody>
              {sortedLog.map((entry, i) => (
                <tr key={i} className="border-b border-surface-3/50">
                  <td className="py-1.5 pr-3 font-mono text-text-tertiary">
                    {formatIST(entry.timestamp)}
                  </td>
                  <td className="py-1.5 pr-3 text-text-secondary">
                    {ACTION_LABELS[entry.action] ?? entry.action}
                  </td>
                  <td className="py-1.5 pr-3 text-text-primary">{entry.actor}</td>
                  <td className="py-1.5 text-text-primary">{entry.target}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </AdminSection>
  );
}
