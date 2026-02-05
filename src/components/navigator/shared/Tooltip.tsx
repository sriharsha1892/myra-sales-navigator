"use client";

import { useState, useRef, useCallback, type ReactNode } from "react";

interface TooltipProps {
  text: string;
  children: ReactNode;
  /** Placement relative to trigger element */
  placement?: "top" | "bottom";
  /** Delay before showing, in ms */
  delay?: number;
  className?: string;
}

/**
 * Styled tooltip that replaces native `title=` attributes.
 * Consistent 400ms delay, dark-theme styling, positioned above or below.
 */
export function Tooltip({
  text,
  children,
  placement = "top",
  delay = 400,
  className,
}: TooltipProps) {
  const [show, setShow] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleEnter = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setShow(true), delay);
  }, [delay]);

  const handleLeave = useCallback(() => {
    clearTimeout(timerRef.current);
    setShow(false);
  }, []);

  const positionClass =
    placement === "top"
      ? "bottom-full left-1/2 -translate-x-1/2 mb-1.5"
      : "top-full left-1/2 -translate-x-1/2 mt-1.5";

  const arrowClass =
    placement === "top"
      ? "absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-surface-3"
      : "absolute left-1/2 bottom-full -translate-x-1/2 border-4 border-transparent border-b-surface-3";

  return (
    <span
      className={`relative inline-flex ${className ?? ""}`}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onFocus={handleEnter}
      onBlur={handleLeave}
    >
      {children}
      {show && (
        <div
          role="tooltip"
          className={`absolute z-50 max-w-xs whitespace-normal rounded-input border border-surface-3 bg-surface-1 px-2.5 py-1.5 text-xs leading-relaxed text-text-secondary shadow-lg ${positionClass}`}
        >
          {text}
          <div className={arrowClass} />
        </div>
      )}
    </span>
  );
}
