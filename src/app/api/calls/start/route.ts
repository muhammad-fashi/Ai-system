import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { placeCall } from "@/lib/queue";
import { normalizePhone, isValidPhone } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Start a call. Two modes:
 *  - { clientId } : call an existing client now.
 *  - { test: true, name, phone } : place a clearly-labelled TEST call,
 *    creating a temporary test client if needed.
 */
export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body) return error("Invalid request", 400);

  if (body.test) {
    const phone = normalizePhone(body.phone || "");
    if (!isValidPhone(phone)) return error("Valid phone number required", 400);

    // Reuse an existing client with this phone, or create a test client.
    let client = await prisma.client.findFirst({ where: { phone } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          firstName: body.name || "Test",
          phone,
          leadSource: "Test Call",
          status: "NEW",
          notes: "Created from test call",
        },
      });
    }
    try {
      const result = await placeCall({
        clientId: client.id,
        isTest: true,
        overrideName: body.name,
        overridePhone: phone,
      });
      await logAudit({ userId: (auth as any).userId, action: "call.test", target: client.id, ip: getClientIp(req) });
      return json({ ok: true, test: true, clientId: client.id, ...result });
    } catch (e) {
      return error(`Test call failed: ${(e as Error).message}`, 500);
    }
  }

  if (body.clientId) {
    const client = await prisma.client.findUnique({ where: { id: body.clientId } });
    if (!client) return error("Client not found", 404);
    if (client.doNotCall) return error("Client is on Do Not Call list", 400);
    try {
      const result = await placeCall({ clientId: body.clientId });
      return json({ ok: true, ...result });
    } catch (e) {
      return error(`Call failed: ${(e as Error).message}`, 500);
    }
  }

  return error("clientId or test payload required", 400);
}
