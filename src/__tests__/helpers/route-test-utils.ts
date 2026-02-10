import { NextRequest } from "next/server";

/**
 * Create a NextRequest with optional JSON body and cookies.
 */
export function makeRequest(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {}
): NextRequest {
  const init: RequestInit = {
    method: options.method ?? (options.body ? "POST" : "GET"),
  };

  if (options.body) {
    init.body = JSON.stringify(options.body);
    init.headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };
  } else if (options.headers) {
    init.headers = options.headers;
  }

  // NextRequest constructor expects NextRequestInit which is not publicly exported;
  // RequestInit is structurally compatible at runtime but not at the type level.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new NextRequest(url, init as any);
}

/**
 * Create route params in the Next.js 15 format (Promise-based).
 */
export function makeParams<T extends Record<string, string>>(
  params: T
): { params: Promise<T> } {
  return { params: Promise.resolve(params) };
}

/**
 * Extract JSON from a Response.
 */
export async function getJson(res: Response): Promise<unknown> {
  return res.json();
}

/**
 * Extract a specific cookie from a NextResponse.
 */
export function getCookie(
  res: Response,
  cookieName: string
): string | undefined {
  const setCookie = res.headers.getSetCookie?.();
  if (!setCookie) return undefined;
  for (const header of setCookie) {
    if (header.startsWith(`${cookieName}=`)) {
      const value = header.split(";")[0].split("=").slice(1).join("=");
      return value;
    }
  }
  return undefined;
}
