import "server-only";
import type { AiAgentSettings, CallingSettings } from "./settings";

/**
 * Backend-only Retell AI service. The API key lives exclusively in server
 * environment variables and is never sent to the browser.
 *
 * When RETELL_API_KEY is not configured, the service runs in MOCK mode so the
 * app is fully usable in development without placing real calls. Production
 * with a real key always uses the live Retell REST API.
 */

const RETELL_BASE = "https://api.retellai.com";

export function isRetellConfigured(): boolean {
  return Boolean(process.env.RETELL_API_KEY);
}

export function isMockMode(): boolean {
  return !isRetellConfigured();
}

export interface CreateCallInput {
  toNumber: string;
  fromNumber: string;
  agentId?: string;
  dynamicVariables?: Record<string, string>;
  metadata?: Record<string, unknown>;
}

export interface RetellCallResult {
  call_id: string;
  call_status?: string;
  agent_id?: string;
  from_number?: string;
  to_number?: string;
  mock?: boolean;
}

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.RETELL_API_KEY}`,
    "Content-Type": "application/json",
  };
}

/** Place an outbound phone call via Retell. */
export async function createPhoneCall(
  input: CreateCallInput
): Promise<RetellCallResult> {
  if (isMockMode()) {
    return {
      call_id: `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      call_status: "registered",
      from_number: input.fromNumber,
      to_number: input.toNumber,
      agent_id: input.agentId,
      mock: true,
    };
  }

  const body: Record<string, unknown> = {
    from_number: input.fromNumber,
    to_number: input.toNumber,
  };
  if (input.agentId) body.override_agent_id = input.agentId;
  if (input.dynamicVariables)
    body.retell_llm_dynamic_variables = input.dynamicVariables;
  if (input.metadata) body.metadata = input.metadata;

  const res = await fetch(`${RETELL_BASE}/v2/create-phone-call`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Retell create-phone-call failed (${res.status}): ${text}`);
  }
  return (await res.json()) as RetellCallResult;
}

/** Retrieve full call detail (transcript, recording, analysis) from Retell. */
export async function getCall(callId: string): Promise<any | null> {
  if (isMockMode()) return null;
  const res = await fetch(`${RETELL_BASE}/v2/get-call/${callId}`, {
    method: "GET",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/** Lightweight connectivity check for the Settings > Retell test button. */
export async function testConnection(): Promise<{
  ok: boolean;
  mock: boolean;
  message: string;
}> {
  if (isMockMode()) {
    return {
      ok: false,
      mock: true,
      message:
        "RETELL_API_KEY is not configured. Running in MOCK mode — calls are simulated.",
    };
  }
  try {
    const res = await fetch(`${RETELL_BASE}/list-agents`, {
      method: "GET",
      headers: authHeaders(),
      cache: "no-store",
    });
    if (res.ok) {
      return { ok: true, mock: false, message: "Connected to Retell AI." };
    }
    return {
      ok: false,
      mock: false,
      message: `Retell responded ${res.status}. Check your API key.`,
    };
  } catch (e) {
    return {
      ok: false,
      mock: false,
      message: `Connection error: ${(e as Error).message}`,
    };
  }
}

/**
 * Verify an inbound Retell webhook. Retell signs the raw request body; the
 * signature arrives in the `x-retell-signature` header. We use the SDK verify
 * helper when available and fall back to a shared-secret header check.
 */
export async function verifyWebhook(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  // Dev/mock: accept when no key configured.
  if (isMockMode()) return true;

  const apiKey = process.env.RETELL_API_KEY!;
  try {
    // retell-sdk exposes a static verify(payload, apiKey, signature)
    const mod: any = await import("retell-sdk");
    const Retell = mod.default ?? mod.Retell ?? mod;
    if (Retell && typeof Retell.verify === "function") {
      return Boolean(Retell.verify(rawBody, apiKey, signature ?? ""));
    }
  } catch {
    // fall through to shared-secret check
  }

  const secret = process.env.RETELL_WEBHOOK_SECRET;
  if (secret && signature) {
    return signature === secret;
  }
  // If we cannot verify, reject in production.
  return false;
}

/**
 * Build the dynamic variables passed to the Retell agent so it can personalize
 * the conversation with client + agency context.
 */
export function buildDynamicVariables(
  client: {
    firstName: string;
    lastName?: string | null;
    companyName?: string | null;
    website?: string | null;
    industry?: string | null;
    city?: string | null;
    country?: string | null;
    servicesNeeded?: string[];
  },
  ai: AiAgentSettings,
  calling: CallingSettings
): Record<string, string> {
  const hasWebsite = Boolean(client.website);
  return {
    client_first_name: client.firstName || "there",
    client_last_name: client.lastName || "",
    client_full_name: [client.firstName, client.lastName]
      .filter(Boolean)
      .join(" "),
    company_name: client.companyName || "",
    client_website: client.website || "",
    has_website: hasWebsite ? "yes" : "no",
    client_industry: client.industry || "",
    client_location: [client.city, client.country].filter(Boolean).join(", "),
    services_interested: (client.servicesNeeded || []).join(", "),
    agent_name: ai.agentName,
    agency_name: ai.companyName,
    agency_description: ai.companyDescription,
    website_services: ai.websiteServices,
    seo_services: ai.seoServices,
    social_services: ai.socialServices,
    pricing_info: ai.pricingInfo,
    sales_rules: ai.salesRules,
    qualification_questions: ai.qualificationQuestions,
    objection_handling: ai.objectionHandling,
    tone: ai.tone,
    compliance_message: calling.complianceMessage,
  };
}

/**
 * The recommended system prompt for the Retell agent. Exposed in the AI Agent
 * page so the admin can copy it into their Retell agent configuration. Uses
 * {{dynamic_variable}} placeholders that Retell substitutes at call time.
 */
export function buildAgentPrompt(ai: AiAgentSettings): string {
  return `You are ${ai.agentName || "{{agent_name}}"}, a professional, ${
    ai.tone
  } sales representative calling on behalf of {{agency_name}}.

# Identity & Purpose
{{agency_description}}
You are calling {{client_full_name}}${
    "" // company appended below dynamically
  } to briefly understand their business and see whether the agency can help improve their online presence.

# Conversation flow
1. Greet the client by first name and introduce yourself and the agency.
2. Ask permission to continue: "Is this a good time for a quick conversation?"
3. If yes, ask about their business and current website (has_website = {{has_website}}).
   - If they have a website ({{client_website}}), ask whether they are doing anything to improve its Google visibility.
   - If not, explain how a modern website + digital marketing establishes an online presence.
4. Ask relevant qualification questions (do not ask all mechanically):
{{qualification_questions}}
5. Recommend relevant services based on their answers:
   - Websites: {{website_services}}
   - SEO: {{seo_services}}
   - Social media: {{social_services}}
6. Handle objections professionally:
{{objection_handling}}
7. For pricing: {{pricing_info}}
8. Ask for a next step — a follow-up or a short consultation with the team.
9. End the conversation politely and thank them.

# Hard rules
{{sales_rules}}
- NEVER guarantee rankings, leads, sales, or specific results.
- NEVER pressure the client. Be consultative and respectful.
- If the client is not interested, thank them and end the call.
- If the client asks to not be called again, acknowledge, confirm they will be removed, and end the call. (This is a DO NOT CALL request.)
- If required by law in the client's jurisdiction, disclose: {{compliance_message}}

Keep responses concise and natural. Do not sound robotic.`;
}
