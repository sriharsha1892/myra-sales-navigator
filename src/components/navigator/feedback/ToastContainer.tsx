"use client";

import { useStore } from "@/lib/navigator/store";
import { ToastItem } from "./ToastItem";
import { UndoBar } from "./UndoBar";

export function ToastContainer() {
  const toasts = useStore((s) => s.toasts);

  const standardToasts = toasts.filter((t) => t.variant !== "undo").slice(-5);
  const undoToasts = toasts.filter((t) => t.variant === "undo");

  if (standardToasts.length === 0 && undoToasts.length === 0) return null;

  return (
    <>
      {/* Standard + progress toasts: bottom-right stack */}
      {standardToasts.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-4 right-4 z-50 flex flex-col gap-2"
        >
          {standardToasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </div>
      )}

      {/* Undo toasts: bottom-center */}
      {undoToasts.length > 0 && (
        <div
          aria-live="assertive"
          className="fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 flex-col gap-2"
        >
          {undoToasts.map((toast) => (
            <UndoBar key={toast.id} toast={toast} />
          ))}
        </div>
      )}
    </>
  );
}
