"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import {
  useAgendaItems,
  useUnresolvedAgenda,
  useCreateAgendaItem,
  useUpdateAgendaItem,
} from "@/hooks/dashboard/useGtmV2";
import type { AgendaSection, GtmAgendaItem } from "@/lib/gtm/v2-types";
import { AGENDA_SECTIONS } from "@/lib/gtm/v2-types";
import type { GtmEntry } from "@/lib/gtm/v2-types";
import { buildDeltaSummary } from "@/lib/gtm/v2-utils";

interface AgendaTabProps {
  entryDate: string;
  currentEntry: GtmEntry | null;
  previousEntry: GtmEntry | null;
}

export function AgendaTab({ entryDate, currentEntry, previousEntry }: AgendaTabProps) {
  const { data: items = [], isLoading: itemsLoading } = useAgendaItems(entryDate);
  const { data: unresolvedItems = [], isLoading: unresolvedLoading } = useUnresolvedAgenda();
  const createItem = useCreateAgendaItem();
  const updateItem = useUpdateAgendaItem();

  const deltaSummary =
    currentEntry && previousEntry
      ? buildDeltaSummary(currentEntry, previousEntry)
      : null;

  // Items carried forward: unresolved from the most recent previous entry only
  const prevDate = previousEntry?.entryDate;
  const carriedForward = prevDate
    ? unresolvedItems.filter((item) => item.entryDate === prevDate)
    : [];

  if (itemsLoading && unresolvedLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Auto-generated delta summary */}
      {deltaSummary && (
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
          <p className="text-xs font-medium text-blue-800">{deltaSummary}</p>
        </div>
      )}

      {/* Carried forward items from previous entry */}
      {carriedForward.length > 0 && (
        <div className="p-3 bg-amber-50 rounded-lg border border-amber-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-amber-800">
              Unresolved from {prevDate} ({carriedForward.length})
            </p>
            <button
              onClick={() => {
                for (const item of carriedForward) {
                  createItem.mutate({
                    entryDate,
                    section: item.section,
                    content: item.content,
                    sortOrder: items.filter((i) => i.section === item.section).length,
                  });
                }
              }}
              className="text-[10px] font-medium text-amber-700 hover:text-amber-900 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded transition-colors"
            >
              Copy all to this entry
            </button>
          </div>
          <div className="space-y-1">
            {carriedForward.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-xs text-amber-700"
              >
                <button
                  onClick={() =>
                    updateItem.mutate({ id: item.id, isResolved: true })
                  }
                  className="w-4 h-4 rounded border border-amber-300 hover:bg-amber-200 flex-shrink-0"
                  aria-label="Mark as resolved"
                />
                <span>{item.content}</span>
                <button
                  onClick={() =>
                    createItem.mutate({
                      entryDate,
                      section: item.section,
                      content: item.content,
                      sortOrder: items.filter((i) => i.section === item.section).length,
                    })
                  }
                  className="text-[10px] text-amber-500 hover:text-amber-700 underline ml-auto flex-shrink-0"
                >
                  copy
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section editors */}
      {AGENDA_SECTIONS.map(({ key, label }) => (
        <AgendaSectionEditor
          key={key}
          section={key}
          label={label}
          items={items.filter((i) => i.section === key)}
          entryDate={entryDate}
          onCreate={(content) =>
            createItem.mutate({
              entryDate,
              section: key,
              content,
              sortOrder: items.filter((i) => i.section === key).length,
            })
          }
          onToggleResolved={(id, resolved) =>
            updateItem.mutate({ id, isResolved: resolved })
          }
          onUpdateContent={(id, content) =>
            updateItem.mutate({ id, content })
          }
        />
      ))}
    </div>
  );
}

function AgendaSectionEditor({
  section,
  label,
  items,
  entryDate,
  onCreate,
  onToggleResolved,
  onUpdateContent,
}: {
  section: AgendaSection;
  label: string;
  items: GtmAgendaItem[];
  entryDate: string;
  onCreate: (content: string) => void;
  onToggleResolved: (id: string, resolved: boolean) => void;
  onUpdateContent: (id: string, content: string) => void;
}) {
  const [newContent, setNewContent] = useState("");

  const handleAdd = () => {
    if (!newContent.trim()) return;
    onCreate(newContent.trim());
    setNewContent("");
  };

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-700 uppercase tracking-wider mb-2">
        {label}
      </h4>
      <div className="space-y-1.5 mb-2">
        {items.map((item) => (
          <div key={item.id} className="flex items-start gap-2 group">
            <button
              onClick={() => onToggleResolved(item.id, !item.isResolved)}
              aria-label={item.isResolved ? "Mark as unresolved" : "Mark as resolved"}
              className={cn(
                "w-4 h-4 mt-0.5 rounded border flex-shrink-0 transition-colors",
                item.isResolved
                  ? "bg-emerald-500 border-emerald-500"
                  : "border-gray-300 hover:border-gray-400"
              )}
            >
              {item.isResolved && (
                <svg viewBox="0 0 12 12" className="w-full h-full text-white">
                  <path
                    d="M3 6l2 2 4-4"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    fill="none"
                  />
                </svg>
              )}
            </button>
            <AgendaItemContent
              item={item}
              onUpdate={(content) => onUpdateContent(item.id, content)}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          placeholder={`Add ${label.toLowerCase()} item... (Enter to add)`}
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
        />
        <button
          onClick={handleAdd}
          disabled={!newContent.trim()}
          className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  );
}

function AgendaItemContent({
  item,
  onUpdate,
}: {
  item: GtmAgendaItem;
  onUpdate: (content: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(item.content);

  if (editing) {
    return (
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() && draft !== item.content) onUpdate(draft.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft.trim() && draft !== item.content) onUpdate(draft.trim());
            setEditing(false);
          }
          if (e.key === "Escape") setEditing(false);
        }}
        autoFocus
        className="flex-1 text-xs px-1 py-0.5 border border-gray-300 rounded bg-white focus:outline-none"
      />
    );
  }

  return (
    <span
      onClick={() => {
        setDraft(item.content);
        setEditing(true);
      }}
      className={cn(
        "text-xs cursor-pointer flex-1",
        item.isResolved
          ? "text-gray-400 line-through"
          : "text-gray-700 hover:text-gray-900"
      )}
    >
      {item.content}
    </span>
  );
}
