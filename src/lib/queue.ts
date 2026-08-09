import { prisma } from "./prisma";
import { getSetting } from "./settings";
import {
  createPhoneCall,
  buildDynamicVariables,
  isMockMode,
} from "./retell";
import { isValidPhone, normalizePhone } from "./utils";
import {
  finalizeCall,
  buildMockTranscript,
  reconcileActiveCalls,
} from "./callProcessing";
import { logAudit } from "./audit";

const ACTIVE_CALL_STATUSES = ["INITIATED", "RINGING", "CONNECTED"];

export function isWithinCallingWindow(campaign: {
  callingHoursStart: number;
  callingHoursEnd: number;
  callingDays: number[];
  timezone: string;
}): boolean {
  // Evaluate against the campaign timezone.
  let now: Date;
  try {
    const s = new Date().toLocaleString("en-US", {
      timeZone: campaign.timezone || "UTC",
    });
    now = new Date(s);
  } catch {
    now = new Date();
  }
  const day = now.getDay(); // 0=Sun..6=Sat
  const hour = now.getHours();
  if (campaign.callingDays.length && !campaign.callingDays.includes(day)) {
    return false;
  }
  return hour >= campaign.callingHoursStart && hour < campaign.callingHoursEnd;
}

interface CallEligibility {
  ok: boolean;
  reason?: string;
}

async function checkClientEligibility(
  client: { id: string; phone: string; doNotCall: boolean },
  maxCallsPerClient: number
): Promise<CallEligibility> {
  if (client.doNotCall) return { ok: false, reason: "Client is on Do Not Call" };
  if (!isValidPhone(client.phone))
    return { ok: false, reason: "Invalid phone number" };

  const dnc = await prisma.doNotCall.findUnique({
    where: { phone: normalizePhone(client.phone) },
  });
  if (dnc) return { ok: false, reason: "Phone on Do Not Call list" };

  // Prevent a second concurrent call to the same client.
  const active = await prisma.call.count({
    where: { clientId: client.id, status: { in: ACTIVE_CALL_STATUSES as any } },
  });
  if (active > 0) return { ok: false, reason: "Call already active" };

  const totalCalls = await prisma.call.count({
    where: { clientId: client.id },
  });
  if (maxCallsPerClient > 0 && totalCalls >= maxCallsPerClient) {
    return { ok: false, reason: "Max calls per client reached" };
  }

  return { ok: true };
}

/**
 * Place a single outbound call for a client. Used by the queue processor, the
 * "Call client" action, and test calls.
 */
export async function placeCall(params: {
  clientId: string;
  campaignId?: string | null;
  isTest?: boolean;
  overridePhone?: string;
  overrideName?: string;
}): Promise<{ callId: string; retellCallId: string; mock: boolean }> {
  const client = await prisma.client.findUnique({
    where: { id: params.clientId },
  });
  if (!client) throw new Error("Client not found");

  const [ai, calling, retellSettings] = await Promise.all([
    getSetting("aiAgent"),
    getSetting("calling"),
    getSetting("retell"),
  ]);

  const campaign = params.campaignId
    ? await prisma.campaign.findUnique({ where: { id: params.campaignId } })
    : null;

  const fromNumber =
    campaign?.fromNumber ||
    retellSettings.fromNumber ||
    process.env.RETELL_FROM_NUMBER ||
    process.env.RETELL_PHONE_NUMBER ||
    "";
  const agentId =
    campaign?.agentId || retellSettings.agentId || process.env.RETELL_AGENT_ID;

  const toNumber = normalizePhone(params.overridePhone || client.phone);

  // Create the call record first (source of truth).
  const call = await prisma.call.create({
    data: {
      clientId: client.id,
      campaignId: params.campaignId ?? null,
      phoneNumber: toNumber,
      fromNumber,
      agentId,
      status: "INITIATED",
      isTest: Boolean(params.isTest),
      startTime: new Date(),
    },
  });

  try {
    const dynamicVariables = buildDynamicVariables(
      { ...client, firstName: params.overrideName || client.firstName },
      ai,
      calling
    );

    const result = await createPhoneCall({
      toNumber,
      fromNumber,
      agentId,
      dynamicVariables,
      metadata: {
        call_id: call.id,
        client_id: client.id,
        campaign_id: params.campaignId ?? null,
        is_test: Boolean(params.isTest),
      },
    });

    await prisma.call.update({
      where: { id: call.id },
      data: { retellCallId: result.call_id, status: "RINGING" },
    });

    // Mark client + queue as calling.
    await prisma.client.update({
      where: { id: client.id },
      data: { status: "CALLING", callCount: { increment: 1 } },
    });
    if (params.campaignId) {
      await prisma.campaignClient.updateMany({
        where: { campaignId: params.campaignId, clientId: client.id },
        data: {
          status: "CALLING",
          attempts: { increment: 1 },
          lastAttempt: new Date(),
        },
      });
    }

    await logAudit({
      action: "call.initiated",
      target: client.id,
      metadata: { callId: call.id, retellCallId: result.call_id, mock: result.mock },
    });

    // In MOCK mode there is no webhook, so we simulate the call completing.
    if (result.mock || isMockMode()) {
      await simulateMockCall(call.id, client);
    }

    return {
      callId: call.id,
      retellCallId: result.call_id,
      mock: Boolean(result.mock),
    };
  } catch (e) {
    const message = (e as Error).message;
    await prisma.call.update({
      where: { id: call.id },
      data: { status: "FAILED", errorMessage: message, endTime: new Date() },
    });
    if (params.campaignId) {
      await prisma.campaignClient.updateMany({
        where: { campaignId: params.campaignId, clientId: client.id },
        data: { status: "FAILED", attempts: { increment: 1 }, lastAttempt: new Date() },
      });
    }
    await logAudit({
      action: "call.failed",
      target: client.id,
      metadata: { callId: call.id, error: message },
    });
    throw e;
  }
}

async function simulateMockCall(
  callId: string,
  client: { firstName: string; companyName?: string | null; website?: string | null }
) {
  const mock = buildMockTranscript(client);
  const duration = 45 + Math.floor(Math.random() * 120);
  const start = new Date(Date.now() - duration * 1000);
  await finalizeCall({
    callId,
    status: "ended",
    duration,
    startTime: start,
    endTime: new Date(),
    recordingUrl: null,
    transcriptTurns: mock.turns,
    transcriptText: mock.text,
    retellAnalysis: null,
  });
}

/**
 * Core queue processor. Invoked by the Vercel Cron endpoint every minute.
 * For each RUNNING campaign it respects concurrency, calling hours, retries,
 * DNC and per-client limits, then dispatches the next eligible calls.
 */
export async function processQueue(): Promise<{
  campaignsProcessed: number;
  callsPlaced: number;
  details: string[];
}> {
  const details: string[] = [];
  let callsPlaced = 0;

  // First, pull results for any finished calls straight from Retell so the CMS
  // stays current even if a webhook was missed. Runs regardless of campaigns.
  let reconciled = 0;
  try {
    reconciled = await reconcileActiveCalls();
    if (reconciled > 0) details.push(`Reconciled ${reconciled} finished call(s) from Retell.`);
  } catch (e) {
    details.push(`Reconcile error: ${(e as Error).message}`);
  }

  const calling = await getSetting("calling");
  const runningCampaigns = await prisma.campaign.findMany({
    where: { status: "RUNNING" },
  });

  for (const campaign of runningCampaigns) {
    if (!isWithinCallingWindow(campaign)) {
      details.push(`Campaign ${campaign.name}: outside calling window.`);
      continue;
    }

    const activeCalls = await prisma.call.count({
      where: {
        campaignId: campaign.id,
        status: { in: ACTIVE_CALL_STATUSES as any },
      },
    });
    const slots = campaign.maxConcurrency - activeCalls;
    if (slots <= 0) {
      details.push(`Campaign ${campaign.name}: at concurrency limit.`);
      continue;
    }

    // Fetch next eligible queue rows.
    const candidates = await prisma.campaignClient.findMany({
      where: {
        campaignId: campaign.id,
        OR: [
          { status: "QUEUED" },
          {
            status: "RETRY_SCHEDULED",
            nextAttempt: { lte: new Date() },
          },
        ],
      },
      orderBy: [{ position: "asc" }, { createdAt: "asc" }],
      take: slots * 3, // over-fetch to account for skips
      include: { client: true },
    });

    let placed = 0;
    for (const cc of candidates) {
      if (placed >= slots) break;

      const eligibility = await checkClientEligibility(
        cc.client,
        calling.maxCallsPerClient
      );
      if (!eligibility.ok) {
        const skipStatus =
          eligibility.reason?.includes("Do Not Call") ? "DO_NOT_CALL" : "SKIPPED";
        await prisma.campaignClient.update({
          where: { id: cc.id },
          data: { status: skipStatus as any },
        });
        details.push(
          `Campaign ${campaign.name}: skipped ${cc.client.firstName} (${eligibility.reason}).`
        );
        continue;
      }

      // Retry cap.
      if (cc.attempts >= campaign.retryLimit + 1) {
        await prisma.campaignClient.update({
          where: { id: cc.id },
          data: { status: "FAILED" },
        });
        continue;
      }

      try {
        await placeCall({ clientId: cc.clientId, campaignId: campaign.id });
        placed++;
        callsPlaced++;
      } catch (e) {
        // Schedule retry if attempts remain.
        const attempts = cc.attempts + 1;
        if (attempts <= campaign.retryLimit) {
          const nextAttempt = new Date(
            Date.now() + campaign.retryDelayMin * 60 * 1000
          );
          await prisma.campaignClient.update({
            where: { id: cc.id },
            data: { status: "RETRY_SCHEDULED", nextAttempt },
          });
        } else {
          await prisma.campaignClient.update({
            where: { id: cc.id },
            data: { status: "FAILED" },
          });
        }
        details.push(
          `Campaign ${campaign.name}: error calling ${cc.client.firstName}: ${
            (e as Error).message
          }`
        );
      }
    }

    // Mark campaign completed when nothing is left to do.
    const remaining = await prisma.campaignClient.count({
      where: {
        campaignId: campaign.id,
        status: { in: ["QUEUED", "CALLING", "RETRY_SCHEDULED"] as any },
      },
    });
    if (remaining === 0 && activeCalls === 0 && placed === 0) {
      await prisma.campaign.update({
        where: { id: campaign.id },
        data: { status: "COMPLETED" },
      });
      details.push(`Campaign ${campaign.name}: completed.`);
    }
  }

  return {
    campaignsProcessed: runningCampaigns.length,
    callsPlaced,
    details,
  };
}

/** Enqueue clients into a campaign (idempotent per client). */
export async function enqueueClients(
  campaignId: string,
  clientIds: string[]
): Promise<number> {
  let count = 0;
  let position = await prisma.campaignClient.count({ where: { campaignId } });
  for (const clientId of clientIds) {
    try {
      await prisma.campaignClient.upsert({
        where: { campaignId_clientId: { campaignId, clientId } },
        create: { campaignId, clientId, position: position++, status: "QUEUED" },
        update: {},
      });
      count++;
    } catch {
      // skip duplicates / bad ids
    }
  }
  return count;
}
