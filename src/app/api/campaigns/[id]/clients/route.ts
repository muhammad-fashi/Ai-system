import { apiAuth, json, error } from "@/lib/api";
import { enqueueClients } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Add clients to a campaign queue. body: { clientIds: string[] } */
export async function POST(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const body = await req.json().catch(() => null);
  const clientIds: string[] = body?.clientIds || [];
  if (!clientIds.length) return error("No clients provided", 400);

  const campaign = await prisma.campaign.findUnique({ where: { id } });
  if (!campaign) return error("Campaign not found", 404);

  const count = await enqueueClients(id, clientIds);
  return json({ ok: true, added: count });
}

/** Remove a client from the campaign queue. body: { clientId } */
export async function DELETE(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const clientId = body?.clientId;
  if (!clientId) return error("clientId required", 400);
  await prisma.campaignClient.deleteMany({ where: { campaignId: id, clientId } });
  return json({ ok: true });
}
