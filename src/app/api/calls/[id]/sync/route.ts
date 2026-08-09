import { apiAuth, json, error } from "@/lib/api";
import { syncCallFromRetell } from "@/lib/callProcessing";
import { isMockMode } from "@/lib/retell";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Pull the latest state of this call from Retell and finalize if ended. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  if (isMockMode()) {
    return error("Retell is in MOCK mode — nothing to sync (calls are simulated).", 400);
  }

  try {
    const result = await syncCallFromRetell(id);
    return json({ ok: true, ...result });
  } catch (e) {
    return error(`Sync failed: ${(e as Error).message}`, 500);
  }
}
