"use client";

import { useState, useMemo, useCallback } from "react";
import { cn } from "@/lib/cn";
import type { GtmV2Segment, OrgSnapshot } from "@/lib/gtm/v2-types";
import {
  ALL_V2_SEGMENTS,
  SEGMENT_LABELS,
  SEGMENT_COLORS,
} from "@/lib/gtm/v2-types";

interface OrgsTabProps {
  snapshot: OrgSnapshot;
  onSnapshotChange: (snapshot: OrgSnapshot) => void;
}

// ── Paste parser ─────────────────────────────────────────────────────

const SEGMENT_ALIASES: Record<string, GtmV2Segment> = {};
for (const seg of ALL_V2_SEGMENTS) {
  SEGMENT_ALIASES[seg] = seg;
  SEGMENT_ALIASES[SEGMENT_LABELS[seg].toLowerCase()] = seg;
}

function resolveSegment(raw: string): GtmV2Segment | null {
  const key = raw.trim().toLowerCase();
  return SEGMENT_ALIASES[key] ?? null;
}

type PasteResult =
  | { ok: true; data: Record<GtmV2Segment, string[]> }
  | { ok: false; reason: "empty" | "no_headers" };

function parsePastedTable(text: string): PasteResult {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { ok: false, reason: "empty" };

  const hasHeaders = lines.some((l) => l.startsWith("##"));
  if (!hasHeaders) return { ok: false, reason: "no_headers" };

  const result: Record<string, string[]> = {};
  for (const seg of ALL_V2_SEGMENTS) result[seg] = [];

  let currentSegment: GtmV2Segment | null = null;
  for (const line of lines) {
    if (line.startsWith("##")) {
      currentSegment = resolveSegment(line.replace(/^#+\s*/, ""));
      continue;
    }
    if (currentSegment) {
      const name = line.replace(/^[-*]\s*/, "").trim();
      if (name) result[currentSegment].push(name);
    }
  }
  return { ok: true, data: result as Record<GtmV2Segment, string[]> };
}

// ── Main component ───────────────────────────────────────────────────

export function OrgsTab({ snapshot, onSnapshotChange }: OrgsTabProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [collapsed, setCollapsed] = useState<Set<GtmV2Segment>>(() => {
    const set = new Set<GtmV2Segment>();
    for (const seg of ALL_V2_SEGMENTS) {
      if ((snapshot.names[seg]?.length ?? 0) === 0) set.add(seg);
    }
    return set;
  });

  const toggleCollapse = useCallback((seg: GtmV2Segment) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(seg)) next.delete(seg);
      else next.add(seg);
      return next;
    });
  }, []);

  const handleNamesChange = useCallback(
    (seg: GtmV2Segment, text: string) => {
      const names = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      const newNames = { ...snapshot.names, [seg]: names };
      const newCounts = { ...snapshot.counts, [seg]: names.length };
      onSnapshotChange({ ...snapshot, names: newNames, counts: newCounts });
    },
    [snapshot, onSnapshotChange]
  );

  const pasteResult = useMemo(() => parsePastedTable(pasteText), [pasteText]);
  const parsedPaste = pasteResult.ok ? pasteResult.data : null;

  const handleApplyPaste = useCallback(() => {
    if (!parsedPaste) return;
    const newNames = { ...snapshot.names };
    const newCounts = { ...snapshot.counts };
    for (const seg of ALL_V2_SEGMENTS) {
      if (parsedPaste[seg].length > 0) {
        newNames[seg] = parsedPaste[seg];
        newCounts[seg] = parsedPaste[seg].length;
      }
    }
    onSnapshotChange({ ...snapshot, names: newNames, counts: newCounts });
    setPasteText("");
    setShowPaste(false);
    // Expand segments that got data
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const seg of ALL_V2_SEGMENTS) {
        if (parsedPaste[seg].length > 0) next.delete(seg);
      }
      return next;
    });
  }, [parsedPaste, snapshot, onSnapshotChange]);

  const totalOrgs = ALL_V2_SEGMENTS.reduce(
    (sum, seg) => sum + (snapshot.names[seg]?.length ?? 0),
    0
  );

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-700 flex-1">
          {totalOrgs} organization{totalOrgs !== 1 ? "s" : ""} across{" "}
          {ALL_V2_SEGMENTS.filter((s) => (snapshot.names[s]?.length ?? 0) > 0).length} segments
        </span>
        <button
          onClick={() => setShowPaste((v) => !v)}
          className={cn(
            "px-3 py-1.5 text-xs font-medium rounded-lg border transition-all",
            showPaste
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300"
          )}
        >
          Paste Table
        </button>
      </div>

      {/* Paste panel */}
      {showPaste && (
        <div className="border border-blue-200 rounded-lg p-4 bg-blue-50/30 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">
              Paste with ## headers for segments (e.g. ## Paying)
            </label>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder={"## Paying\nAndeco\nCeleral Docks\n\n## Strong Prospect\nAcme Corp\nGlobal Foods"}
              rows={8}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y font-mono leading-relaxed"
              autoFocus
            />
          </div>
          {!pasteResult.ok && pasteText.trim() && (
            <p className="text-xs text-amber-600">
              {pasteResult.reason === "no_headers"
                ? "Paste must include segment headers (e.g. ## Paying, ## Prospect)"
                : "No content detected"}
            </p>
          )}
          {parsedPaste && (
            <div className="text-xs text-gray-500 space-y-1">
              <span className="font-medium">Preview:</span>
              <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md bg-white divide-y divide-gray-100">
                {ALL_V2_SEGMENTS.filter((seg) => parsedPaste[seg].length > 0).map((seg) => (
                  <div key={seg} className="px-2.5 py-1.5 flex items-center gap-2">
                    <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", SEGMENT_COLORS[seg])}>
                      {SEGMENT_LABELS[seg]}
                    </span>
                    <span className="text-gray-700 tabular-nums">{parsedPaste[seg].length} orgs</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={() => { setShowPaste(false); setPasteText(""); }}
              className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleApplyPaste}
              disabled={!parsedPaste}
              className="px-4 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Segment sections */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white divide-y divide-gray-100">
        {ALL_V2_SEGMENTS.map((seg) => {
          const names = snapshot.names[seg] ?? [];
          const isCollapsed = collapsed.has(seg);
          const count = names.length;

          return (
            <div key={seg}>
              {/* Segment header */}
              <div
                className="flex items-center gap-2 px-3 py-2 bg-gray-50/60 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                role="button"
                aria-label={`Toggle ${SEGMENT_LABELS[seg]} section`}
                aria-expanded={!isCollapsed}
                onClick={() => toggleCollapse(seg)}
              >
                <svg
                  className={cn(
                    "w-3 h-3 text-gray-400 transition-transform",
                    isCollapsed ? "-rotate-90" : "rotate-0"
                  )}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
                <span className={cn("text-[11px] font-semibold px-2 py-0.5 rounded-md", SEGMENT_COLORS[seg])}>
                  {SEGMENT_LABELS[seg]}
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {count}
                </span>
              </div>

              {/* Textarea */}
              {!isCollapsed && (
                <div className="px-3 py-2">
                  <textarea
                    value={names.join("\n")}
                    onChange={(e) => handleNamesChange(seg, e.target.value)}
                    placeholder="One org name per line..."
                    rows={Math.max(3, Math.min(count + 1, 20))}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-y font-mono leading-relaxed max-h-[400px] overflow-y-auto"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer stats */}
      <div className="text-[11px] text-gray-400 px-1">
        {totalOrgs} organizations total
      </div>
    </div>
  );
}
