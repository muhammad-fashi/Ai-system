import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { placeCall } from "@/lib/queue";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

/** Place an immediate one-off call to a single client. */
export async function POST(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) return error("Client not found", 404);
  if (client.doNotCall) return error("Client is on the Do Not Call list", 400);

  const dnc = await prisma.doNotCall.findUnique({ where: { phone: client.phone } });
  if (dnc) return error("Phone number is on the Do Not Call list", 400);

  const active = await prisma.call.count({
    where: { clientId: id, status: { in: ["INITIATED", "RINGING", "CONNECTED"] } },
  });
  if (active > 0) return error("A call to this client is already active", 409);

  try {
    const result = await placeCall({ clientId: id });
    await logAudit({
      userId: (auth as any).userId,
      action: "call.manual",
      target: id,
      ip: getClientIp(req),
    });
    return json({ ok: true, ...result });
  } catch (e) {
    return error(`Failed to place call: ${(e as Error).message}`, 500);
  }
}
