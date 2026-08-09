import { apiAuth, json, getClientIp } from "@/lib/api";
import { getAllSettings, setSetting, type SettingsKey } from "@/lib/settings";
import { isRetellConfigured, isMockMode } from "@/lib/retell";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const settings = await getAllSettings();
  return json({
    settings,
    retellStatus: {
      configured: isRetellConfigured(),
      mock: isMockMode(),
      hasApiKey: Boolean(process.env.RETELL_API_KEY),
      phoneNumber: process.env.RETELL_PHONE_NUMBER || "",
      fromNumber: process.env.RETELL_FROM_NUMBER || "",
      webhookUrl: `${process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || ""}/api/webhooks/retell`,
    },
  });
}

/** body: { key: SettingsKey, value: Partial<...> } */
export async function PUT(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  const key = body?.key as SettingsKey;
  const value = body?.value;
  const validKeys: SettingsKey[] = ["aiAgent", "calling", "notifications", "retell"];
  if (!validKeys.includes(key)) return json({ error: "Invalid settings key" }, 400);

  const updated = await setSetting(key, value);
  await logAudit({ userId: (auth as any).userId, action: "settings.updated", target: key, ip: getClientIp(req) });
  return json({ [key]: updated });
}
