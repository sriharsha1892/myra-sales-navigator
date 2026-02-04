"use client";

import { useEffect } from "react";
import { pick } from "@/lib/navigator/ui-copy";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error boundary caught:", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-0">
      <div className="flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-danger-light">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-danger"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <h1 className="font-display text-lg font-medium text-text-primary">
          Something went wrong
        </h1>
        <p className="mt-2 text-sm text-text-secondary">
          {pick("network_error")}
        </p>
        <button
          onClick={reset}
          className="mt-5 rounded-input bg-accent-primary px-5 py-2 text-sm font-medium text-text-inverse transition-colors hover:bg-accent-primary-hover"
        >
          Reload
        </button>
      </div>
    </div>
  );
}
