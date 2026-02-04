"use client";

import { useState, useMemo, useCallback } from "react";
import {
  useGtmOrganizations,
  useUpsertOrganization,
  useDeleteOrganization,
} from "@/hooks/dashboard/useGtmDashboardData";
import { ALL_SEGMENTS, type Segment } from "@/lib/gtm-dashboard/types";
import { SegmentBadge } from "@/components/gtm-dashboard/SegmentBadge";
import { InlineEditField } from "../InlineEditField";
import { OrgForm } from "../OrgForm";
import { BulkImportModal } from "../BulkImportModal";
import { ConfirmDialog } from "../ConfirmDialog";

export function PipelineTab() {
  const { data: organizations = [], isLoading } = useGtmOrganizations();
  const upsertOrg = useUpsertOrganization();
  const deleteOrg = useDeleteOrganization();

  const [mode, setMode] = useState<"quick" | "detailed">("detailed");
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Set<Segment>>(
    new Set(["Paying", "Strong Prospect", "Active Trial"])
  );
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
    destructive?: boolean;
  } | null>(null);

  const bySegment = useMemo(() => {
    const map: Record<string, typeof organizations> = {};
    ALL_SEGMENTS.forEach((s) => (map[s] = []));
    organizations.forEach((o) => {
      if (!map[o.segment]) map[o.segment] = [];
      map[o.segment].push(o);
    });
    return map;
  }, [organizations]);

  const toggleSegment = useCallback((seg: Segment) => {
    setExpandedSegments((prev) => {
      const next = new Set(prev);
      if (next.has(seg)) next.delete(seg);
      else next.add(seg);
      return next;
    });
  }, []);

  const handleFieldSave = useCallback(
    (orgId: string, field: string, value: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (!org) return;
      const updated: Record<string, unknown> = {
        id: org.id,
        name: org.name,
        segment: org.segment,
      };
      switch (field) {
        case "name":
          updated.name = value;
          break;
        case "accountManager":
          updated.accountManager = value;
          break;
        case "leadSource":
          updated.leadSource = value;
          break;
        case "costTotal":
          updated.costTotal = Number(value) || 0;
          break;
        case "conversations":
          updated.conversations = Number(value) || 0;
          break;
        case "usersCount":
          updated.usersCount = Number(value) || 0;
          break;
      }
      upsertOrg.mutate(updated as Parameters<typeof upsertOrg.mutate>[0]);
    },
    [organizations, upsertOrg]
  );

  const handleSegmentChange = useCallback(
    (orgId: string, newSegment: Segment) => {
      const org = organizations.find((o) => o.id === orgId);
      if (!org) return;
      setConfirmAction({
        title: "Reassign Segment",
        message: `Move "${org.name}" from ${org.segment} to ${newSegment}?`,
        onConfirm: () => {
          upsertOrg.mutate({
            id: org.id,
            name: org.name,
            segment: newSegment,
          });
          setConfirmAction(null);
        },
      });
    },
    [organizations, upsertOrg]
  );

  const handleDelete = useCallback(
    (orgId: string) => {
      const org = organizations.find((o) => o.id === orgId);
      if (!org) return;
      setConfirmAction({
        title: "Delete Organization",
        message: `Permanently delete "${org.name}"? This cannot be undone.`,
        destructive: true,
        onConfirm: () => {
          deleteOrg.mutate(orgId);
          setConfirmAction(null);
        },
      });
    },
    [organizations, deleteOrg]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          <button
            onClick={() => setMode("quick")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "quick"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500"
            }`}
          >
            Quick Mode
          </button>
          <button
            onClick={() => setMode("detailed")}
            className={`px-3 py-1 text-xs rounded-md transition-colors ${
              mode === "detailed"
                ? "bg-white text-gray-900 shadow-sm font-medium"
                : "text-gray-500"
            }`}
          >
            Detailed Mode
          </button>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowBulkImport(true)}
            className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Bulk Import
          </button>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-3 py-1.5 text-xs font-medium bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            Add Organization
          </button>
        </div>
      </div>

      {showAddForm && (
        <OrgForm
          onSubmit={(org) => {
            upsertOrg.mutate(org);
            setShowAddForm(false);
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {mode === "quick" ? (
        <div className="grid grid-cols-2 gap-3">
          {ALL_SEGMENTS.map((seg) => (
            <div
              key={seg}
              className="bg-white rounded-xl border border-gray-200 p-4"
            >
              <div className="flex items-center justify-between mb-2">
                <SegmentBadge segment={seg} />
                <span className="text-2xl font-semibold text-gray-900 tabular-nums">
                  {bySegment[seg]?.length ?? 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {ALL_SEGMENTS.map((seg) => {
            const orgs = bySegment[seg] ?? [];
            const isExpanded = expandedSegments.has(seg);

            return (
              <div
                key={seg}
                className="bg-white rounded-xl border border-gray-200 overflow-hidden"
              >
                <button
                  onClick={() => toggleSegment(seg)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">
                      {isExpanded ? "\u25BC" : "\u25B6"}
                    </span>
                    <SegmentBadge segment={seg} />
                    <span className="text-sm font-medium text-gray-700">
                      {orgs.length} organizations
                    </span>
                  </div>
                </button>

                {isExpanded && orgs.length > 0 && (
                  <div className="border-t border-gray-100">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50/50">
                          <th className="text-left px-4 py-2 text-xs font-medium text-gray-500">
                            Name
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                            AM
                          </th>
                          <th className="text-left px-3 py-2 text-xs font-medium text-gray-500">
                            Source
                          </th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                            Cost
                          </th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                            Conv.
                          </th>
                          <th className="text-right px-3 py-2 text-xs font-medium text-gray-500">
                            Users
                          </th>
                          <th className="text-center px-3 py-2 text-xs font-medium text-gray-500">
                            Segment
                          </th>
                          <th className="px-3 py-2 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgs.map((org) => (
                          <tr
                            key={org.id}
                            className="border-t border-gray-50 hover:bg-gray-50/50"
                          >
                            <td className="px-4 py-1.5">
                              <InlineEditField
                                value={org.name}
                                onSave={(v) =>
                                  handleFieldSave(org.id, "name", v)
                                }
                                className="text-sm text-gray-800"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <InlineEditField
                                value={org.accountManager ?? ""}
                                onSave={(v) =>
                                  handleFieldSave(
                                    org.id,
                                    "accountManager",
                                    v
                                  )
                                }
                                className="text-sm text-gray-600"
                                placeholder="—"
                              />
                            </td>
                            <td className="px-3 py-1.5">
                              <InlineEditField
                                value={org.leadSource ?? ""}
                                onSave={(v) =>
                                  handleFieldSave(org.id, "leadSource", v)
                                }
                                className="text-sm text-gray-600"
                                placeholder="—"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <InlineEditField
                                value={org.costTotal}
                                onSave={(v) =>
                                  handleFieldSave(org.id, "costTotal", v)
                                }
                                type="number"
                                className="text-sm text-gray-700 tabular-nums text-right w-20"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <InlineEditField
                                value={org.conversations}
                                onSave={(v) =>
                                  handleFieldSave(
                                    org.id,
                                    "conversations",
                                    v
                                  )
                                }
                                type="number"
                                className="text-sm text-gray-700 tabular-nums text-right w-16"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-right">
                              <InlineEditField
                                value={org.usersCount}
                                onSave={(v) =>
                                  handleFieldSave(org.id, "usersCount", v)
                                }
                                type="number"
                                className="text-sm text-gray-700 tabular-nums text-right w-16"
                              />
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <select
                                value={org.segment}
                                onChange={(e) =>
                                  handleSegmentChange(
                                    org.id,
                                    e.target.value as Segment
                                  )
                                }
                                className="text-xs bg-transparent border border-gray-200 rounded px-1 py-0.5 text-gray-600"
                              >
                                {ALL_SEGMENTS.map((s) => (
                                  <option key={s} value={s}>
                                    {s}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td className="px-3 py-1.5 text-center">
                              <button
                                onClick={() => handleDelete(org.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors text-xs"
                                title="Delete"
                              >
                                &times;
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <BulkImportModal
        open={showBulkImport}
        onClose={() => setShowBulkImport(false)}
      />

      <ConfirmDialog
        open={!!confirmAction}
        title={confirmAction?.title ?? ""}
        message={confirmAction?.message ?? ""}
        destructive={confirmAction?.destructive}
        onConfirm={confirmAction?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmAction(null)}
      />
    </div>
  );
}
