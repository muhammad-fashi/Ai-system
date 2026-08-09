import { prisma } from "@/lib/prisma";
import { verifyWebhook } from "@/lib/retell";
import { finalizeCall } from "@/lib/callProcessing";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Webhooks must read the raw body; disable any caching.
export const dynamic = "force-dynamic";

/**
 * Retell webhook receiver. Verifies the signature, stores the event for
 * idempotency, and updates the corresponding Call/Client/Campaign records.
 * Handled events: call_started, call_ended, call_analyzed.
 */
export async function POST(req: Request) {
  const raw = await req.text();
  const signature =
    req.headers.get("x-retell-signature") ||
    req.headers.get("x-retell-signature-256") ||
    req.headers.get("retell-signature");

  const valid = await verifyWebhook(raw, signature);
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: any;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType: string = body.event || body.event_type || "unknown";
  const call = body.call || body.data || {};
  const retellCallId: string | undefined = call.call_id || call.callId;

  // Idempotency: dedupe on (eventType + retellCallId).
  const eventKey = `${eventType}:${retellCallId || "none"}:${
    call.end_timestamp || ""
  }`;
  try {
    await prisma.webhookEvent.create({
      data: {
        eventId: eventKey,
        eventType,
        retellCallId: retellCallId || null,
        payload: body,
      },
    });
  } catch {
    // Duplicate event — already processed.
    return NextResponse.json({ ok: true, duplicate: true });
  }

  if (!retellCallId) {
    return NextResponse.json({ ok: true, note: "no call id" });
  }

  // Locate our call: prefer metadata.call_id, fall back to retellCallId.
  const ourCallId: string | undefined = call.metadata?.call_id;
  let callRecord = ourCallId
    ? await prisma.call.findUnique({ where: { id: ourCallId } })
    : null;
  if (!callRecord) {
    callRecord = await prisma.call.findUnique({
      where: { retellCallId },
    });
  }
  if (!callRecord && ourCallId) {
    callRecord = await prisma.call.findFirst({ where: { id: ourCallId } });
  }
  if (!callRecord) {
    // Unknown call — acknowledge to prevent retries storming us.
    return NextResponse.json({ ok: true, note: "call not found" });
  }

  // Ensure retellCallId is stored.
  if (!callRecord.retellCallId) {
    await prisma.call.update({
      where: { id: callRecord.id },
      data: { retellCallId },
    });
  }

  if (eventType === "call_started") {
    await prisma.call.update({
      where: { id: callRecord.id },
      data: {
        status: "CONNECTED",
        startTime: call.start_timestamp ? new Date(call.start_timestamp) : new Date(),
      },
    });
    await prisma.campaignClient.updateMany({
      where: { clientId: callRecord.clientId, campaignId: callRecord.campaignId ?? undefined },
      data: { status: "CONNECTED" },
    });
    return NextResponse.json({ ok: true });
  }

  if (eventType === "call_ended" || eventType === "call_analyzed") {
    const transcriptTurns = (call.transcript_object || []).map((t: any) => ({
      role: t.role === "agent" ? "agent" : "user",
      content: t.content || "",
      ts: t.words?.[0]?.start ?? undefined,
    }));

    const duration =
      call.start_timestamp && call.end_timestamp
        ? Math.round((call.end_timestamp - call.start_timestamp) / 1000)
        : call.duration_ms
        ? Math.round(call.duration_ms / 1000)
        : null;

    await finalizeCall({
      callId: callRecord.id,
      status: call.call_status || "ended",
      disconnectionReason: call.disconnection_reason || null,
      duration,
      startTime: call.start_timestamp ? new Date(call.start_timestamp) : null,
      endTime: call.end_timestamp ? new Date(call.end_timestamp) : new Date(),
      recordingUrl: call.recording_url || null,
      transcriptTurns: transcriptTurns.length ? transcriptTurns : null,
      transcriptText: call.transcript || null,
      retellAnalysis: call.call_analysis || null,
    });

    await prisma.webhookEvent.updateMany({
      where: { eventId: eventKey },
      data: { processed: true },
    });

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true, note: `unhandled event ${eventType}` });
}
