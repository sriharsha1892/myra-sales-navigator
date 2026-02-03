"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/cn";

interface InlineEditFieldProps {
  value: string | number;
  onSave: (value: string) => void;
  type?: "text" | "number";
  className?: string;
  placeholder?: string;
}

export function InlineEditField({
  value,
  onSave,
  type = "text",
  className,
  placeholder,
}: InlineEditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const [saved, setSaved] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleBlur = useCallback(() => {
    setEditing(false);
    if (draft !== String(value)) {
      onSave(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }, [draft, value, onSave]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        inputRef.current?.blur();
      } else if (e.key === "Escape") {
        setDraft(String(value));
        setEditing(false);
      }
    },
    [value]
  );

  if (!editing) {
    return (
      <span
        onClick={() => {
          setDraft(String(value));
          setEditing(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={cn(
          "cursor-pointer hover:bg-gray-50 px-2 py-1 rounded transition-colors",
          saved && "bg-emerald-50",
          className
        )}
      >
        {value || <span className="text-gray-300">{placeholder ?? "—"}</span>}
      </span>
    );
  }

  return (
    <input
      ref={inputRef}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        "px-2 py-1 text-sm border border-blue-300 rounded bg-white outline-none ring-2 ring-blue-100",
        className
      )}
      autoFocus
    />
  );
}
