"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";

export function CopyFormatSection() {
  const config = useStore((s) => s.adminConfig);
  const updateConfig = useStore((s) => s.updateAdminConfig);
  const [newName, setNewName] = useState("");
  const [newTemplate, setNewTemplate] = useState("");

  const addFormat = () => {
    if (!newName.trim() || !newTemplate.trim()) return;
    const id = `cf-${Date.now()}`;
    updateConfig({
      copyFormats: [...config.copyFormats, { id, name: newName.trim(), template: newTemplate.trim() }],
    });
    setNewName("");
    setNewTemplate("");
  };

  const removeFormat = (id: string) => {
    updateConfig({ copyFormats: config.copyFormats.filter((f) => f.id !== id) });
  };

  return (
    <AdminSection title="Copy Format Templates">
      <div className="space-y-2 mb-3">
        {config.copyFormats.map((f) => (
          <div key={f.id} className="flex items-start gap-3 rounded-input border border-surface-3 bg-surface-2 px-3 py-2">
            <div className="flex-1">
              <span className="text-xs font-medium text-text-primary">{f.name}</span>
              <p className="mt-0.5 font-mono text-[10px] text-text-tertiary">{f.template}</p>
            </div>
            <button onClick={() => removeFormat(f.id)} className="text-xs text-text-tertiary hover:text-danger">
              &times;
            </button>
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Format name..."
          className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <input
          type="text"
          value={newTemplate}
          onChange={(e) => setNewTemplate(e.target.value)}
          placeholder="Template: {name} <{email}> - {title} at {company}"
          className="w-full rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 font-mono text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <p className="text-[10px] text-text-tertiary">
          Available placeholders: {"{name}"}, {"{email}"}, {"{title}"}, {"{company}"}, {"{phone}"}
        </p>
        <button onClick={addFormat} className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse">
          Add Format
        </button>
      </div>
    </AdminSection>
  );
}
