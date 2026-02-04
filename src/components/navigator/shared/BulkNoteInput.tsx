"use client";

import { useState } from "react";

interface BulkNoteInputProps {
  onSubmit: (text: string) => void;
  onCancel: () => void;
}

export function BulkNoteInput({ onSubmit, onCancel }: BulkNoteInputProps) {
  const [text, setText] = useState("");

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Add note to all selected..."
        className="w-48 rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) onSubmit(text.trim()); }}
        autoFocus
      />
      <button
        onClick={() => text.trim() && onSubmit(text.trim())}
        disabled={!text.trim()}
        className="rounded-input bg-accent-primary px-2 py-1 text-xs font-medium text-text-inverse disabled:opacity-40"
      >
        Add
      </button>
      <button
        onClick={onCancel}
        className="text-xs text-text-tertiary hover:text-text-primary"
      >
        Cancel
      </button>
    </div>
  );
}
