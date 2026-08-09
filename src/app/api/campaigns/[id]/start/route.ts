import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { processQueue } from "@/lib/queue";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Params = { params: Promise<{ id: string }> };

export async function POST(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: { _count: { select: { campaignClients: true } } },
  });
  if (!campaign) return error("Campaign not found", 404);
  if (campaign._count.campaignClients === 0) {
    return error("Add clients to the campaign before starting", 400);
  }

  await prisma.campaign.update({ where: { id }, data: { status: "RUNNING" } });
  await logAudit({
    userId: (auth as any).userId,
    action: "campaign.started",
    target: id,
    ip: getClientIp(req),
  });

  // Kick the queue immediately so the first calls go out without waiting for cron.
  let result = null;
  try {
    result = await processQueue();
  } catch (e) {
    result = { error: (e as Error).message };
  }

  return json({ ok: true, status: "RUNNING", processed: result });
}
