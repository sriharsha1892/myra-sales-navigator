"use client";

export function ProgressIndicator() {
  return (
    <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
      <div
        className="h-full w-1/3 rounded-full bg-accent-primary"
        style={{ animation: "progressSlide 1.2s ease-in-out infinite" }}
      />
    </div>
  );
}
