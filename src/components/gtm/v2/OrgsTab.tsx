"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
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

// ── Chip key helper ──────────────────────────────────────────────────

function chipKey(seg: GtmV2Segment, name: string) {
  return `${seg}::${name}`;
}

function parseChipKey(key: string): { seg: GtmV2Segment; name: string } {
  const idx = key.indexOf("::");
  return { seg: key.slice(0, idx) as GtmV2Segment, name: key.slice(idx + 2) };
}

// ── Segment Move Dropdown ────────────────────────────────────────────

function SegmentMoveDropdown({
  currentSegment,
  onMove,
  onClose,
}: {
  currentSegment: GtmV2Segment;
  onMove: (target: GtmV2Segment) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [focusIdx, setFocusIdx] = useState(0);

  const targets = ALL_V2_SEGMENTS.filter((s) => s !== currentSegment);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onClose]);

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); e.stopPropagation(); }
      else if (e.key === "ArrowDown") { setFocusIdx((i) => Math.min(i + 1, targets.length - 1)); e.preventDefault(); }
      else if (e.key === "ArrowUp") { setFocusIdx((i) => Math.max(i - 1, 0)); e.preventDefault(); }
      else if (e.key === "Enter") { onMove(targets[focusIdx]); e.preventDefault(); }
    };
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose, onMove, targets, focusIdx]);

  return (
    <div
      ref={ref}
      className="absolute z-50 top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1 text-xs"
    >
      <div className="px-2 py-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
        Move to
      </div>
      {targets.map((seg, i) => (
        <button
          key={seg}
          onClick={(e) => { e.stopPropagation(); onMove(seg); }}
          className={cn(
            "w-full text-left px-2 py-1.5 flex items-center gap-2 transition-colors",
            i === focusIdx ? "bg-gray-50" : "hover:bg-gray-50"
          )}
        >
          <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", SEGMENT_COLORS[seg])}>
            {SEGMENT_LABELS[seg]}
          </span>
        </button>
      ))}
    </div>
  );
}

// ── OrgChip ──────────────────────────────────────────────────────────

function OrgChip({
  name,
  segment,
  isSelected,
  showCheckbox,
  onToggleSelect,
  onMove,
}: {
  name: string;
  segment: GtmV2Segment;
  isSelected: boolean;
  showCheckbox: boolean;
  onToggleSelect: () => void;
  onMove: (target: GtmV2Segment) => void;
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="relative inline-flex items-center group">
      {/* Checkbox — visible on hover or when any are selected */}
      <div
        className={cn(
          "w-4 h-4 mr-0.5 flex items-center justify-center transition-opacity",
          showCheckbox ? "opacity-100" : "opacity-0 group-hover:opacity-100"
        )}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelect}
          className="w-3 h-3 rounded border-gray-300 text-blue-600 focus:ring-0 cursor-pointer"
        />
      </div>

      {/* Chip body */}
      <span
        className={cn(
          "inline-flex items-center gap-0.5 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium border transition-colors cursor-default",
          isSelected
            ? "border-blue-300 bg-blue-50 text-blue-800"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-gray-300 hover:bg-gray-100"
        )}
      >
        <span className="max-w-[160px] truncate">{name}</span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}
          className="ml-0.5 px-0.5 text-gray-400 hover:text-gray-600 transition-colors"
          title="Move to segment"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </span>

      {/* Dropdown */}
      {dropdownOpen && (
        <SegmentMoveDropdown
          currentSegment={segment}
          onMove={(target) => { onMove(target); setDropdownOpen(false); }}
          onClose={() => setDropdownOpen(false)}
        />
      )}
    </div>
  );
}

// ── Batch Action Bar ─────────────────────────────────────────────────

function BatchActionBar({
  count,
  onMove,
  onRemove,
  onClear,
}: {
  count: number;
  onMove: (target: GtmV2Segment) => void;
  onRemove: () => void;
  onClear: () => void;
}) {
  const [moveOpen, setMoveOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setMoveOpen(false);
    };
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div className="sticky top-0 z-30 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg text-xs">
      <span className="font-medium text-blue-700">{count} selected</span>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setMoveOpen((v) => !v)}
          className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 rounded-md hover:bg-blue-50 transition-colors"
        >
          Move to...
        </button>
        {moveOpen && (
          <div className="absolute z-50 top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <div className="px-2 py-1 text-[10px] text-gray-400 font-medium uppercase tracking-wider">
              Move to
            </div>
            {ALL_V2_SEGMENTS.map((seg) => (
              <button
                key={seg}
                onClick={() => { onMove(seg); setMoveOpen(false); }}
                className="w-full text-left px-2 py-1.5 flex items-center gap-2 hover:bg-gray-50 transition-colors"
              >
                <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded", SEGMENT_COLORS[seg])}>
                  {SEGMENT_LABELS[seg]}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={onRemove}
        className="px-2.5 py-1 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-md hover:bg-red-50 transition-colors"
      >
        Remove
      </button>

      <button
        type="button"
        onClick={onClear}
        className="px-2.5 py-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
      >
        Clear
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────

export function OrgsTab({ snapshot, onSnapshotChange }: OrgsTabProps) {
  const [showPaste, setShowPaste] = useState(false);
  const [pasteText, setPasteText] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [addInputs, setAddInputs] = useState<Partial<Record<GtmV2Segment, string>>>({});
  const [collapsed, setCollapsed] = useState<Set<GtmV2Segment>>(() => {
    const set = new Set<GtmV2Segment>();
    for (const seg of ALL_V2_SEGMENTS) {
      if ((snapshot.names[seg]?.length ?? 0) === 0) set.add(seg);
    }
    return set;
  });

  const hasSelection = selected.size > 0;

  const toggleCollapse = useCallback((seg: GtmV2Segment) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(seg)) next.delete(seg);
      else next.add(seg);
      return next;
    });
  }, []);

  // ── Snapshot mutation helper ──

  const updateNames = useCallback(
    (newNames: Record<GtmV2Segment, string[]>) => {
      const newCounts = {} as Record<GtmV2Segment, number>;
      for (const seg of ALL_V2_SEGMENTS) {
        newCounts[seg] = newNames[seg]?.length ?? 0;
      }
      onSnapshotChange({ ...snapshot, names: newNames, counts: newCounts });
    },
    [snapshot, onSnapshotChange]
  );

  // ── Move single org ──

  const moveOrg = useCallback(
    (fromSeg: GtmV2Segment, orgName: string, toSeg: GtmV2Segment) => {
      const newNames = { ...snapshot.names };
      newNames[fromSeg] = (newNames[fromSeg] ?? []).filter((n) => n !== orgName);
      // Dedupe: don't add if already in target
      if (!(newNames[toSeg] ?? []).includes(orgName)) {
        newNames[toSeg] = [...(newNames[toSeg] ?? []), orgName];
      }
      updateNames(newNames as Record<GtmV2Segment, string[]>);
      // Remove from selection
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(chipKey(fromSeg, orgName));
        return next;
      });
    },
    [snapshot.names, updateNames]
  );

  // ── Batch move ──

  const batchMove = useCallback(
    (toSeg: GtmV2Segment) => {
      const newNames = { ...snapshot.names } as Record<GtmV2Segment, string[]>;
      for (const seg of ALL_V2_SEGMENTS) {
        newNames[seg] = [...(newNames[seg] ?? [])];
      }
      for (const key of selected) {
        const { seg, name } = parseChipKey(key);
        newNames[seg] = newNames[seg].filter((n) => n !== name);
        if (!newNames[toSeg].includes(name)) {
          newNames[toSeg].push(name);
        }
      }
      updateNames(newNames);
      setSelected(new Set());
      // Expand target segment
      setCollapsed((prev) => {
        const next = new Set(prev);
        next.delete(toSeg);
        return next;
      });
    },
    [snapshot.names, selected, updateNames]
  );

  // ── Batch remove ──

  const batchRemove = useCallback(() => {
    const newNames = { ...snapshot.names } as Record<GtmV2Segment, string[]>;
    for (const seg of ALL_V2_SEGMENTS) {
      newNames[seg] = [...(newNames[seg] ?? [])];
    }
    for (const key of selected) {
      const { seg, name } = parseChipKey(key);
      newNames[seg] = newNames[seg].filter((n) => n !== name);
    }
    updateNames(newNames);
    setSelected(new Set());
  }, [snapshot.names, selected, updateNames]);

  // ── Add orgs to segment ──

  const addOrgs = useCallback(
    (seg: GtmV2Segment, raw: string) => {
      const newOrgs = raw
        .split(/[,\n]/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (newOrgs.length === 0) return;

      // Dedupe across all segments
      const allExisting = new Set<string>();
      for (const s of ALL_V2_SEGMENTS) {
        for (const name of snapshot.names[s] ?? []) {
          allExisting.add(name.toLowerCase());
        }
      }

      const toAdd = newOrgs.filter((n) => !allExisting.has(n.toLowerCase()));
      if (toAdd.length === 0) return;

      const newNames = { ...snapshot.names };
      newNames[seg] = [...(newNames[seg] ?? []), ...toAdd];
      updateNames(newNames as Record<GtmV2Segment, string[]>);
      setAddInputs((prev) => ({ ...prev, [seg]: "" }));
    },
    [snapshot.names, updateNames]
  );

  // ── Toggle selection ──

  const toggleSelect = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Paste table ──

  const pasteResult = useMemo(() => parsePastedTable(pasteText), [pasteText]);
  const parsedPaste = pasteResult.ok ? pasteResult.data : null;

  const handleApplyPaste = useCallback(() => {
    if (!parsedPaste) return;
    const newNames = { ...snapshot.names };
    for (const seg of ALL_V2_SEGMENTS) {
      if (parsedPaste[seg].length > 0) {
        newNames[seg] = parsedPaste[seg];
      }
    }
    updateNames(newNames as Record<GtmV2Segment, string[]>);
    setPasteText("");
    setShowPaste(false);
    setCollapsed((prev) => {
      const next = new Set(prev);
      for (const seg of ALL_V2_SEGMENTS) {
        if (parsedPaste[seg].length > 0) next.delete(seg);
      }
      return next;
    });
  }, [parsedPaste, snapshot.names, updateNames]);

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

      {/* Batch action bar */}
      {hasSelection && (
        <BatchActionBar
          count={selected.size}
          onMove={batchMove}
          onRemove={batchRemove}
          onClear={() => setSelected(new Set())}
        />
      )}

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

              {/* Chips area */}
              {!isCollapsed && (
                <div className="px-3 py-2 space-y-2">
                  {/* Org chips */}
                  {names.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {names.map((name) => {
                        const key = chipKey(seg, name);
                        return (
                          <OrgChip
                            key={key}
                            name={name}
                            segment={seg}
                            isSelected={selected.has(key)}
                            showCheckbox={hasSelection}
                            onToggleSelect={() => toggleSelect(key)}
                            onMove={(target) => moveOrg(seg, name, target)}
                          />
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No organizations</p>
                  )}

                  {/* Add input */}
                  <input
                    value={addInputs[seg] ?? ""}
                    onChange={(e) => setAddInputs((prev) => ({ ...prev, [seg]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addOrgs(seg, addInputs[seg] ?? "");
                      }
                    }}
                    placeholder="Add org... (comma-separated, Enter to add)"
                    className="w-full px-2.5 py-1.5 text-xs border border-dashed border-gray-200 rounded-md bg-transparent text-gray-600 placeholder:text-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
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
