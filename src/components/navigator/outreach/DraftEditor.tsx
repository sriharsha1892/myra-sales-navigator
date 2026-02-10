"use client";

import React from "react";
import type { OutreachChannel } from "@/lib/navigator/types";

interface DraftEditorProps {
  channel: OutreachChannel;
  subject: string;
  message: string;
  hasSubject: boolean;
  maxChars: number | null;
  isGenerating: boolean;
  hasGenerated: boolean;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onGenerate: () => void;
}

export const DraftEditor = React.memo(function DraftEditor({
  channel,
  subject,
  message,
  hasSubject,
  maxChars,
  isGenerating,
  hasGenerated,
  onSubjectChange,
  onMessageChange,
  onGenerate,
}: DraftEditorProps) {
  const charCount = message.length;
  const charWarning = maxChars ? charCount >= maxChars * 0.9 : false;
  const charOver = maxChars ? charCount > maxChars : false;

  return (
    <div className="px-5 py-4">
      {!hasGenerated && !isGenerating ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <p className="mb-3 text-sm text-text-secondary">
            Generate a personalized {channel === "email" ? "email" : channel.replace("_", " ")} draft based on prospect data and signals.
          </p>
          <button
            onClick={onGenerate}
            className="rounded-lg bg-accent-primary px-4 py-2 text-sm font-medium text-surface-0 transition-opacity hover:opacity-90"
          >
            Generate Draft
          </button>
        </div>
      ) : isGenerating ? (
        <div className="flex flex-col items-center justify-center py-8">
          <div className="mb-3 h-5 w-5 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" />
          <p className="text-xs text-text-tertiary">Generating draft...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Subject (only for channels that have it) */}
          {hasSubject && (
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => onSubjectChange(e.target.value)}
                className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-accent-primary"
              />
            </div>
          )}

          {/* Message */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Message
              </label>
              {maxChars && (
                <span
                  className={`font-mono text-xs ${
                    charOver
                      ? "text-danger"
                      : charWarning
                        ? "text-warning"
                        : "text-text-tertiary"
                  }`}
                >
                  {charCount}/{maxChars}
                </span>
              )}
            </div>
            <textarea
              value={message}
              onChange={(e) => onMessageChange(e.target.value)}
              rows={channel === "linkedin_connect" || channel === "whatsapp" ? 5 : 10}
              className={`w-full resize-y rounded-lg border bg-surface-0 px-3 py-2 font-mono text-sm leading-relaxed text-text-primary outline-none transition-colors focus:border-accent-primary ${
                charOver ? "border-danger" : "border-surface-3"
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
});
