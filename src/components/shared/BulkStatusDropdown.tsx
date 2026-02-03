"use client";

import { useStore } from "@/lib/store";
import type { PipelineStage } from "@/lib/types";
import { DEFAULT_PIPELINE_STAGES } from "@/lib/types";

interface BulkStatusDropdownProps {
  onSelect: (stageId: string) => void;
  onCancel: () => void;
}

export function BulkStatusDropdown({ onSelect, onCancel }: BulkStatusDropdownProps) {
  const adminConfig = useStore((s) => s.adminConfig);

  const stages: PipelineStage[] =
    (adminConfig as unknown as Record<string, unknown>).pipelineStages as PipelineStage[] | undefined
    ?? DEFAULT_PIPELINE_STAGES;

  return (
    <div className="flex items-center gap-1.5">
      {stages.map((stage) => (
        <button
          key={stage.id}
          onClick={() => onSelect(stage.id)}
          className="flex items-center gap-1 rounded-input border border-surface-3 px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-hover"
        >
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: stage.color }} />
          {stage.label}
        </button>
      ))}
      <button
        onClick={onCancel}
        className="text-xs text-text-tertiary hover:text-text-primary"
      >
        Cancel
      </button>
    </div>
  );
}
