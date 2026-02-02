import { getCached, setCached } from "@/lib/cache";
import type { VerificationResult } from "@/lib/types";

const CLEAROUT_API_BASE = "https://api.clearout.io/v2";
const CACHE_TTL_MINUTES = 30 * 24 * 60; // 30 days
const BATCH_DELAY_MS = 200;

export function isClearoutAvailable(): boolean {
  return !!process.env.CLEAROUT_API_KEY;
}

function clearoutHeaders(): Record<string, string> {
  return {
    Authorization: process.env.CLEAROUT_API_KEY!,
    "Content-Type": "application/json",
  };
}

function mapScore(status: string, safeToSend: boolean | string): number {
  const safe = safeToSend === true || safeToSend === "yes";
  if (status === "valid" && safe) return 95;
  if (status === "valid") return 70;
  if (status === "unknown") return 50;
  return 10; // invalid
}

function mapStatus(status: string): VerificationResult["status"] {
  if (status === "valid") return "valid";
  if (status === "invalid") return "invalid";
  return "unknown";
}

function cacheKey(email: string): string {
  return `clearout:email:${email.toLowerCase().trim()}`;
}

export async function verifyEmail(email: string): Promise<VerificationResult> {
  const cached = await getCached<VerificationResult>(cacheKey(email));
  if (cached) return cached;

  const res = await fetch(`${CLEAROUT_API_BASE}/email_verify/instant`, {
    method: "POST",
    headers: clearoutHeaders(),
    body: JSON.stringify({ email }),
  });

  if (!res.ok) {
    const code = res.status;
    if (code === 401) throw new Error("Invalid Clearout API key");
    if (code === 402) throw new Error("Clearout credits exhausted");
    throw new Error(`Clearout API error: ${code}`);
  }

  const json = await res.json();
  const data = json.data ?? json;

  const result: VerificationResult = {
    email,
    status: mapStatus(data.status),
    score: mapScore(data.status, data.safe_to_send ?? false),
  };

  await setCached(cacheKey(email), result, CACHE_TTL_MINUTES);
  return result;
}

export async function verifyEmails(emails: string[]): Promise<VerificationResult[]> {
  const results: VerificationResult[] = [];
  const toVerify: string[] = [];

  // Check cache first for all emails
  for (const email of emails) {
    const cached = await getCached<VerificationResult>(cacheKey(email));
    if (cached) {
      results.push(cached);
    } else {
      toVerify.push(email);
    }
  }

  // Verify uncached emails sequentially with delay
  for (let i = 0; i < toVerify.length; i++) {
    if (i > 0) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
    const result = await verifyEmail(toVerify[i]);
    results.push(result);
  }

  // Return in original email order
  const resultMap = new Map(results.map((r) => [r.email.toLowerCase().trim(), r]));
  return emails.map(
    (email) =>
      resultMap.get(email.toLowerCase().trim()) ?? {
        email,
        status: "unknown" as const,
        score: 0,
      }
  );
}

export async function getClearoutCredits(): Promise<{ available: number; total: number } | null> {
  if (!isClearoutAvailable()) return null;

  try {
    const res = await fetch(`${CLEAROUT_API_BASE}/email_verify/getcredits`, {
      method: "GET",
      headers: clearoutHeaders(),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const credits = json.data?.credits ?? json.data;
    const available = credits?.available ?? credits?.available_credits ?? null;
    const total = credits?.total ?? credits?.total_credits ?? null;
    if (available === null) return null;
    return { available, total: total ?? available };
  } catch {
    return null;
  }
}
