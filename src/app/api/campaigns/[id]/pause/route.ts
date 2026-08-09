import { prisma } from "@/lib/prisma";
import { apiAuth, json, getClientIp } from "@/lib/api";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.campaign.update({ where: { id }, data: { status: "PAUSED" } });
  await logAudit({ userId: (auth as any).userId, action: "campaign.paused", target: id, ip: getClientIp(req) });
  return json({ ok: true, status: "PAUSED" });
}
