"use client";

import { Overlay } from "@/components/primitives/Overlay";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  return (
    <Overlay open={open} onClose={onCancel} backdrop="dim" placement="center">
      <div className="w-full max-w-sm rounded-card border border-surface-3 bg-surface-1 p-5 shadow-2xl">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <p className="mt-2 text-sm text-text-secondary">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-2 hover:text-text-primary"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              destructive
                ? "bg-danger text-text-inverse hover:bg-danger/80"
                : "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </Overlay>
  );
}
