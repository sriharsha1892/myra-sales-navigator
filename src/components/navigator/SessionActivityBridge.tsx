"use client";

import { useSessionActivity } from "@/hooks/navigator/useSessionActivity";

export function SessionActivityBridge() {
  useSessionActivity();
  return null;
}
