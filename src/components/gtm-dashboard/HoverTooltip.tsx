"use client";

import { useState, useRef, useEffect } from "react";

interface HoverTooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
}

export function HoverTooltip({ content, children }: HoverTooltipProps) {
  const [show, setShow] = useState(false);
  const timeout = useRef<NodeJS.Timeout>(undefined);

  function handleEnter() {
    clearTimeout(timeout.current);
    timeout.current = setTimeout(() => setShow(true), 200);
  }

  function handleLeave() {
    clearTimeout(timeout.current);
    setShow(false);
  }

  useEffect(() => {
    return () => clearTimeout(timeout.current);
  }, []);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      {children}
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 text-xs bg-gray-900 text-white rounded-lg shadow-lg whitespace-pre-wrap max-w-xs">
          {content}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
