"use client";

import { useEffect, useRef } from "react";
import { useStore } from "@/lib/navigator/store";

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const IDLE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

export function useSessionActivity() {
  const userName = useStore((s) => s.userName);
  const sessionIdRef = useRef<string | null>(null);
  const lastActivityRef = useRef(Date.now());
  const prevCountsRef = useRef({ search: 0, triage: 0, companyView: 0, export: 0 });
  const idleEndedRef = useRef(false);

  useEffect(() => {
    if (!userName) return;

    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    // Track last user activity
    const updateActivity = () => {
      lastActivityRef.current = Date.now();
      // If session was ended due to idle, start a new one
      if (idleEndedRef.current) {
        idleEndedRef.current = false;
        startSession();
      }
    };

    const passiveOpts = { passive: true, capture: true } as const;
    window.addEventListener("mousemove", updateActivity, passiveOpts);
    window.addEventListener("keydown", updateActivity, passiveOpts);
    window.addEventListener("scroll", updateActivity, passiveOpts);
    window.addEventListener("click", updateActivity, passiveOpts);

    function getDeltas() {
      const state = useStore.getState();
      const deltas = {
        search: state.sessionSearchCount - prevCountsRef.current.search,
        triage: state.sessionTriageCount - prevCountsRef.current.triage,
        companyView: state.sessionCompaniesReviewed - prevCountsRef.current.companyView,
        export: state.sessionContactsExported - prevCountsRef.current.export,
      };
      prevCountsRef.current = {
        search: state.sessionSearchCount,
        triage: state.sessionTriageCount,
        companyView: state.sessionCompaniesReviewed,
        export: state.sessionContactsExported,
      };
      return deltas;
    }

    async function startSession() {
      try {
        const res = await fetch("/api/session/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "start", userName }),
        });
        if (res.ok) {
          const data = await res.json();
          sessionIdRef.current = data.sessionId;
          // Reset prev counts on new session
          const state = useStore.getState();
          prevCountsRef.current = {
            search: state.sessionSearchCount,
            triage: state.sessionTriageCount,
            companyView: state.sessionCompaniesReviewed,
            export: state.sessionContactsExported,
          };
        }
      } catch {
        // Silent — session tracking is best-effort
      }
    }

    function sendHeartbeat() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;

      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs > IDLE_THRESHOLD_MS) {
        // User idle > 15min — end session
        const deltas = getDeltas();
        fetch("/api/session/activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "end", sessionId, deltas }),
        }).catch(() => {});
        sessionIdRef.current = null;
        idleEndedRef.current = true;
        return;
      }

      const deltas = getDeltas();
      fetch("/api/session/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "heartbeat", sessionId, deltas }),
      }).catch(() => {});
    }

    function sendEnd() {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const deltas = getDeltas();
      // Use sendBeacon for reliability on page unload
      const payload = JSON.stringify({ action: "end", sessionId, deltas });
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/session/activity", payload);
      } else {
        fetch("/api/session/activity", {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: payload,
          keepalive: true,
        }).catch(() => {});
      }
      sessionIdRef.current = null;
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "hidden") {
        // Eager heartbeat when tab goes hidden
        sendHeartbeat();
      }
    }

    function handleBeforeUnload() {
      sendEnd();
    }

    // Start session
    startSession();

    // 5-minute heartbeat interval
    heartbeatTimer = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      // Cleanup
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      window.removeEventListener("mousemove", updateActivity, passiveOpts);
      window.removeEventListener("keydown", updateActivity, passiveOpts);
      window.removeEventListener("scroll", updateActivity, passiveOpts);
      window.removeEventListener("click", updateActivity, passiveOpts);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      sendEnd();
    };
  }, [userName]);
}
