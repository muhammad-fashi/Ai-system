import { prisma } from "@/lib/prisma";
import { apiAuth, json } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Live active calls + recent completions for the Active Calls page (polled). */
export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const [active, recent] = await Promise.all([
    prisma.call.findMany({
      where: { status: { in: ["INITIATED", "RINGING", "CONNECTED"] } },
      orderBy: { startTime: "desc" },
      include: { client: true, campaign: { select: { name: true } } },
      take: 50,
    }),
    prisma.call.findMany({
      where: { status: { in: ["COMPLETED", "FAILED", "NO_ANSWER", "BUSY", "VOICEMAIL"] } },
      orderBy: { updatedAt: "desc" },
      include: { client: true },
      take: 15,
    }),
  ]);

  return json({ active, recent });
}
