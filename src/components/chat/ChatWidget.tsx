"use client";

import { useState, useRef, useEffect } from "react";
import { useChat } from "@/hooks/useChat";
import { ChatMessage } from "./ChatMessage";
import { useStore } from "@/lib/store";
import { DEFAULT_CHATBOT_CONFIG } from "@/lib/types";
import type { ChatbotConfig } from "@/lib/types";
import { cn } from "@/lib/cn";

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { messages, sendMessage, isStreaming, clearMessages } = useChat();
  const adminConfig = useStore((s) => s.adminConfig);

  const chatbotConfig: ChatbotConfig =
    (adminConfig as unknown as Record<string, unknown>).chatbotConfig as ChatbotConfig | undefined
    ?? DEFAULT_CHATBOT_CONFIG;

  // Don't render if disabled
  if (!chatbotConfig.enabled) return null;

  const handleSend = () => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    sendMessage(text);
  };

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-accent-primary text-text-inverse shadow-lg transition-all hover:bg-accent-primary-hover hover:scale-105"
          title="Chat with myRA Assistant"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex h-[480px] w-[360px] flex-col rounded-card border border-surface-3 bg-surface-1 shadow-lg">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-surface-3 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-primary text-[10px] font-bold text-text-inverse">
                M
              </div>
              <span className="text-sm font-semibold text-text-primary">myRA Assistant</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={clearMessages}
                className="rounded p-1 text-text-tertiary hover:text-text-primary"
                title="Clear chat"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </button>
              <button
                onClick={() => setOpen(false)}
                className="rounded p-1 text-text-tertiary hover:text-text-primary"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex h-full items-center justify-center">
                <p className="text-center text-xs text-text-tertiary">
                  {chatbotConfig.greeting}
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="border-t border-surface-3 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") handleSend(); }}
                placeholder="Ask about the app or a company..."
                disabled={isStreaming}
                className="flex-1 rounded-input border border-surface-3 bg-surface-2 px-3 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-input transition-colors",
                  input.trim() && !isStreaming
                    ? "bg-accent-primary text-text-inverse hover:bg-accent-primary-hover"
                    : "bg-surface-3 text-text-tertiary"
                )}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
