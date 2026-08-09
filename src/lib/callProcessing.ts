import { prisma } from "./prisma";
import { analyzeCall, outcomeToClientStatus } from "./analysis";
import { getSetting } from "./settings";
import { notify } from "./audit";
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
