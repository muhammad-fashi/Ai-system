import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { clientUpdateSchema } from "@/lib/validation";
import { normalizePhone, isValidPhone } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      calls: { orderBy: { createdAt: "desc" }, take: 20 },
      followUps: { orderBy: { scheduledAt: "desc" }, take: 10 },
    },
  });
  if (!client) return error("Client not found", 404);
  return json({ client });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const parsed = clientUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "Invalid input", 400);
  }

  const data: any = { ...parsed.data };
  if (data.phone) {
    const phone = normalizePhone(data.phone);
    if (!isValidPhone(phone)) return error("Invalid phone number", 400);
    data.phone = phone;
  }
  // normalize empty strings to null for optional fields
  for (const k of Object.keys(data)) {
    if (data[k] === "") data[k] = null;
  }

  const client = await prisma.client.update({ where: { id }, data });

  await logAudit({
    userId: (auth as any).userId,
    action: "client.updated",
    target: id,
    ip: getClientIp(req),
  });

  return json({ client });
}

export async function DELETE(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  await prisma.client.delete({ where: { id } });
  await logAudit({
    userId: (auth as any).userId,
    action: "client.deleted",
    target: id,
    ip: getClientIp(req),
  });
  return json({ ok: true });
}
