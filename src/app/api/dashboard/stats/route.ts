import { prisma } from "@/lib/prisma";
import { apiAuth, json } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function rangeFromParam(range: string, fromStr?: string | null, toStr?: string | null) {
  const now = new Date();
  let from = new Date();
  let to = now;
  switch (range) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "7d":
      from = new Date(now.getTime() - 7 * 864e5);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 864e5);
      break;
    case "custom":
      if (fromStr) from = new Date(fromStr);
      if (toStr) to = new Date(toStr);
      break;
    default:
      from = new Date(now.getTime() - 30 * 864e5);
  }
  return { from, to };
}

export async function GET(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const range = url.searchParams.get("range") || "30d";
  const { from, to } = rangeFromParam(
    range,
    url.searchParams.get("from"),
    url.searchParams.get("to")
  );

  const dateFilter = { createdAt: { gte: from, lte: to } };

  const [
    totalClients,
    totalCalls,
    successfulCalls,
    failedCalls,
    interestedLeads,
    followUps,
    meetings,
    contactedInRange,
    callsInRange,
  ] = await Promise.all([
    prisma.client.count(),
    prisma.call.count({ where: dateFilter }),
    prisma.call.count({ where: { ...dateFilter, status: "COMPLETED" } }),
    prisma.call.count({ where: { ...dateFilter, status: { in: ["FAILED", "NO_ANSWER", "BUSY"] } } }),
    prisma.client.count({ where: { interestLevel: { in: ["HOT", "WARM"] } } }),
    prisma.followUp.count({ where: { status: "PENDING" } }),
    prisma.client.count({ where: { status: "MEETING_BOOKED" } }),
    prisma.call.count({ where: { ...dateFilter, status: "COMPLETED" } }),
    prisma.call.findMany({
      where: dateFilter,
      select: { createdAt: true, status: true, outcome: true, interestLevel: true },
    }),
  ]);

  const conversionRate =
    contactedInRange > 0
      ? Math.round(
          (callsInRange.filter((c) => c.outcome === "INTERESTED" || c.interestLevel === "HOT").length /
            contactedInRange) *
            100
        )
      : 0;

  // Build daily chart buckets.
  const days: Record<string, { date: string; calls: number; successful: number; failed: number; interested: number; followups: number }> = {};
  const dayCount = Math.max(1, Math.min(60, Math.ceil((to.getTime() - from.getTime()) / 864e5) + 1));
  for (let i = 0; i < dayCount; i++) {
    const d = new Date(from.getTime() + i * 864e5);
    const key = d.toISOString().slice(0, 10);
    days[key] = { date: key, calls: 0, successful: 0, failed: 0, interested: 0, followups: 0 };
  }
  for (const c of callsInRange) {
    const key = c.createdAt.toISOString().slice(0, 10);
    if (!days[key]) continue;
    days[key].calls++;
    if (c.status === "COMPLETED") days[key].successful++;
    if (["FAILED", "NO_ANSWER", "BUSY"].includes(c.status)) days[key].failed++;
    if (c.outcome === "INTERESTED" || c.interestLevel === "HOT") days[key].interested++;
    if (c.outcome === "FOLLOW_UP_REQUIRED") days[key].followups++;
  }

  // Outcome breakdown for a pie/bar.
  const outcomeGroups = await prisma.call.groupBy({
    by: ["outcome"],
    where: dateFilter,
    _count: { outcome: true },
  });

  return json({
    cards: {
      totalClients,
      totalCalls,
      successfulCalls,
      failedCalls,
      interestedLeads,
      followUps,
      meetings,
      conversionRate,
    },
    chart: Object.values(days),
    outcomes: outcomeGroups.map((o) => ({ outcome: o.outcome, count: o._count.outcome })),
    range: { from, to },
  });
}
