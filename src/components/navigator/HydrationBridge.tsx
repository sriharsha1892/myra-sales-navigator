"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/navigator/store";
import { useAuth } from "@/providers/AuthProvider";
import { useBrowserNotifications } from "@/hooks/navigator/useBrowserNotifications";
import type { SearchPreset } from "@/lib/navigator/types";

const PRESET_NOTIFIED_KEY = "nav_preset_notified_session";

export function HydrationBridge() {
  const { userName } = useAuth();
  const hydrated = useRef(false);
  const { notify } = useBrowserNotifications();

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

          // Fire browser notification for presets with new results (once per session)
          const alreadyNotified = sessionStorage.getItem(PRESET_NOTIFIED_KEY);
          if (!alreadyNotified) {
            const presetsWithNew = (data.presets as SearchPreset[]).filter(
              (p) => (p.newResultCount ?? 0) > 0
            );
            if (presetsWithNew.length > 0) {
              sessionStorage.setItem(PRESET_NOTIFIED_KEY, "1");
              for (const p of presetsWithNew) {
                notify(
                  `${p.newResultCount} new result${p.newResultCount === 1 ? "" : "s"} for "${p.name}"`,
                  "Click to view updated search results."
                );
              }
            }
          }
        }
      })
      .catch(() => {});

    fetch(`/api/settings/user?user=${encodeURIComponent(userName)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.copyFormat) {
          useStore.getState().setUserCopyFormat(data.copyFormat);
        }
        if (data?.viewMode && data.viewMode !== "contacts") {
          useStore.getState().setViewMode(data.viewMode);
        }
      })
      .catch(() => {});
  }, [userName, notify]);

  return null;
}
