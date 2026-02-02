"use client";

import { cn } from "@/lib/cn";

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  variant?: "inline" | "banner";
}

export function ErrorState({ message, onRetry, variant = "inline" }: ErrorStateProps) {
  if (variant === "banner") {
    return (
      <div className="flex items-center gap-2 rounded-card border border-danger/20 bg-danger-light px-3 py-2 text-xs text-danger">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <span className="flex-1">{message}</span>
        {onRetry && (
          <button
            onClick={onRetry}
            className="font-medium underline hover:no-underline"
          >
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-danger-light">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-danger">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <p className="text-sm text-text-secondary">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-3 rounded-input bg-accent-primary px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-primary-hover"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
