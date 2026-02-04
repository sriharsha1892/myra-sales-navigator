"use client";

import { cn } from "@/lib/cn";
import type { ChatMessage as ChatMessageType } from "@/hooks/navigator/useChat";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}>
      <div
        className={cn(
          "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold",
          isUser
            ? "bg-accent-primary text-text-inverse"
            : "bg-surface-3 text-text-secondary"
        )}
      >
        {isUser ? "U" : "M"}
      </div>
      <div
        className={cn(
          "max-w-[80%] rounded-card px-3 py-2 text-xs leading-relaxed",
          isUser
            ? "bg-accent-primary/15 text-text-primary"
            : "bg-surface-2 text-text-primary"
        )}
      >
        {message.content ? (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        ) : (
          <div className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-text-tertiary" style={{ animationDelay: "300ms" }} />
          </div>
        )}
      </div>
    </div>
  );
}
