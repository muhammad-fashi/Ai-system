import { prisma } from "@/lib/prisma";
import { isAuthorizedCron } from "@/lib/cron";
import { getSession } from "@/lib/auth";
import { placeCall } from "@/lib/queue";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Process due follow-ups. For follow-ups flagged autoCall, place the call now
 * (respecting DNC). Others are surfaced in the Follow-ups page for a human.
 */
async function run(req: Request) {
  const session = await getSession();
  if (!isAuthorizedCron(req) && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const due = await prisma.followUp.findMany({
    where: { status: "PENDING", autoCall: true, scheduledAt: { lte: new Date() } },
    include: { client: true },
    take: 25,
  });

  let called = 0;
  for (const f of due) {
    if (f.client.doNotCall) {
      await prisma.followUp.update({ where: { id: f.id }, data: { status: "CANCELLED" } });
      continue;
    }
    try {
      await placeCall({ clientId: f.clientId });
      await prisma.followUp.update({ where: { id: f.id }, data: { status: "COMPLETED" } });
      called++;
    } catch {
      // leave pending; will retry next cycle
    }
  }

  return NextResponse.json({ ok: true, dueCount: due.length, called });
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
