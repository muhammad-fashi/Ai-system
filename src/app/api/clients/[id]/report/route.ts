import { prisma } from "@/lib/prisma";
import { apiAuth, json, error } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Full client calling report: profile, aggregate stats, latest + all calls. */
export async function GET(_req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      calls: { orderBy: { createdAt: "desc" } },
      followUps: { orderBy: { scheduledAt: "desc" } },
    },
  });
  if (!client) return error("Client not found", 404);

  const calls = client.calls;
  const successful = calls.filter((c) => c.status === "COMPLETED").length;
  const failed = calls.filter((c) =>
    ["FAILED", "NO_ANSWER", "BUSY"].includes(c.status)
  ).length;
  const totalDuration = calls.reduce((s, c) => s + (c.duration || 0), 0);
  const latestCall = calls[0] || null;

  return json({
    client,
    stats: {
      totalCalls: calls.length,
      successful,
      failed,
      totalDuration,
      lastCallAt: client.lastCallAt,
    },
    latestCall,
    calls,
    followUps: client.followUps,
  });
}
