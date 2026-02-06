import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(
  process.env.MAGIC_LINK_SECRET || "dev-fallback-secret-not-for-production"
);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // GTM-only mode: detect by hostname or env var
  const host = request.headers.get("host") ?? "";
  const isGtmApp = host.startsWith("myragtm") || process.env.APP_MODE === "gtm";

  if (isGtmApp) {
    if (
      pathname.startsWith("/_next/") ||
      pathname.startsWith("/favicon") ||
      pathname.startsWith("/gtmcatchup") ||
      pathname.startsWith("/gtm-dashboard") ||
      pathname.startsWith("/gtm-admin") ||
      pathname.startsWith("/api/gtm/") ||
      pathname.startsWith("/api/gtm-dashboard/")
    ) {
      return NextResponse.next();
    }
    // Redirect everything else to /gtmcatchup
    return NextResponse.redirect(new URL("/gtmcatchup", request.url));
  }

  // Skip auth check for login page, static files, Sentry tunnel, and GTM pages (GTM has its own pin auth)
  if (
    pathname === "/login" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/monitoring") ||
    pathname.startsWith("/gtmcatchup") ||
    pathname.startsWith("/gtm-dashboard") ||
    pathname.startsWith("/gtm-admin")
  ) {
    return NextResponse.next();
  }

  // Skip auth for auth routes and GTM routes (GTM has its own auth)
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/gtm/") ||
    pathname.startsWith("/api/gtm-dashboard/")
  ) {
    return NextResponse.next();
  }

  // Navigator API routes: require myra_session or myra_user cookie
  if (pathname.startsWith("/api/")) {
    const sessionToken = request.cookies.get("myra_session")?.value;
    const legacyCookie = request.cookies.get("myra_user")?.value;
    if (!sessionToken && !legacyCookie) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
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
