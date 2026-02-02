"use client";

import { useStore } from "@/lib/store";
import type { ToastMessage } from "@/lib/types";

interface UndoBarProps {
  toast: ToastMessage;
}

export function UndoBar({ toast }: UndoBarProps) {
  const dismissToast = useStore((s) => s.dismissToast);
  const duration = toast.duration ?? 6000;

  const handleUndo = () => {
    toast.undoAction?.();
    dismissToast(toast.id);
  };

  const animationStyle =
    toast.phase === "entering" || toast.phase === "visible"
      ? { animation: "toastSlideUp 180ms ease-out" }
      : { animation: "toastExit 200ms ease-out forwards" };

  return (
    <div
      role="alert"
      className="relative min-w-[320px] overflow-hidden rounded-card border border-surface-3 bg-surface-1 px-4 py-3 shadow-lg"
      style={animationStyle}
    >
      <div className="flex items-center gap-3">
        <span className="flex-1 text-sm text-text-primary">{toast.message}</span>
        <button
          onClick={handleUndo}
          className="rounded-input bg-accent-primary px-3 py-1 text-xs font-semibold text-text-inverse transition-colors hover:bg-accent-primary-hover"
        >
          Undo
        </button>
        <button
          onClick={() => dismissToast(toast.id)}
          className="text-text-tertiary hover:text-text-secondary"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-surface-3">
        <div
          className="h-full bg-accent-primary"
          style={{
            animation: `undoCountdown ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
