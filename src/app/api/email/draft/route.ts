import { NextResponse } from "next/server";
import { getGemini, getGroq, isGeminiAvailable, isGroqAvailable } from "@/lib/navigator/llm/client";
import { buildEmailPrompt } from "@/lib/navigator/llm/emailPrompts";
import { defaultAdminConfig } from "@/lib/navigator/mock-data";
import { getCached, setCached } from "@/lib/cache";
import { CACHE_TTLS } from "@/lib/navigator/cache-config";
import type { EmailDraftRequest, EmailDraftResponse, EmailPromptsConfig } from "@/lib/navigator/types";
import { createServerClient } from "@/lib/supabase/server";

async function getEmailPromptsConfig(): Promise<EmailPromptsConfig> {
  const cacheKey = "admin:email-prompts";
  const cached = await getCached<EmailPromptsConfig>(cacheKey);
  if (cached) return cached;

  try {
    const { data } = await createServerClient()
      .from("admin_config")
      .select("email_prompts")
      .eq("id", "global")
      .single();
    if (data?.email_prompts) {
      await setCached(cacheKey, data.email_prompts, CACHE_TTLS.adminConfig).catch(() => {});
      return data.email_prompts as EmailPromptsConfig;
    }
  } catch {
    // Fall through to default
  }
  return defaultAdminConfig.emailPrompts;
}

export async function POST(request: Request) {
  if (!isGeminiAvailable() && !isGroqAvailable()) {
    return NextResponse.json(
      { error: "Email generation not available — no LLM API key configured" },
      { status: 503 }
    );
  }

  let body: EmailDraftRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.contactName || !body.companyName || !body.tone) {
    return NextResponse.json(
      { error: "Missing required fields: contactName, companyName, tone" },
      { status: 400 }
    );
  }

  // Default optional fields to prevent crashes in prompt builder
  if (!body.signals) body.signals = [];
  if (!body.hubspotStatus) body.hubspotStatus = "none";
  if (!body.contactTitle) body.contactTitle = "";
  if (!body.companyIndustry) body.companyIndustry = "";
  if (!body.contactHeadline) body.contactHeadline = undefined;
  if (!body.contactSeniority) body.contactSeniority = undefined;

  try {
    const emailPromptsConfig = await getEmailPromptsConfig();
    const prompt = buildEmailPrompt(body, emailPromptsConfig);
    // Try Gemini first, fall back to Groq if unavailable or fails
    let raw: string;
    try {
      if (!isGeminiAvailable()) throw new Error("Gemini not configured");
      const gemini = getGemini();
      raw = await gemini.complete(prompt, { json: true, maxTokens: 1024, temperature: 0.7 });
    } catch (geminiErr) {
      console.warn("[Email Draft] Gemini failed, falling back to Groq:", geminiErr);
      const groq = getGroq();
      raw = await groq.complete(prompt, { json: true, maxTokens: 1024, temperature: 0.7 });
    }

    let draft: EmailDraftResponse;
    try {
      draft = JSON.parse(raw);
    } catch {
      // If JSON parsing fails, try to extract subject and body from raw text
      draft = {
        subject: `Intro — ${body.companyName}`,
        body: raw,
      };
    }

    if (!draft.subject || !draft.body) {
      return NextResponse.json(
        { error: "LLM returned incomplete draft" },
        { status: 502 }
      );
    }

    return NextResponse.json(draft);
  } catch (err) {
    console.error("[Email Draft] Generation failed:", err);
    return NextResponse.json(
      { error: "Email generation failed. Please try again." },
      { status: 500 }
    );
  }
}
