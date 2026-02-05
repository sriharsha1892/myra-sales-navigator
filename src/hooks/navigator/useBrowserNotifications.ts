"use client";

import { useCallback, useSyncExternalStore } from "react";

const LS_KEY = "nav_notifications_enabled";

function getEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(LS_KEY) === "1";
}

// Simple external store so all consumers stay in sync when the flag changes.
let listeners: Array<() => void> = [];
function subscribe(cb: () => void) {
  listeners.push(cb);
  return () => {
    listeners = listeners.filter((l) => l !== cb);
  };
}
function emitChange() {
  for (const l of listeners) l();
}

function getPermission(): NotificationPermission {
  if (typeof window === "undefined" || !("Notification" in window)) return "denied";
  return Notification.permission;
}

export function useBrowserNotifications() {
  const enabled = useSyncExternalStore(subscribe, getEnabled, () => false);
  const permission = getPermission();

  const toggleEnabled = useCallback(async (on: boolean) => {
    if (on) {
      // Request permission on first enable
      if ("Notification" in window && Notification.permission === "default") {
        await Notification.requestPermission();
      }
      localStorage.setItem(LS_KEY, "1");
    } else {
      localStorage.removeItem(LS_KEY);
    }
    emitChange();
  }, []);

  const notify = useCallback((title: string, body?: string) => {
    if (
      typeof window === "undefined" ||
      !document.hidden ||
      !getEnabled() ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    ) {
      return;
    }

    const n = new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "nav-" + Date.now(),
    });

    const autoClose = setTimeout(() => n.close(), 5000);

    n.onclick = () => {
      window.focus();
      n.close();
      clearTimeout(autoClose);
    };
  }, []);

  return { enabled, permission, toggleEnabled, notify } as const;
}
