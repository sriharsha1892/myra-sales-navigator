"use client";

import { useState } from "react";
import { useStore } from "@/lib/navigator/store";
import { AdminSection } from "./AdminSection";
import type { PipelineStage } from "@/lib/navigator/types";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/navigator/types";

export function PipelineStagesSection() {
  const adminConfig = useStore((s) => s.adminConfig);
  const updateAdminConfig = useStore((s) => s.updateAdminConfig);

  const stages: PipelineStage[] =
    (adminConfig as unknown as Record<string, unknown>).pipelineStages as PipelineStage[] | undefined
    ?? DEFAULT_PIPELINE_STAGES;

  const [newLabel, setNewLabel] = useState("");
  const [newColor, setNewColor] = useState("#2D2D2D");

  const updateStages = (updated: PipelineStage[]) => {
    (updateAdminConfig as unknown as (config: Record<string, unknown>) => void)({ pipelineStages: updated });
  };

  const addStage = () => {
    if (!newLabel.trim()) return;
    const id = newLabel.trim().toLowerCase().replace(/\s+/g, "_");
    if (stages.some((s) => s.id === id)) return;
    updateStages([...stages, { id, label: newLabel.trim(), color: newColor, order: stages.length }]);
    setNewLabel("");
    setNewColor("#2D2D2D");
  };

  const removeStage = (id: string) => {
    updateStages(stages.filter((s) => s.id !== id).map((s, i) => ({ ...s, order: i })));
  };

  const moveStage = (id: string, direction: -1 | 1) => {
    const idx = stages.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= stages.length) return;
    const copy = [...stages];
    [copy[idx], copy[newIdx]] = [copy[newIdx], copy[idx]];
    updateStages(copy.map((s, i) => ({ ...s, order: i })));
  };

  const updateStageColor = (id: string, color: string) => {
    updateStages(stages.map((s) => s.id === id ? { ...s, color } : s));
  };

  const updateStageLabel = (id: string, label: string) => {
    updateStages(stages.map((s) => s.id === id ? { ...s, label } : s));
  };

  return (
    <AdminSection title="Pipeline Stages" description="Configure the status stages for company tracking. Changes apply to all users.">
      <div className="space-y-2">
        {stages.map((stage, idx) => (
          <div key={stage.id} className="flex items-center gap-2 rounded-input border border-surface-3 bg-surface-0 px-3 py-2">
            <input
              type="color"
              value={stage.color}
              onChange={(e) => updateStageColor(stage.id, e.target.value)}
              className="h-5 w-5 cursor-pointer rounded border-0 bg-transparent p-0"
            />
            <input
              type="text"
              value={stage.label}
              onChange={(e) => updateStageLabel(stage.id, e.target.value)}
              className="flex-1 bg-transparent text-sm text-text-primary focus:outline-none"
            />
            <span className="font-mono text-[10px] text-text-tertiary">{stage.id}</span>
            <div className="flex items-center gap-0.5">
              <button
                onClick={() => moveStage(stage.id, -1)}
                disabled={idx === 0}
                className="rounded p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
              </button>
              <button
                onClick={() => moveStage(stage.id, 1)}
                disabled={idx === stages.length - 1}
                className="rounded p-0.5 text-text-tertiary hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
              </button>
              <button
                onClick={() => removeStage(stage.id)}
                className="ml-1 rounded p-0.5 text-text-tertiary hover:text-danger"
                aria-label="Remove stage"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6 6 18M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          type="color"
          value={newColor}
          onChange={(e) => setNewColor(e.target.value)}
          className="h-6 w-6 cursor-pointer rounded border-0 bg-transparent p-0"
        />
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder="New stage name..."
          className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
          onKeyDown={(e) => { if (e.key === "Enter") addStage(); }}
        />
        <button
          onClick={addStage}
          disabled={!newLabel.trim()}
          className="rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>
    </AdminSection>
  );
}
