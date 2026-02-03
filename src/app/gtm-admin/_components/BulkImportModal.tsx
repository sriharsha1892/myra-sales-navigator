"use client";

import { useState } from "react";
import type { Segment } from "@/lib/gtm-dashboard/types";
import { ALL_SEGMENTS } from "@/lib/gtm-dashboard/types";
import { useBulkImportOrganizations } from "@/hooks/useGtmDashboardData";

interface BulkImportModalProps {
  open: boolean;
  onClose: () => void;
}

export function BulkImportModal({ open, onClose }: BulkImportModalProps) {
  const [text, setText] = useState("");
  const [segment, setSegment] = useState<Segment>("Active Trial");
  const bulkImport = useBulkImportOrganizations();

  if (!open) return null;

  function handleImport() {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    const orgs = lines.map((name) => ({ name, segment }));
    bulkImport.mutate(orgs, {
      onSuccess: () => {
        setText("");
        onClose();
      },
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 max-w-lg w-full mx-4">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">
          Bulk Import Organizations
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          Paste one organization name per line
        </p>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Default Segment
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

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder="Acme Corp&#10;BlueStar Inc&#10;CrestLine Ltd"
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 font-mono"
        />

        <div className="flex items-center justify-between mt-4">
          <span className="text-xs text-gray-400">
            {text.split("\n").filter((l) => l.trim()).length} organizations
          </span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleImport}
              disabled={bulkImport.isPending}
              className="px-3 py-1.5 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
            >
              {bulkImport.isPending ? "Importing..." : "Import"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
