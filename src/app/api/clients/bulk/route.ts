import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Bulk operations on clients.
 * body: { action: "status"|"delete"|"doNotCall", ids: string[], status?, doNotCall? }
 */
export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const ids: string[] = body?.ids || [];
  const action: string = body?.action;
  if (!Array.isArray(ids) || ids.length === 0) return error("No clients selected", 400);

  if (action === "delete") {
    const res = await prisma.client.deleteMany({ where: { id: { in: ids } } });
    await logAudit({ userId: (auth as any).userId, action: "client.bulk_delete", metadata: { count: res.count }, ip: getClientIp(req) });
    return json({ ok: true, count: res.count });
  }

  if (action === "status") {
    const status = body?.status;
    if (!status) return error("Status required", 400);
    const res = await prisma.client.updateMany({
      where: { id: { in: ids } },
      data: { status },
    });
    await logAudit({ userId: (auth as any).userId, action: "client.bulk_status", metadata: { status, count: res.count }, ip: getClientIp(req) });
    return json({ ok: true, count: res.count });
  }

  if (action === "doNotCall") {
    const clients = await prisma.client.findMany({ where: { id: { in: ids } } });
    for (const c of clients) {
      await prisma.doNotCall.upsert({
        where: { phone: c.phone },
        create: { phone: c.phone, clientId: c.id, reason: "Bulk admin action" },
        update: {},
      });
    }
    await prisma.client.updateMany({
      where: { id: { in: ids } },
      data: { doNotCall: true, status: "DO_NOT_CALL" },
    });
    await logAudit({ userId: (auth as any).userId, action: "client.bulk_dnc", metadata: { count: clients.length }, ip: getClientIp(req) });
    return json({ ok: true, count: clients.length });
  }

  return error("Unknown action", 400);
}
