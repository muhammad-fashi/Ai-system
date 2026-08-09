import { prisma } from "@/lib/prisma";
import { apiAuth, json, error } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const campaign = await prisma.campaign.findUnique({
    where: { id },
    include: {
      campaignClients: { include: { client: true }, orderBy: { position: "asc" } },
    },
  });
  if (!campaign) return error("Campaign not found", 404);

  // Aggregate stats.
  const calls = await prisma.call.findMany({ where: { campaignId: id } });
  const stats = {
    totalLeads: campaign.campaignClients.length,
    attempted: campaign.campaignClients.filter((c) => c.attempts > 0).length,
    connected: calls.filter((c) => c.status === "COMPLETED").length,
    completed: calls.filter((c) => c.status === "COMPLETED").length,
    noAnswer: calls.filter((c) => c.status === "NO_ANSWER").length,
    interested: calls.filter((c) => c.outcome === "INTERESTED" || c.interestLevel === "HOT").length,
    notInterested: calls.filter((c) => c.outcome === "NOT_INTERESTED").length,
    followUps: calls.filter((c) => c.outcome === "FOLLOW_UP_REQUIRED").length,
    meetings: calls.filter((c) => c.outcome === "MEETING_REQUESTED").length,
  };
  const conversionRate =
    stats.attempted > 0 ? Math.round((stats.interested / stats.attempted) * 100) : 0;

  return json({ campaign, stats: { ...stats, conversionRate } });
}

export async function PUT(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const allowed = [
    "name", "description", "agentId", "fromNumber", "maxConcurrency",
    "retryLimit", "retryDelayMin", "delayBetweenSec", "callingHoursStart",
    "callingHoursEnd", "callingDays", "timezone",
  ];
  const data: any = {};
  for (const k of allowed) if (k in body) data[k] = body[k];

  const campaign = await prisma.campaign.update({ where: { id }, data });
  return json({ campaign });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.campaign.delete({ where: { id } });
  return json({ ok: true });
}
