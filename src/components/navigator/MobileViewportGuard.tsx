"use client";

import { useState, useEffect } from "react";

export function MobileViewportGuard() {
  const [isTooSmall, setIsTooSmall] = useState(false);

  useEffect(() => {
    const check = () => setIsTooSmall(window.innerWidth < 1200);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!isTooSmall) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-surface-0 px-8 text-center">
      <h2 className="font-display text-2xl font-semibold text-text-primary">
        Desktop required
      </h2>
      <p className="mt-3 max-w-sm text-sm text-text-secondary">
        Sales Navigator is built for 1440px+ screens. Please use a laptop or desktop browser for the best experience.
      </p>
      <p className="mt-6 font-mono text-xs text-text-tertiary">
        Current width: {typeof window !== "undefined" ? window.innerWidth : "—"}px · Required: 1200px+
      </p>
    </div>
  );
}
