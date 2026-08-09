import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { campaignCreateSchema } from "@/lib/validation";
import { enqueueClients } from "@/lib/queue";
import { getSetting } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const campaigns = await prisma.campaign.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { campaignClients: true, calls: true } } },
  });
  return json({ campaigns });
}

export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = campaignCreateSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "Invalid input", 400);
  }
  const d = parsed.data;
  const calling = await getSetting("calling");
  const retell = await getSetting("retell");

  const campaign = await prisma.campaign.create({
    data: {
      name: d.name,
      description: d.description || null,
      agentId: d.agentId || retell.agentId || process.env.RETELL_AGENT_ID || null,
      fromNumber: d.fromNumber || retell.fromNumber || process.env.RETELL_FROM_NUMBER || null,
      maxConcurrency: d.maxConcurrency ?? calling.maxConcurrency,
      retryLimit: d.retryLimit ?? calling.retryAttempts,
      retryDelayMin: d.retryDelayMin ?? calling.retryDelayMin,
      delayBetweenSec: d.delayBetweenSec ?? calling.delayBetweenSec,
      callingHoursStart: d.callingHoursStart ?? calling.callingHoursStart,
      callingHoursEnd: d.callingHoursEnd ?? calling.callingHoursEnd,
      callingDays: d.callingDays ?? calling.callingDays,
      timezone: d.timezone ?? calling.timezone,
      status: "DRAFT",
    },
  });

  if (d.clientIds && d.clientIds.length) {
    await enqueueClients(campaign.id, d.clientIds);
  }

  await logAudit({
    userId: (auth as any).userId,
    action: "campaign.created",
    target: campaign.id,
    metadata: { clients: d.clientIds?.length || 0 },
    ip: getClientIp(req),
  });

  return json({ campaign }, 201);
}
