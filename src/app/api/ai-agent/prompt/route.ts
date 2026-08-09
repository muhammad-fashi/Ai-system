import { apiAuth, json } from "@/lib/api";
import { getSetting } from "@/lib/settings";
import { buildAgentPrompt } from "@/lib/retell";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const DYNAMIC_VARS = [
  "client_first_name", "client_full_name", "company_name", "client_website",
  "has_website", "client_industry", "client_location", "services_interested",
  "agent_name", "agency_name", "agency_description", "website_services",
  "seo_services", "social_services", "pricing_info", "sales_rules",
  "qualification_questions", "objection_handling", "tone", "compliance_message",
];

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const ai = await getSetting("aiAgent");
  return json({ prompt: buildAgentPrompt(ai), dynamicVariables: DYNAMIC_VARS });
}
