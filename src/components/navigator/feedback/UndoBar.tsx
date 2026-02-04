"use client";

import { useStore } from "@/lib/navigator/store";
import type { ToastMessage } from "@/lib/navigator/types";

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
      className="relative min-w-[380px] overflow-hidden rounded-card border border-accent-primary/30 bg-surface-1 px-5 py-3.5 shadow-2xl"
      style={animationStyle}
    >
      <div className="flex items-center gap-3">
        {/* Undo icon */}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 text-accent-primary">
          <path d="M3 7v6h6" />
          <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
        </svg>
        <span className="flex-1 text-sm font-medium text-text-primary">{toast.message}</span>
        <button
          onClick={handleUndo}
          className="rounded-input bg-accent-primary px-3.5 py-1.5 text-xs font-semibold text-text-inverse transition-colors hover:bg-accent-primary-hover"
        >
          Undo
        </button>
        <button
          onClick={() => dismissToast(toast.id)}
          className="rounded-lg p-1 text-text-tertiary transition-colors hover:bg-surface-2 hover:text-text-secondary"
          aria-label="Dismiss"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {/* Countdown bar */}
      <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-3">
        <div
          className="h-full bg-accent-primary/60"
          style={{
            animation: `undoCountdown ${duration}ms linear forwards`,
          }}
        />
      </div>
    </div>
  );
}
