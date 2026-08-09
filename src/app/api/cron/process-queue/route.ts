import { processQueue } from "@/lib/queue";
import { isAuthorizedCron } from "@/lib/cron";
import { getSession } from "@/lib/auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function run(req: Request) {
  // Allow either the Vercel Cron secret or an authenticated admin session.
  const session = await getSession();
  if (!isAuthorizedCron(req) && !session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await processQueue();
    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  return run(req);
}
export async function POST(req: Request) {
  return run(req);
}
