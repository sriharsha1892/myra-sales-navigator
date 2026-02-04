import { NextResponse } from "next/server";
import { getGemini, getGroq, isGeminiAvailable, isGroqAvailable } from "@/lib/navigator/llm/client";
import { buildOutreachPrompt } from "@/lib/navigator/llm/outreachPrompts";
import { defaultAdminConfig } from "@/lib/navigator/mock-data";
import { getCached, setCached } from "@/lib/cache";
import type { OutreachDraftRequest, OutreachDraftResponse, EmailPromptsConfig } from "@/lib/navigator/types";
import { CHANNEL_CONSTRAINTS } from "@/lib/navigator/outreach/channelConfig";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

function getSupabase() {
  if (!supabaseUrl || !supabaseKey) return null;
  return createClient(supabaseUrl, supabaseKey);
}

async function getEmailPromptsConfig(): Promise<EmailPromptsConfig> {
  const cacheKey = "admin:email-prompts";
  const cached = await getCached<EmailPromptsConfig>(cacheKey);
  if (cached) return cached;

  try {
    const sb = getSupabase();
    if (sb) {
      const { data } = await sb
        .from("admin_config")
        .select("email_prompts")
        .eq("id", "global")
        .single();
      if (data?.email_prompts) {
        await setCached(cacheKey, data.email_prompts, 60).catch(() => {});
        return data.email_prompts as EmailPromptsConfig;
      }
    }
  } catch {
    // Fall through to default
  }
  return defaultAdminConfig.emailPrompts;
}

export async function POST(request: Request) {
  if (!isGeminiAvailable() && !isGroqAvailable()) {
    return NextResponse.json(
      { error: "Outreach generation not available — no LLM API key configured" },
      { status: 503 }
    );
  }

  let body: OutreachDraftRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.contactName || !body.companyName || !body.tone || !body.channel) {
    return NextResponse.json(
      { error: "Missing required fields: contactName, companyName, tone, channel" },
      { status: 400 }
    );
  }

  if (!CHANNEL_CONSTRAINTS[body.channel]) {
    return NextResponse.json(
      { error: `Invalid channel: ${body.channel}` },
      { status: 400 }
    );
  }

  // Default optional fields
  if (!body.signals) body.signals = [];
  if (!body.hubspotStatus) body.hubspotStatus = "none";
  if (!body.contactTitle) body.contactTitle = "";
  if (!body.companyIndustry) body.companyIndustry = "";

  try {
    const emailPromptsConfig = await getEmailPromptsConfig();
    const prompt = buildOutreachPrompt(body, emailPromptsConfig);

    let raw: string;
    try {
      if (!isGeminiAvailable()) throw new Error("Gemini not configured");
      const gemini = getGemini();
      raw = await gemini.complete(prompt, { json: true, maxTokens: 1024, temperature: 0.7 });
    } catch (geminiErr) {
      console.warn("[Outreach Draft] Gemini failed, falling back to Groq:", geminiErr);
      const groq = getGroq();
      raw = await groq.complete(prompt, { json: true, maxTokens: 1024, temperature: 0.7 });
    }

    let parsed: { subject?: string; message?: string; body?: string };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { message: raw };
    }

    const constraints = CHANNEL_CONSTRAINTS[body.channel];
    const message = parsed.message || parsed.body || raw;

    const draft: OutreachDraftResponse = {
      channel: body.channel,
      subject: constraints.hasSubject ? (parsed.subject || `Intro — ${body.companyName}`) : undefined,
      message,
    };

    if (!draft.message) {
      return NextResponse.json({ error: "LLM returned incomplete draft" }, { status: 502 });
    }

    // Fire-and-forget log to outreach_drafts
    const sb = getSupabase();
    if (sb) {
      Promise.resolve(
        sb.from("outreach_drafts").insert({
          contact_id: body.contactId || body.contactName,
          contact_email: null,
          company_domain: body.companyName,
          channel: body.channel,
          template: body.template || null,
          tone: body.tone,
          generated_by: "api",
          subject: draft.subject || null,
          message: draft.message,
          writing_rules: body.writingRules || null,
        })
      ).catch(() => {});
    }

    return NextResponse.json(draft);
  } catch (err) {
    console.error("[Outreach Draft] Generation failed:", err);
    return NextResponse.json(
      { error: "Outreach generation failed. Please try again." },
      { status: 500 }
    );
  }
}
