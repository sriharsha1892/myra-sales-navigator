"use client";

import { useState, useCallback, useRef } from "react";
import { useStore } from "@/lib/navigator/store";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const selectedCompany = useStore((s) => s.selectedCompany);
  const contactsByDomain = useStore((s) => s.contactsByDomain);

  const sendMessage = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsStreaming(true);

    const assistantId = `msg-${Date.now()}-assistant`;
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", timestamp: Date.now() },
    ]);

    try {
      const company = selectedCompany();
      const contacts = company ? contactsByDomain[company.domain] ?? [] : [];

      const context = company
        ? {
            companyName: company.name,
            companyDomain: company.domain,
            industry: company.industry,
            employeeCount: company.employeeCount,
            location: company.location,
            icpScore: company.icpScore,
            hubspotStatus: company.hubspotStatus,
            signals: company.signals.map((s) => ({ type: s.type, title: s.title })),
            contacts: contacts.slice(0, 5).map((c) => ({
              name: `${c.firstName} ${c.lastName}`,
              title: c.title,
              email: c.email ?? undefined,
            })),
            status: company.status,
          }
        : undefined;

      // Build message history for API
      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      abortRef.current = new AbortController();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, context }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? "Chat request failed");
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: accumulated } : m
          )
        );
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, something went wrong. Please try again." }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [messages, selectedCompany, contactsByDomain]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { messages, sendMessage, isStreaming, stopStreaming, clearMessages };
}
