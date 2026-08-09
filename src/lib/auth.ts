import "server-only";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { prisma } from "./prisma";
import {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
  type SessionPayload,
} from "./session";

export type { SessionPayload };
export {
  createSessionToken,
  verifySessionToken,
  SESSION_COOKIE_NAME,
};

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function setSessionCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

/** Read + verify the current session from cookies (server components / routes). */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload | null> {
  return getSession();
}

export async function userCount(): Promise<number> {
  return prisma.user.count();
}

/**
 * Auto-provision the first admin from env vars, but ONLY when the database has
 * no users yet. Credentials are never stored in code — they come from
 * DEFAULT_ADMIN_EMAIL / DEFAULT_ADMIN_PASSWORD (set in Vercel env). This lets
 * you sign in immediately after deploy without the setup screen.
 * Returns the created admin's email, or null if nothing was created.
 */
export async function ensureBootstrapAdmin(): Promise<string | null> {
  const email = process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!email || !password) return null;

  const count = await prisma.user.count();
  if (count > 0) return null;

  const passwordHash = await hashPassword(password);
  await prisma.user.create({
    data: {
      email,
      name: process.env.DEFAULT_ADMIN_NAME?.trim() || "Admin",
      passwordHash,
      role: "ADMIN",
    },
  });
  return email;
}
