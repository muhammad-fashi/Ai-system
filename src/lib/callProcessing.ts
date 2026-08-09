import { prisma } from "./prisma";
import { analyzeCall, outcomeToClientStatus } from "./analysis";
import { getSetting } from "./settings";
import { notify } from "./audit";
import { getCall, isMockMode } from "./retell";
import type { Prisma } from "@prisma/client";

interface TranscriptTurn {
  role: string;
  content: string;
  ts?: number;
}

interface FinalizeInput {
  callId: string;
  status?: string; // Retell call_status
  disconnectionReason?: string | null;
  duration?: number | null;
  startTime?: Date | null;
  endTime?: Date | null;
  recordingUrl?: string | null;
  transcriptTurns?: TranscriptTurn[] | null;
  transcriptText?: string | null;
  retellAnalysis?: any;
}

function mapCallStatus(
  status: string | undefined,
  disconnect: string | null | undefined
): string {
  const d = (disconnect || "").toLowerCase();
  if (d.includes("voicemail")) return "VOICEMAIL";
  if (d.includes("no_answer") || d.includes("no-answer")) return "NO_ANSWER";
  if (d.includes("busy")) return "BUSY";
  if (d.includes("dial_failed") || d.includes("error")) return "FAILED";
  const s = (status || "").toLowerCase();
  if (s === "ended" || s === "completed") return "COMPLETED";
  if (s === "ongoing" || s === "in_progress") return "CONNECTED";
  if (s === "registered") return "INITIATED";
  return "COMPLETED";
}

function queueStatusFromCall(callStatus: string): string {
  switch (callStatus) {
    case "COMPLETED":
      return "COMPLETED";
    case "NO_ANSWER":
      return "NO_ANSWER";
    case "BUSY":
      return "BUSY";
    case "VOICEMAIL":
      return "VOICEMAIL";
    case "FAILED":
      return "FAILED";
    default:
      return "COMPLETED";
  }
}

/**
 * Finalize a completed call: persist transcript/recording, run analysis, and
 * cascade updates to the client, campaign queue, follow-ups and DNC list.
 * Idempotent — safe to call multiple times for the same call.
 */
export async function finalizeCall(input: FinalizeInput): Promise<void> {
  const call = await prisma.call.findUnique({ where: { id: input.callId } });
  if (!call) return;

  const callStatus = mapCallStatus(input.status, input.disconnectionReason);

  const transcriptText =
    input.transcriptText ??
    (input.transcriptTurns
      ? input.transcriptTurns.map((t) => `${t.role}: ${t.content}`).join("\n")
      : call.transcriptText) ??
    "";

  const analysis = analyzeCall({
    transcriptText,
    retellAnalysis: input.retellAnalysis,
    callStatus,
    disconnectionReason: input.disconnectionReason,
  });

  const callData: Prisma.CallUpdateInput = {
    status: callStatus as any,
    outcome: analysis.outcome as any,
    duration: input.duration ?? call.duration,
    startTime: input.startTime ?? call.startTime,
    endTime: input.endTime ?? new Date(),
    recordingUrl: input.recordingUrl ?? call.recordingUrl,
    transcript: (input.transcriptTurns as any) ?? call.transcript ?? undefined,
    transcriptText: transcriptText || call.transcriptText,
    summary: analysis.summary,
    sentiment: analysis.sentiment,
    interestLevel: analysis.interestLevel as any,
    leadScore: analysis.leadScore,
    leadScoreReason: analysis.leadScoreReason,
    servicesDiscussed: analysis.servicesDiscussed,
    nextAction: analysis.nextAction,
    disconnectionReason: input.disconnectionReason ?? call.disconnectionReason,
  };

  await prisma.call.update({ where: { id: call.id }, data: callData });

  // Update the client record.
  const connected = callStatus === "COMPLETED";
  const clientStatus = outcomeToClientStatus(analysis.outcome as any);

  const clientUpdate: Prisma.ClientUpdateInput = {
    lastCallAt: new Date(),
  };
  if (connected) {
    clientUpdate.status = clientStatus as any;
    clientUpdate.interestLevel = analysis.interestLevel as any;
    clientUpdate.leadScore = analysis.leadScore;
  }
  if (analysis.doNotCall) {
    clientUpdate.doNotCall = true;
    clientUpdate.status = "DO_NOT_CALL" as any;
  }

  await prisma.client.update({
    where: { id: call.clientId },
    data: clientUpdate,
  });

  // Do Not Call list.
  if (analysis.doNotCall) {
    const client = await prisma.client.findUnique({
      where: { id: call.clientId },
    });
    if (client) {
      await prisma.doNotCall.upsert({
        where: { phone: client.phone },
        create: {
          phone: client.phone,
          clientId: client.id,
          reason: "Requested during call",
        },
        update: { reason: "Requested during call" },
      });
    }
  }

  // Campaign queue row.
  if (call.campaignId) {
    await prisma.campaignClient.updateMany({
      where: { campaignId: call.campaignId, clientId: call.clientId },
      data: { status: queueStatusFromCall(callStatus) as any },
    });
  }

  // Auto-create follow-up when required.
  if (analysis.followUpRequired || analysis.outcome === "MEETING_REQUESTED") {
    const existing = await prisma.followUp.findFirst({
      where: { clientId: call.clientId, status: "PENDING" },
    });
    if (!existing) {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + 2);
      scheduledAt.setHours(10, 0, 0, 0);
      await prisma.followUp.create({
        data: {
          clientId: call.clientId,
          callId: call.id,
          scheduledAt,
          reason: analysis.nextAction,
          status: "PENDING",
        },
      });
      await prisma.client.update({
        where: { id: call.clientId },
        data: { nextFollowUp: scheduledAt },
      });
    }
  }

  // Notifications for noteworthy outcomes.
  const notifSettings = await getSetting("notifications");
  if (notifSettings.interestedLead && analysis.interestLevel === "HOT") {
    await notify({
      type: "hot_lead",
      title: "🔥 Hot lead detected",
      message: `A call scored ${analysis.leadScore}/100. ${analysis.summary}`,
      metadata: { callId: call.id, clientId: call.clientId },
    });
  }
  if (analysis.outcome === "MEETING_REQUESTED") {
    await notify({
      type: "meeting",
      title: "📅 Meeting requested",
      message: analysis.summary,
      metadata: { callId: call.id, clientId: call.clientId },
    });
  }
  if (analysis.outcome === "DO_NOT_CALL") {
    await notify({
      type: "do_not_call",
      title: "🚫 Do Not Call request",
      message: "A client asked not to be contacted again.",
      metadata: { callId: call.id, clientId: call.clientId },
    });
  }
}

/** Build a plausible mock transcript for MOCK mode so the flow is demoable. */
export function buildMockTranscript(client: {
  firstName: string;
  companyName?: string | null;
  website?: string | null;
}): { turns: TranscriptTurn[]; text: string; outcomeHint: string } {
  const scenarios = [
    {
      hint: "interested",
      turns: [
        ["agent", "Hi, this is Sarah from Your Agency. Is this a good time for a quick chat?"],
        ["user", "Sure, what's this about?"],
        ["agent", "We help businesses improve their websites and get found on Google. Do you currently have a website?"],
        ["user", "Yes but it's pretty outdated and we're not getting many leads."],
        ["agent", "I understand. We could help with a redesign and SEO to improve visibility. Would you be open to a short consultation?"],
        ["user", "Yeah, that sounds good. How much does it cost?"],
        ["agent", "It depends on scope — I can have our team put together a quote. Can we schedule a call next week?"],
        ["user", "Yes, let's schedule a meeting. Send me the details by email."],
        ["agent", "Perfect, thank you! We'll be in touch."],
      ],
    },
    {
      hint: "not_interested",
      turns: [
        ["agent", "Hi, this is Sarah from Your Agency. Is now a good time?"],
        ["user", "Not really, we're not interested in marketing right now."],
        ["agent", "No problem at all, I understand. Thanks for your time and have a great day."],
      ],
    },
    {
      hint: "follow_up",
      turns: [
        ["agent", "Hi, this is Sarah from Your Agency calling about your online presence."],
        ["user", "I'm a bit busy, can you send me some information by email?"],
        ["agent", "Absolutely, what's the best email? I'll send details and follow up next week."],
        ["user", "Great, call me back next Tuesday."],
        ["agent", "Will do. Thank you!"],
      ],
    },
    {
      hint: "do_not_call",
      turns: [
        ["agent", "Hi, this is Sarah from Your Agency."],
        ["user", "Please don't call me again, remove me from your list."],
        ["agent", "Understood, I'll remove you right away. Apologies for the interruption."],
      ],
    },
  ];
  const pick = scenarios[Math.floor(Math.random() * scenarios.length)];
  const turns: TranscriptTurn[] = pick.turns.map(([role, content], i) => ({
    role,
    content: content.replace(/\bJohn\b/, client.firstName),
    ts: i * 8,
  }));
  const text = turns.map((t) => `${t.role}: ${t.content}`).join("\n");
  return { turns, text, outcomeHint: pick.hint };
}

/**
 * Pull the latest state of a single call directly from Retell and, if the call
 * has ended, finalize it (transcript, recording, analysis). This is the
 * fallback for when the webhook doesn't arrive (misconfigured URL, app not
 * reachable, missed event). Safe to call repeatedly — finalizeCall is
 * idempotent.
 *
 * Returns { updated, status } where updated=true means the call was finalized.
 */
export async function syncCallFromRetell(
  callId: string
): Promise<{ updated: boolean; status?: string; note?: string }> {
  if (isMockMode()) return { updated: false, note: "mock-mode" };

  const call = await prisma.call.findUnique({ where: { id: callId } });
  if (!call) return { updated: false, note: "call-not-found" };
  if (!call.retellCallId) return { updated: false, note: "no-retell-id" };

  const rc: any = await getCall(call.retellCallId);
  if (!rc) return { updated: false, note: "retell-fetch-failed" };

  const status: string = rc.call_status || rc.status || "";
  const ended =
    status === "ended" ||
    status === "error" ||
    Boolean(rc.end_timestamp) ||
    Boolean(rc.disconnection_reason);

  // Still ringing/ongoing — just reflect the live status.
  if (!ended) {
    if (status === "ongoing" && call.status !== "CONNECTED") {
      await prisma.call.update({
        where: { id: call.id },
        data: {
          status: "CONNECTED",
          startTime: rc.start_timestamp ? new Date(rc.start_timestamp) : call.startTime,
        },
      });
    }
    return { updated: false, status };
  }

  const transcriptTurns = (rc.transcript_object || []).map((t: any) => ({
    role: t.role === "agent" ? "agent" : "user",
    content: t.content || "",
    ts: t.words?.[0]?.start ?? undefined,
  }));

  const duration =
    rc.start_timestamp && rc.end_timestamp
      ? Math.round((rc.end_timestamp - rc.start_timestamp) / 1000)
      : rc.duration_ms
      ? Math.round(rc.duration_ms / 1000)
      : call.duration ?? null;

  await finalizeCall({
    callId: call.id,
    status: status || "ended",
    disconnectionReason: rc.disconnection_reason || null,
    duration,
    startTime: rc.start_timestamp ? new Date(rc.start_timestamp) : call.startTime,
    endTime: rc.end_timestamp ? new Date(rc.end_timestamp) : new Date(),
    recordingUrl: rc.recording_url || null,
    transcriptTurns: transcriptTurns.length ? transcriptTurns : null,
    transcriptText: rc.transcript || null,
    retellAnalysis: rc.call_analysis || null,
  });

  return { updated: true, status: "ended" };
}

/**
 * Reconcile all calls still marked active by fetching their state from Retell.
 * Runs on every cron tick so the CMS stays up to date even if webhooks fail.
 * Only touches calls started more than a few seconds ago to avoid racing the
 * dial itself.
 */
export async function reconcileActiveCalls(): Promise<number> {
  if (isMockMode()) return 0;

  const stale = await prisma.call.findMany({
    where: {
      status: { in: ["INITIATED", "RINGING", "CONNECTED"] as any },
      retellCallId: { not: null },
      startTime: { lt: new Date(Date.now() - 15_000) },
    },
    orderBy: { startTime: "asc" },
    take: 50,
  });

  let updated = 0;
  for (const c of stale) {
    try {
      const r = await syncCallFromRetell(c.id);
      if (r.updated) updated++;
    } catch {
      // ignore individual failures; will retry next tick
    }
  }
  return updated;
}
