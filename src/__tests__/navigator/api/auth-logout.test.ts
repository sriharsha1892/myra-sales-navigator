/** @vitest-environment node */
import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/auth/logout/route";

// --- Helpers ----------------------------------------------------------------

function makeRequest() {
  return new Request("http://localhost/api/auth/logout", { method: "POST" });
}

// --- Tests ------------------------------------------------------------------

describe("POST /api/auth/logout", () => {
  it("returns 200 with { success: true }", async () => {
    const res = await POST();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("clears myra_session cookie (maxAge=0)", async () => {
    const res = await POST();
    const setCookie = res.headers.getSetCookie?.();
    expect(setCookie).toBeDefined();

    const sessionCookie = setCookie?.find((h: string) =>
      h.startsWith("myra_session=")
    );
    expect(sessionCookie).toBeDefined();
    // Cookie value should be empty and maxAge=0 clears it
    expect(sessionCookie).toContain("myra_session=;");
    expect(sessionCookie).toContain("Max-Age=0");
  });

  it("clears myra_user cookie (maxAge=0)", async () => {
    const res = await POST();
    const setCookie = res.headers.getSetCookie?.();
    expect(setCookie).toBeDefined();

    const userCookie = setCookie?.find((h: string) =>
      h.startsWith("myra_user=")
    );
    expect(userCookie).toBeDefined();
    expect(userCookie).toContain("myra_user=;");
    expect(userCookie).toContain("Max-Age=0");
  });
});
