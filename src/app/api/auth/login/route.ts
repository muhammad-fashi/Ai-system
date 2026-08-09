import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  setSessionCookie,
} from "@/lib/auth";
import { loginSchema } from "@/lib/validation";
import { json, error, getClientIp } from "@/lib/api";
import { logAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) return error("Invalid email or password", 400);

  const { email, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return error("Invalid credentials", 401);

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) return error("Invalid credentials", 401);

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
  });
  await setSessionCookie(token);

  await logAudit({
    userId: user.id,
    action: "auth.login",
    ip: getClientIp(req),
  });

  return json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
  });
}
