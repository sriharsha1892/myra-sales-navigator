import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.MAGIC_LINK_SECRET || "dev-fallback-secret-not-for-production"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for login page, API routes, and static files
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get("myra_session")?.value;
  // Also accept legacy cookie during migration
  const legacyCookie = request.cookies.get("myra_user")?.value;

  if (!sessionToken && !legacyCookie) {
    // Set return-to cookie so user lands back here after login
    const response = NextResponse.redirect(new URL("/login", request.url));
    if (pathname !== "/") {
      response.cookies.set("myra_return_to", pathname, {
        path: "/",
        maxAge: 1800, // 30 min
        sameSite: "lax",
      });
    }
    return response;
  }

  // Verify session JWT if present
  if (sessionToken) {
    try {
      const { payload } = await jwtVerify(sessionToken, secret);

      // Admin gate: only admins can access /admin
      if (pathname === "/admin" || pathname.startsWith("/admin/")) {
        if (!payload.isAdmin) {
          return NextResponse.redirect(new URL("/", request.url));
        }
      }

      return NextResponse.next();
    } catch {
      // Token expired or invalid — redirect to login with return-to
      const response = NextResponse.redirect(new URL("/login", request.url));
      response.cookies.set("myra_session", "", { path: "/", maxAge: 0 });
      if (pathname !== "/") {
        response.cookies.set("myra_return_to", pathname, {
          path: "/",
          maxAge: 1800,
          sameSite: "lax",
        });
      }
      return response;
    }
  }

  // Legacy cookie fallback (will be migrated on next callback visit)
  if (legacyCookie) {
    const userName = decodeURIComponent(legacyCookie);
    // Basic admin check for legacy users
    const seedAdmins = ["Adi", "JVS", "Reddy", "Sai"];
    if (
      (pathname === "/admin" || pathname.startsWith("/admin/")) &&
      !seedAdmins.includes(userName)
    ) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
