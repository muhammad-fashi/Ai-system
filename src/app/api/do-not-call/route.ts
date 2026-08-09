import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { normalizePhone, isValidPhone } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const entries = await prisma.doNotCall.findMany({
    orderBy: { createdAt: "desc" },
    include: { client: { select: { id: true, firstName: true, lastName: true, companyName: true } } },
  });
  return json({ entries });
}

/** Add a phone number to the Do Not Call list. body: { phone, reason } */
export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone || "");
  if (!isValidPhone(phone)) return error("Valid phone number required", 400);

  const client = await prisma.client.findFirst({ where: { phone } });
  const entry = await prisma.doNotCall.upsert({
    where: { phone },
    create: { phone, clientId: client?.id || null, reason: body?.reason || "Manual entry" },
    update: { reason: body?.reason || "Manual entry" },
  });
  if (client) {
    await prisma.client.update({
      where: { id: client.id },
      data: { doNotCall: true, status: "DO_NOT_CALL" },
    });
  }
  await logAudit({ userId: (auth as any).userId, action: "dnc.added", target: phone, ip: getClientIp(req) });
  return json({ entry }, 201);
}

/** Remove a number from the Do Not Call list. body: { phone } */
export async function DELETE(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  const phone = normalizePhone(body?.phone || "");
  if (!phone) return error("Phone required", 400);
  await prisma.doNotCall.deleteMany({ where: { phone } });
  const client = await prisma.client.findFirst({ where: { phone } });
  if (client) {
    await prisma.client.update({ where: { id: client.id }, data: { doNotCall: false } });
  }
  await logAudit({ userId: (auth as any).userId, action: "dnc.removed", target: phone, ip: getClientIp(req) });
  return json({ ok: true });
}
