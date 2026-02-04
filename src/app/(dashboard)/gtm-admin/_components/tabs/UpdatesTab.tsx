"use client";

import { useState } from "react";
import {
  useGtmUpdates,
  useGtmSnapshots,
  useCreateUpdate,
  useUpdateUpdate,
} from "@/hooks/dashboard/useGtmDashboardData";
import { sanitizeHtml } from "@/lib/gtm-dashboard/sanitize";

export function UpdatesTab() {
  const { data: updates = [] } = useGtmUpdates();
  const { data: snapshots = [] } = useGtmSnapshots();
  const createUpdate = useCreateUpdate();
  const editUpdate = useUpdateUpdate();

  const [content, setContent] = useState("");
  const [snapshotId, setSnapshotId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  function handleSave() {
    if (!content.trim()) return;
    createUpdate.mutate(
      { content, snapshotId: snapshotId || undefined },
      { onSuccess: () => setContent("") }
    );
  }

  function handleEdit(id: string) {
    editUpdate.mutate(
      { id, content: editContent },
      {
        onSuccess: () => {
          setEditingId(null);
          setEditContent("");
        },
      }
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          New Update
        </h4>

        <div className="mb-3">
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Tie to Snapshot (optional)
          </label>
          <select
            value={snapshotId}
            onChange={(e) => setSnapshotId(e.target.value)}
            className="w-full max-w-xs px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          >
            <option value="">No snapshot</option>
            {snapshots.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={8}
          placeholder="Write your update in HTML... Supports <h3>, <ul>, <li>, <strong>, <em>, <a>, <table>, etc."
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900/10 font-mono"
        />

        {content && (
          <div className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <p className="text-[11px] text-gray-400 mb-2 uppercase tracking-wider">
              Preview
            </p>
            <div
              className="prose prose-sm prose-gray max-w-none"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(content) }}
            />
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={!content.trim() || createUpdate.isPending}
          className="mt-3 px-4 py-2 text-sm font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-40"
        >
          {createUpdate.isPending ? "Saving..." : "Save Update"}
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-3">
          Past Updates
        </h4>

        {updates.length === 0 ? (
          <p className="text-sm text-gray-400">No updates yet</p>
        ) : (
          <div className="space-y-4 max-h-[500px] overflow-auto">
            {updates.map((u) => (
              <div
                key={u.id}
                className="border border-gray-100 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400">
                    {new Date(u.createdAt).toLocaleDateString("en-US", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  <button
                    onClick={() => {
                      setEditingId(u.id);
                      setEditContent(u.content);
                    }}
                    className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    Edit
                  </button>
                </div>

                {editingId === u.id ? (
                  <div>
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={6}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg font-mono focus:outline-none focus:ring-2 focus:ring-gray-900/10"
                    />
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => handleEdit(u.id)}
                        disabled={editUpdate.isPending}
                        className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="prose prose-sm prose-gray max-w-none"
                    dangerouslySetInnerHTML={{ __html: sanitizeHtml(u.content) }}
                  />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
