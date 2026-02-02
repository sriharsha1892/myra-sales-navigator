"use client";

import { useState, useRef, useEffect } from "react";

interface HelpTipProps {
  text: string;
  className?: string;
}

export function HelpTip({ text, className }: HelpTipProps) {
  const [show, setShow] = useState(false);
  const tipRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!show) return;
    const handler = (e: MouseEvent) => {
      if (
        tipRef.current &&
        !tipRef.current.contains(e.target as Node) &&
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setShow(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [show]);

  return (
    <span
      ref={tipRef}
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      <span
        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-surface-3 text-[9px] leading-none text-text-tertiary transition-colors hover:border-text-tertiary hover:text-text-secondary"
        aria-label="Help"
      >
        ?
      </span>
      {show && (
        <div
          ref={popoverRef}
          className="absolute bottom-full left-1/2 z-50 mb-1.5 w-56 -translate-x-1/2 rounded-input border border-surface-3 bg-surface-1 px-3 py-2 text-xs leading-relaxed text-text-secondary shadow-lg"
        >
          {text}
          <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface-3" />
        </div>
      )}
    </span>
  );
}
