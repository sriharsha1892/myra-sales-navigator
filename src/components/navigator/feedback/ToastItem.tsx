"use client";

import { cn } from "@/lib/cn";
import type { ToastMessage } from "@/lib/navigator/types";
import { useStore } from "@/lib/navigator/store";
import { CheckCircleIcon, XCircleIcon, AlertTriangleIcon, InfoCircleIcon } from "./icons";
import { ProgressIndicator } from "./ProgressIndicator";

const typeConfig = {
  success: {
    borderColor: "border-success/30",
    bgTint: "bg-success-light",
    iconColor: "text-success",
    Icon: CheckCircleIcon,
  },
  error: {
    borderColor: "border-danger/30",
    bgTint: "bg-danger-light",
    iconColor: "text-danger",
    Icon: XCircleIcon,
  },
  warning: {
    borderColor: "border-warning/30",
    bgTint: "bg-warning-light",
    iconColor: "text-warning",
    Icon: AlertTriangleIcon,
  },
  info: {
    borderColor: "border-info/30",
    bgTint: "bg-info-light",
    iconColor: "text-info",
    Icon: InfoCircleIcon,
  },
};

interface ToastItemProps {
  toast: ToastMessage;
}

export function ToastItem({ toast }: ToastItemProps) {
  const dismissToast = useStore((s) => s.dismissToast);
  const removeToast = useStore((s) => s.removeToast);
  const config = typeConfig[toast.type];
  const { Icon } = config;

  const animationStyle =
    toast.phase === "entering" || toast.phase === "visible"
      ? { animation: "toastEnter 180ms ease-out" }
      : { animation: "toastExit 200ms ease-out forwards" };

  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 rounded-card border-[1.5px] px-3.5 py-2.5 text-sm shadow-md",
        config.borderColor,
        config.bgTint
      )}
      style={animationStyle}
    >
      <div className="flex items-center gap-2.5">
        <Icon className={cn("flex-shrink-0", config.iconColor)} />
        <span className="flex-1 text-text-primary">{toast.message}</span>
        {toast.count && toast.count > 1 && (
          <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-surface-3 px-1 text-[10px] font-semibold text-text-secondary">
            {toast.count}
          </span>
        )}
        {toast.action && (
          <button
            onClick={() => {
              toast.action?.onClick();
              removeToast(toast.id);
            }}
            className="font-semibold text-accent-primary hover:text-accent-primary-hover"
          >
            {toast.action.label}
          </button>
        )}
        <button
          onClick={() => dismissToast(toast.id)}
          className="flex-shrink-0 text-text-tertiary hover:text-text-secondary"
          aria-label="Dismiss"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      {toast.variant === "progress" && toast.progress?.status === "loading" && (
        <ProgressIndicator />
      )}
    </div>
  );
}
