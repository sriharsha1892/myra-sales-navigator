"use client";

import { useStore } from "@/lib/navigator/store";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import type { OutreachChannel } from "@/lib/navigator/types";

export function OutreachChannelsSection() {
  const config = useStore((s) => s.adminConfig.outreachChannelConfig);
  const updateAdminConfig = useStore((s) => s.updateAdminConfig);

  const enabledChannels = config?.enabledChannels ?? ["email", "linkedin_connect", "linkedin_inmail", "whatsapp"];
  const defaultChannel = config?.defaultChannel ?? "email";
  const channelInstructions = config?.channelInstructions ?? {};
  const writingRulesDefault = config?.writingRulesDefault ?? "";

  const toggleChannel = (ch: OutreachChannel) => {
    const next = enabledChannels.includes(ch)
      ? enabledChannels.filter((c) => c !== ch)
      : [...enabledChannels, ch];
    // Keep at least one channel enabled
    if (next.length === 0) return;
    updateAdminConfig({
      outreachChannelConfig: {
        ...config,
        enabledChannels: next as OutreachChannel[],
        defaultChannel: next.includes(defaultChannel) ? defaultChannel : (next[0] as OutreachChannel),
        channelInstructions,
        writingRulesDefault,
      },
    });
  };

  const setDefaultChannel = (ch: OutreachChannel) => {
    updateAdminConfig({
      outreachChannelConfig: { ...config, enabledChannels, defaultChannel: ch, channelInstructions, writingRulesDefault },
    });
  };

  const setChannelInstruction = (ch: OutreachChannel, value: string) => {
    updateAdminConfig({
      outreachChannelConfig: {
        ...config,
        enabledChannels,
        defaultChannel,
        channelInstructions: { ...channelInstructions, [ch]: value },
        writingRulesDefault,
      },
    });
  };

  const setWritingRulesDefault = (value: string) => {
    updateAdminConfig({
      outreachChannelConfig: {
        ...config,
        enabledChannels,
        defaultChannel,
        channelInstructions,
        writingRulesDefault: value,
      },
    });
  };

  return (
    <div className="rounded-card border border-surface-3 bg-surface-1 p-5">
      <h3 className="text-sm font-semibold text-text-primary">Outreach Channels</h3>
      <p className="mt-1 text-xs text-text-tertiary">
        Enable/disable channels and configure LLM instructions per channel.
      </p>

      {/* Channel toggles */}
      <div className="mt-4 space-y-2">
        {CHANNEL_OPTIONS.map((opt) => (
          <div key={opt.value} className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs text-text-secondary">
              <input
                type="checkbox"
                checked={enabledChannels.includes(opt.value)}
                onChange={() => toggleChannel(opt.value)}
                className="accent-accent-primary"
              />
              {opt.label}
            </label>
            {enabledChannels.includes(opt.value) && (
              <button
                onClick={() => setDefaultChannel(opt.value)}
                className={`rounded-pill px-2 py-0.5 text-xs ${
                  defaultChannel === opt.value
                    ? "bg-accent-primary/15 text-accent-primary font-medium"
                    : "text-text-tertiary hover:text-text-secondary"
                }`}
              >
                {defaultChannel === opt.value ? "Default" : "Set default"}
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Per-channel LLM instructions */}
      <div className="mt-5 space-y-3">
        <h4 className="text-xs font-semibold text-text-secondary">Channel-Specific Instructions</h4>
        {CHANNEL_OPTIONS.filter((opt) => enabledChannels.includes(opt.value)).map((opt) => (
          <div key={opt.value}>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-text-tertiary">
              {opt.label}
            </label>
            <textarea
              value={channelInstructions[opt.value] ?? ""}
              onChange={(e) => setChannelInstruction(opt.value, e.target.value)}
              rows={2}
              placeholder={`Custom instructions for ${opt.label} drafts...`}
              className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
            />
          </div>
        ))}
      </div>

      {/* Team-wide writing rules */}
      <div className="mt-5">
        <h4 className="text-xs font-semibold text-text-secondary">Team Writing Rules (Default)</h4>
        <p className="mt-0.5 mb-2 text-xs text-text-tertiary">
          Pre-filled for all users. They can override per session.
        </p>
        <textarea
          value={writingRulesDefault}
          onChange={(e) => setWritingRulesDefault(e.target.value)}
          rows={3}
          placeholder="e.g., Always mention our food safety certification. Avoid discussing pricing."
          className="w-full rounded-lg border border-surface-3 bg-surface-0 px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent-primary"
        />
      </div>
    </div>
  );
}
