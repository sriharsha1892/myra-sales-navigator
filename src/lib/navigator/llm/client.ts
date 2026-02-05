import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ---------------------------------------------------------------------------
// LLM Provider Interface
// ---------------------------------------------------------------------------

export interface LLMOptions {
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface LLMProvider {
  complete(prompt: string, options?: LLMOptions): Promise<string>;
  readonly name: string;
}

// ---------------------------------------------------------------------------
// Groq Provider — Llama 3.1 8B (search, extraction, summaries)
// ---------------------------------------------------------------------------

class GroqProvider implements LLMProvider {
  readonly name = "groq";
  private client: Groq | null = null;

  private getClient(): Groq {
    if (!this.client) {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) throw new Error("GROQ_API_KEY not configured");
      this.client = new Groq({ apiKey });
    }
    return this.client;
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const client = this.getClient();
    const response = await client.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.3,
      ...(options?.json ? { response_format: { type: "json_object" } } : {}),
    });
    return response.choices[0]?.message?.content ?? "";
  }
}

// ---------------------------------------------------------------------------
// Gemini Provider — 2.5 Flash-Lite (email writing + JSON fallback)
// ---------------------------------------------------------------------------

class GeminiProvider implements LLMProvider {
  readonly name = "gemini";
  private ai: GoogleGenerativeAI | null = null;

  private getAI(): GoogleGenerativeAI {
    if (!this.ai) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
      this.ai = new GoogleGenerativeAI(apiKey);
    }
    return this.ai;
  }

  async complete(prompt: string, options?: LLMOptions): Promise<string> {
    const ai = this.getAI();
    const model = ai.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        maxOutputTokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.7,
        ...(options?.json ? { responseMimeType: "application/json" } : {}),
      },
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

// ---------------------------------------------------------------------------
// Singleton instances
// ---------------------------------------------------------------------------

let _groq: GroqProvider | null = null;
let _gemini: GeminiProvider | null = null;

export function getGroq(): LLMProvider {
  if (!_groq) _groq = new GroqProvider();
  return _groq;
}

export function getGemini(): LLMProvider {
  if (!_gemini) _gemini = new GeminiProvider();
  return _gemini;
}

// ---------------------------------------------------------------------------
// Utility: complete with fallback
// ---------------------------------------------------------------------------

export async function completeWithFallback(
  prompt: string,
  options?: LLMOptions & { primary?: LLMProvider; fallback?: LLMProvider }
): Promise<string> {
  const primary = options?.primary ?? getGroq();
  const fallback = options?.fallback ?? getGemini();

  try {
    return await primary.complete(prompt, options);
  } catch (err) {
    console.warn(`[LLM] ${primary.name} failed, falling back to ${fallback.name}:`, err);
    return fallback.complete(prompt, options);
  }
}

// ---------------------------------------------------------------------------
// Utility: complete JSON with validation + fallback
// ---------------------------------------------------------------------------

export async function completeJSON<T>(
  prompt: string,
  validate: (data: unknown) => T,
  options?: Omit<LLMOptions, "json">
): Promise<T> {
  const groq = getGroq();
  const gemini = getGemini();

  // Try Groq first
  try {
    const raw = await groq.complete(prompt, { ...options, json: true });
    return validate(JSON.parse(raw));
  } catch (groqErr) {
    console.warn("[LLM] Groq JSON failed, retrying on Gemini:", groqErr);
  }

  // Fallback to Gemini
  try {
    const raw = await gemini.complete(prompt, { ...options, json: true });
    return validate(JSON.parse(raw));
  } catch (geminiErr) {
    console.warn("[LLM] Gemini JSON fallback also failed:", geminiErr);
    throw geminiErr;
  }
}

// ---------------------------------------------------------------------------
// Check if LLM providers are available
// ---------------------------------------------------------------------------

export function isGroqAvailable(): boolean {
  return !!process.env.GROQ_API_KEY;
}

export function isGeminiAvailable(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// ---------------------------------------------------------------------------
// Company summary generation (used by dossier route)
// ---------------------------------------------------------------------------

export async function generateCompanySummary(input: {
  description?: string;
  signals?: { type: string; title: string }[];
  industry?: string;
  name: string;
}): Promise<string> {
  const signalText = input.signals?.length
    ? `Recent signals: ${input.signals.map((s) => `${s.type}: ${s.title}`).join("; ")}`
    : "No recent signals available.";

  const prompt = `Write 3 bullet points about ${input.name} for a B2B sales team:
1) What they do (core business)
2) Why now (recent signal or growth)
3) Who they compete with
Max 2 sentences each. No marketing fluff.

Context:
- Industry: ${input.industry || "Unknown"}
- Description: ${input.description || "Not available"}
- ${signalText}`;

  try {
    return await completeWithFallback(prompt, { maxTokens: 256, temperature: 0.3 });
  } catch {
    return "";
  }
}
