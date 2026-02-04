import { NextRequest } from "next/server";
import Groq from "groq-sdk";
import { buildChatSystemPrompt } from "@/lib/navigator/llm/chatSystemPrompt";
import type { ChatbotConfig } from "@/lib/navigator/types";
import { createServerClient } from "@/lib/supabase/server";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function POST(request: NextRequest) {
  try {
    const { messages, context, chatbotConfig } = await request.json() as {
      messages: ChatMessage[];
      context?: {
        companyName?: string;
        companyDomain?: string;
        industry?: string;
        employeeCount?: number;
        location?: string;
        icpScore?: number;
        hubspotStatus?: string;
        signals?: { type: string; title: string }[];
        contacts?: { name: string; title: string; email?: string }[];
        status?: string;
      };
      chatbotConfig?: ChatbotConfig;
    };

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GROQ_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Load chatbot config from admin if not passed
    let config = chatbotConfig;
    if (!config) {
      try {
        const sb = createServerClient();
        const { data } = await sb
          .from("admin_config")
          .select("*")
          .eq("id", "global")
          .single();
        if (data?.chatbot_config) {
          config = typeof data.chatbot_config === "string"
            ? JSON.parse(data.chatbot_config)
            : data.chatbot_config;
        }
      } catch {
        // Use defaults
      }
    }

    const systemPrompt = buildChatSystemPrompt(config, context);
    const temperature = config?.temperature ?? 0.4;
    const maxHistory = config?.maxHistoryMessages ?? 20;

    const groq = new Groq({ apiKey });

    const trimmedMessages = messages.slice(-maxHistory);

    const stream = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        { role: "system", content: systemPrompt },
        ...trimmedMessages,
      ],
      max_tokens: 1024,
      temperature,
      stream: true,
    });

    // Stream response
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            const text = chunk.choices[0]?.delta?.content ?? "";
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          }
        } catch (err) {
          console.error("Chat stream error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    console.error("POST /api/chat error:", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
