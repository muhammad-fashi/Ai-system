import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/session";

// Routes that never require auth.
const PUBLIC_PATHS = ["/login", "/setup"];
// API paths that manage their own auth (webhooks, cron, auth endpoints).
const PUBLIC_API_PREFIXES = ["/api/auth", "/api/webhooks", "/api/cron"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public API endpoints (they verify their own signatures / secrets).
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await verifySessionToken(token) : null;

  const isPublicPage = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  // API routes: return 401 JSON instead of redirecting.
  if (pathname.startsWith("/api")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (!session && !isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (session && isPublicPage) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except static assets and Next internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
