"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/navigator/store";
import { useAuth } from "@/providers/AuthProvider";

export function HydrationBridge() {
  const { userName } = useAuth();
  const hydrated = useRef(false);

  useEffect(() => {
    if (!userName || hydrated.current) return;
    hydrated.current = true;

    fetch("/api/exclusions")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.exclusions) {
          useStore.getState().setExclusions(data.exclusions);
        }
      })
      .catch(() => {});

    fetch("/api/presets")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.presets) {
          useStore.getState().setPresets(data.presets);
        }
      })
      .catch(() => {});

    fetch(`/api/settings/user?user=${encodeURIComponent(userName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.copyFormat) {
          useStore.getState().setUserCopyFormat(data.copyFormat);
        }
        if (data?.viewMode) {
          useStore.getState().setViewMode(data.viewMode);
        }
      })
      .catch(() => {});
  }, [userName]);

  return null;
}
