"use client";

import { useState } from "react";
import type { Segment, GtmOrganization } from "@/lib/gtm-dashboard/types";
import { ALL_SEGMENTS } from "@/lib/gtm-dashboard/types";

interface OrgFormProps {
  initial?: Partial<GtmOrganization>;
  onSubmit: (
    org: Partial<GtmOrganization> & { name: string; segment: Segment }
  ) => void;
  onCancel: () => void;
}

export function OrgForm({ initial, onSubmit, onCancel }: OrgFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [segment, setSegment] = useState<Segment>(
    initial?.segment ?? "Active Trial"
  );
  const [accountManager, setAccountManager] = useState(
    initial?.accountManager ?? ""
  );
  const [leadSource, setLeadSource] = useState(initial?.leadSource ?? "");
  const [costTotal, setCostTotal] = useState(String(initial?.costTotal ?? "0"));
  const [conversations, setConversations] = useState(
    String(initial?.conversations ?? "0")
  );
  const [usersCount, setUsersCount] = useState(
    String(initial?.usersCount ?? "0")
  );

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({
      ...(initial?.id ? { id: initial.id } : {}),
      name: name.trim(),
      segment,
      accountManager: accountManager || null,
      leadSource: leadSource || null,
      costTotal: Number(costTotal) || 0,
      conversations: Number(conversations) || 0,
      usersCount: Number(usersCount) || 0,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Name *
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Segment
          </label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as Segment)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            {ALL_SEGMENTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Account Manager
          </label>
          <input
            value={accountManager}
            onChange={(e) => setAccountManager(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Lead Source
          </label>
          <input
            value={leadSource}
            onChange={(e) => setLeadSource(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Cost
          </label>
          <input
            type="number"
            step="0.01"
            value={costTotal}
            onChange={(e) => setCostTotal(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Conversations
          </label>
          <input
            type="number"
            value={conversations}
            onChange={(e) => setConversations(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Users
          </label>
          <input
            type="number"
            value={usersCount}
            onChange={(e) => setUsersCount(e.target.value)}
            className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
        >
          {initial?.id ? "Update" : "Add Organization"}
        </button>
      </div>
    </form>
  );
}
