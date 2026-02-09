"use client";

import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/lib/navigator/store";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import type {
  OutreachEnrollment,
  OutreachSequence,
  OutreachStepLog,
} from "@/lib/navigator/types";

interface SequenceTimelineProps {
  enrollment: OutreachEnrollment;
  sequence: OutreachSequence;
  stepLogs: OutreachStepLog[];
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "#d4a012",
  call: "#22d3ee",
  linkedin_connect: "#0077B5",
  linkedin_inmail: "#0077B5",
  whatsapp: "#25D366",
};

const STATUS_COLORS = {
  completed: { dot: "bg-success", ring: "ring-success/30", text: "text-success" },
  current: { dot: "bg-accent-primary", ring: "ring-accent-primary/30", text: "text-accent-primary" },
  pending: { dot: "bg-surface-3", ring: "ring-surface-3/30", text: "text-text-tertiary" },
  skipped: { dot: "bg-text-tertiary", ring: "ring-text-tertiary/30", text: "text-text-tertiary" },
};

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function isOverdue(dueDate: string | null): boolean {
  if (!dueDate) return false;
  return new Date(dueDate) < new Date();
}

export function SequenceTimeline({
  enrollment,
  sequence,
  stepLogs,
}: SequenceTimelineProps) {
  const addToast = useStore((s) => s.addToast);
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState<"pause" | "resume" | "unenroll" | null>(null);
  const [confirmUnenroll, setConfirmUnenroll] = useState(false);

  const logByStep = useMemo(() => {
    const map: Record<number, OutreachStepLog> = {};
    for (const log of stepLogs) {
      map[log.stepIndex] = log;
    }
    return map;
  }, [stepLogs]);

  const handlePauseResume = useCallback(async () => {
    const action = enrollment.status === "paused" ? "resume" : "pause";
    setActionLoading(action);
    try {
      const res = await fetch(`/api/outreach/enrollments/${enrollment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error(`Failed to ${action} enrollment`);
      addToast({ message: `Sequence ${action}d`, type: "success" });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
    } catch {
      addToast({ message: `Failed to ${action} sequence`, type: "error" });
    } finally {
      setActionLoading(null);
    }
  }, [enrollment.id, enrollment.status, addToast]);

  const handleUnenroll = useCallback(async () => {
    setActionLoading("unenroll");
    try {
      const res = await fetch(`/api/outreach/enrollments/${enrollment.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "unenroll" }),
      });
      if (!res.ok) throw new Error("Failed to unenroll");
      addToast({ message: "Contact unenrolled from sequence", type: "success" });
      queryClient.invalidateQueries({ queryKey: ["enrollments"] });
      setConfirmUnenroll(false);
    } catch {
      addToast({ message: "Failed to unenroll", type: "error" });
    } finally {
      setActionLoading(null);
    }
  }, [enrollment.id, addToast]);

  const isPausedOrDone =
    enrollment.status === "paused" ||
    enrollment.status === "completed" ||
    enrollment.status === "unenrolled" ||
    enrollment.status === "failed";

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
          {sequence.name}
        </span>
        <span
          className={`rounded-pill px-1.5 py-0.5 text-[10px] font-medium ${
            enrollment.status === "active"
              ? "bg-success/10 text-success"
              : enrollment.status === "paused"
                ? "bg-warning/10 text-warning"
                : enrollment.status === "completed"
                  ? "bg-success/10 text-success"
                  : "bg-surface-2 text-text-tertiary"
          }`}
        >
          {enrollment.status}
        </span>
      </div>

      {/* Timeline */}
      <div className="relative ml-1">
        {sequence.steps.length > 1 && (
          <div
            className="absolute left-[6px] top-[8px] w-px bg-surface-3"
            style={{ height: `calc(100% - 16px)` }}
          />
        )}

        <div className="space-y-2">
          {sequence.steps.map((step, index) => {
            const log = logByStep[index];
            const isCurrent = index === enrollment.currentStep && enrollment.status === "active";
            const isCompleted = log?.status === "completed";
            const isSkipped = log?.status === "skipped";
            const isFuture = index > enrollment.currentStep;

            const statusKey = isCompleted
              ? "completed"
              : isSkipped
                ? "skipped"
                : isCurrent
                  ? "current"
                  : "pending";
            const colors = STATUS_COLORS[statusKey];
            const channelOpt = CHANNEL_OPTIONS.find((o) => o.value === step.channel);
            const channelColor = CHANNEL_COLORS[step.channel] ?? "#6b6b80";

            const overdue = isCurrent && isOverdue(enrollment.nextStepDueAt);

            return (
              <div key={index} className="flex items-start gap-2.5">
                {/* Dot */}
                <div className="relative mt-1 flex-shrink-0">
                  <div
                    className={`h-[13px] w-[13px] rounded-full ${colors.dot} ${
                      isCurrent ? "ring-2 ring-offset-1 ring-offset-surface-1 " + colors.ring : ""
                    } ${isCurrent && !isPausedOrDone ? "animate-pulse" : ""}`}
                  />
                  {isCompleted && (
                    <svg
                      width="9"
                      height="9"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="white"
                      strokeWidth="3"
                      className="absolute left-[2px] top-[2px]"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span
                      className="rounded-pill px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        color: channelColor,
                        backgroundColor: `${channelColor}1a`,
                      }}
                    >
                      {channelOpt?.label ?? step.channel}
                    </span>
                    <span className="font-mono text-[10px] text-text-tertiary">
                      Day {step.delayDays}
                    </span>

                    {isCompleted && log?.completedAt && (
                      <span className="text-[10px] text-success">
                        {formatShortDate(log.completedAt)}
                      </span>
                    )}
                    {isSkipped && (
                      <span className="text-[10px] text-text-tertiary">Skipped</span>
                    )}
                    {isCurrent && enrollment.nextStepDueAt && (
                      <span
                        className={`text-[10px] font-medium ${
                          overdue ? "text-danger" : "text-accent-primary"
                        }`}
                      >
                        {overdue ? "Overdue" : `Due ${formatShortDate(enrollment.nextStepDueAt)}`}
                      </span>
                    )}
                  </div>

                  {/* Outcome / notes from log */}
                  {log?.outcome && (
                    <p className="mt-0.5 text-[10px] text-text-secondary">
                      {log.outcome}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {(enrollment.status === "active" || enrollment.status === "paused") && (
        <div className="flex items-center gap-2 border-t border-surface-3 pt-2">
          <button
            onClick={handlePauseResume}
            disabled={actionLoading !== null}
            className="rounded-input border border-surface-3 px-2.5 py-1 text-[10px] font-medium text-text-secondary transition-colors duration-[180ms] hover:bg-surface-2 hover:text-text-primary disabled:opacity-40"
          >
            {actionLoading === "pause" || actionLoading === "resume"
              ? "..."
              : enrollment.status === "paused"
                ? "Resume"
                : "Pause"}
          </button>

          {confirmUnenroll ? (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-text-tertiary">Unenroll?</span>
              <button
                onClick={handleUnenroll}
                disabled={actionLoading === "unenroll"}
                className="rounded-input px-2 py-0.5 text-[10px] font-medium text-danger transition-colors duration-[180ms] hover:bg-danger/10"
              >
                {actionLoading === "unenroll" ? "..." : "Confirm"}
              </button>
              <button
                onClick={() => setConfirmUnenroll(false)}
                className="text-[10px] text-text-tertiary transition-colors duration-[180ms] hover:text-text-primary"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmUnenroll(true)}
              className="text-[10px] text-text-tertiary transition-colors duration-[180ms] hover:text-danger"
            >
              Unenroll
            </button>
          )}
        </div>
      )}
    </div>
  );
}
