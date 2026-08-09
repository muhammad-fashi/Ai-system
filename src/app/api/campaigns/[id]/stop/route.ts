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

  await prisma.campaign.update({ where: { id }, data: { status: "STOPPED" } });
  // Stop scheduling additional calls; leave completed records intact.
  await prisma.campaignClient.updateMany({
    where: { campaignId: id, status: { in: ["QUEUED", "RETRY_SCHEDULED"] } },
    data: { status: "SKIPPED" },
  });
  await logAudit({ userId: (auth as any).userId, action: "campaign.stopped", target: id, ip: getClientIp(req) });
  return json({ ok: true, status: "STOPPED" });
}
