"use client";

import React from "react";
import { CHANNEL_OPTIONS } from "@/lib/navigator/outreach/channelConfig";
import { Tooltip } from "@/components/navigator/shared/Tooltip";
import type { OutreachChannel } from "@/lib/navigator/types";

interface ChannelSelectorProps {
  channel: OutreachChannel;
  enabledChannels: OutreachChannel[];
  whatsappDisabled: boolean;
  linkedinDisabled: boolean;
  contactPhone: string | null;
  onChannelChange: (channel: OutreachChannel) => void;
}

export const ChannelSelector = React.memo(function ChannelSelector({
  channel,
  enabledChannels,
  whatsappDisabled,
  linkedinDisabled,
  contactPhone,
  onChannelChange,
}: ChannelSelectorProps) {
  return (
    <div className="flex gap-1 border-b border-surface-3 px-5 py-2.5">
      {CHANNEL_OPTIONS.filter((opt) => enabledChannels.includes(opt.value)).map((opt) => {
        const isDisabled =
          (opt.value === "whatsapp" && whatsappDisabled) ||
          ((opt.value === "linkedin_connect" || opt.value === "linkedin_inmail") && linkedinDisabled);
        const isActive = channel === opt.value;
        const btn = (
          <button
            key={opt.value}
            onClick={() => !isDisabled && onChannelChange(opt.value)}
            disabled={isDisabled}
            className={`rounded-pill px-3 py-1.5 text-xs transition-colors ${
              isActive
                ? "bg-accent-primary/15 text-accent-primary font-medium"
                : isDisabled
                  ? "cursor-not-allowed text-text-tertiary/40"
                  : "text-text-secondary hover:bg-surface-2 hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        );
        return isDisabled ? (
          <Tooltip key={opt.value} text={
            opt.value === "whatsapp"
              ? (contactPhone ? "Requires prior CRM contact" : "No phone number available")
              : "No LinkedIn URL available"
          }>{btn}</Tooltip>
        ) : btn;
      })}
    </div>
  );
});
