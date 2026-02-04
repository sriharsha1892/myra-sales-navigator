"use client";

import { useState, useCallback, useRef, useEffect, createElement } from "react";
import type { InlineFeedback } from "@/lib/navigator/types";

let feedbackCounter = 0;

export function useInlineFeedback() {
  const [feedback, setFeedback] = useState<InlineFeedback | null>(null);
  const outerTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const innerTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (outerTimerRef.current) clearTimeout(outerTimerRef.current);
      if (innerTimerRef.current) clearTimeout(innerTimerRef.current);
    };
  }, []);

  const trigger = useCallback((message: string, type: "success" | "error" = "success") => {
    if (outerTimerRef.current) clearTimeout(outerTimerRef.current);
    if (innerTimerRef.current) clearTimeout(innerTimerRef.current);

    const id = `fb-${++feedbackCounter}`;
    setFeedback({ id, message, type, phase: "entering" });

    // After show duration, start exit
    outerTimerRef.current = setTimeout(() => {
      setFeedback((prev) => (prev ? { ...prev, phase: "exiting" } : null));
      innerTimerRef.current = setTimeout(() => {
        setFeedback(null);
      }, 180);
    }, 1500);
  }, []);

  const FeedbackLabel = feedback
    ? createElement(
        "span",
        {
          key: feedback.id,
          className: `inline-flex items-center gap-1 text-xs ${
            feedback.type === "success" ? "text-success" : "text-danger"
          }`,
          style: {
            animation:
              feedback.phase === "exiting"
                ? "inlineFadeOut 180ms ease-out forwards"
                : "inlineFadeIn 120ms ease-out",
          },
        },
        createElement(
          "svg",
          {
            width: 10,
            height: 10,
            viewBox: "0 0 24 24",
            fill: "none",
            stroke: "currentColor",
            strokeWidth: 3,
          },
          feedback.type === "success"
            ? createElement("polyline", { points: "20 6 9 17 4 12" })
            : createElement("path", { d: "M18 6 6 18M6 6l12 12" })
        ),
        feedback.message
      )
    : null;

  return { trigger, FeedbackLabel };
}
