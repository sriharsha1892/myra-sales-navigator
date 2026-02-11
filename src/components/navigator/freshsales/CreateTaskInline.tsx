"use client";

import { useState } from "react";
import type { Contact } from "@/lib/navigator/types";
import { useStore } from "@/lib/navigator/store";

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

interface CreateTaskInlineProps {
  companyName: string;
  accountId: number;
  contacts: Contact[];
  defaultDueDays: number;
  onCreated: () => void;
  onCancel: () => void;
}

export function CreateTaskInline({
  companyName,
  accountId,
  contacts,
  defaultDueDays,
  onCreated,
  onCancel,
}: CreateTaskInlineProps) {
  const [title, setTitle] = useState(`Follow up: ${companyName}`);
  const [dueDate, setDueDate] = useState(
    addBusinessDays(new Date(), defaultDueDays).toISOString().split("T")[0]
  );
  const [contactId, setContactId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const addToast = useStore((s) => s.addToast);

  const handleCreate = async () => {
    if (!title.trim() || loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/freshsales/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          dueDate,
          contactId: contactId || undefined,
          accountDomain: "", // Will use accountName fallback
          accountName: companyName,
        }),
      });
      if (res.ok) {
        addToast({ message: "Task created in Freshsales", type: "success" });
        onCreated();
      } else {
        addToast({ message: "Failed to create task", type: "error" });
      }
    } catch {
      addToast({ message: "Failed to create task", type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2.5 rounded-input border border-surface-3 bg-surface-2/50 p-3">
      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        Create Task
      </h4>

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        placeholder="Task title"
      />

      {/* Due date + contact row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-tertiary">Due</span>
          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
          />
        </div>
        {contacts.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-text-tertiary">Link to</span>
            <select
              value={contactId}
              onChange={(e) => setContactId(e.target.value)}
              className="rounded-input border border-surface-3 bg-surface-2 px-2 py-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none"
            >
              <option value="">Account only</option>
              {contacts.slice(0, 10).map((c) => (
                <option key={c.id} value={c.id.replace("freshsales-", "")}>
                  {c.firstName} {c.lastName}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <button
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 text-[10px] text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
        >
          Cancel
        </button>
        <button
          onClick={handleCreate}
          disabled={!title.trim() || loading}
          className="rounded-lg bg-accent-primary px-3 py-1.5 text-[10px] font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Creating..." : "Create Task"}
        </button>
      </div>
    </div>
  );
}
