import { NextResponse } from "next/server";
import { getSession, type SessionPayload } from "./auth";

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Guard for API route handlers. Returns the session, or a 401 NextResponse.
 * Usage:
 *   const auth = await apiAuth();
 *   if (auth instanceof NextResponse) return auth;
 */
export async function apiAuth(): Promise<SessionPayload | NextResponse> {
  const session = await getSession();
  if (!session) return error("Unauthorized", 401);
  return session;
}

export function getClientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip");
}

export function parsePagination(url: URL) {
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10) || 20)
  );
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
