import { prisma } from "@/lib/prisma";
import {
  hashPassword,
  createSessionToken,
  setSessionCookie,
  userCount,
} from "@/lib/auth";
import { registerSchema } from "@/lib/validation";
import { json, error, getClientIp } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

/**
 * Bootstrap registration. Only allowed when NO users exist yet — this creates
 * the first admin. Subsequent users must be created by an admin (future work).
 */
export async function POST(req: Request) {
  const existing = await userCount();
  if (existing > 0) {
    return error("Registration is closed. An admin account already exists.", 403);
  }

  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "Invalid input", 400);
  }

  const { name, email, password } = parsed.data;
  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: { name, email, passwordHash, role: "ADMIN" },
  });

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  await setSessionCookie(token);

  await logAudit({
    userId: user.id,
    action: "auth.register",
    ip: getClientIp(req),
  });

  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}

// Whether setup (first-run) is required.
export async function GET() {
  const count = await userCount();
  return json({ setupRequired: count === 0 });
}
