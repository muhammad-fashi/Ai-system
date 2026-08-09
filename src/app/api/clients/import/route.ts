import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, getClientIp } from "@/lib/api";
import { normalizePhone, isValidPhone } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

interface ImportRow {
  firstName?: string;
  lastName?: string;
  companyName?: string;
  phone?: string;
  email?: string;
  website?: string;
  industry?: string;
  country?: string;
  city?: string;
  leadSource?: string;
  notes?: string;
  servicesNeeded?: string[] | string;
}

/**
 * Bulk import already-mapped client rows.
 * body: { rows: ImportRow[], mode: "skip" | "update" }
 * Returns per-row results plus counts of imported / updated / skipped / invalid.
 */
export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const rows: ImportRow[] = body?.rows || [];
  const mode: "skip" | "update" = body?.mode === "update" ? "update" : "skip";
  if (!Array.isArray(rows) || rows.length === 0) {
    return error("No rows to import", 400);
  }

  let imported = 0;
  let updated = 0;
  let skipped = 0;
  let invalid = 0;
  const errors: { row: number; reason: string }[] = [];

  // Pre-load existing phones for dedup.
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const firstName = (r.firstName || "").toString().trim();
    const rawPhone = (r.phone || "").toString().trim();
    if (!firstName || !rawPhone) {
      invalid++;
      errors.push({ row: i + 1, reason: "Missing name or phone" });
      continue;
    }
    const phone = normalizePhone(rawPhone);
    if (!isValidPhone(phone)) {
      invalid++;
      errors.push({ row: i + 1, reason: "Invalid phone number" });
      continue;
    }

    const services = Array.isArray(r.servicesNeeded)
      ? r.servicesNeeded
      : (r.servicesNeeded || "")
          .toString()
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

    const existing = await prisma.client.findFirst({ where: { phone } });
    const dataFields = {
      firstName,
      lastName: r.lastName?.toString().trim() || null,
      companyName: r.companyName?.toString().trim() || null,
      email: r.email?.toString().trim() || null,
      website: r.website?.toString().trim() || null,
      industry: r.industry?.toString().trim() || null,
      country: r.country?.toString().trim() || null,
      city: r.city?.toString().trim() || null,
      leadSource: r.leadSource?.toString().trim() || null,
      notes: r.notes?.toString().trim() || null,
      servicesNeeded: services,
    };

    if (existing) {
      if (mode === "update") {
        await prisma.client.update({ where: { id: existing.id }, data: dataFields });
        updated++;
      } else {
        skipped++;
      }
      continue;
    }

    await prisma.client.create({ data: { phone, ...dataFields } });
    imported++;
  }

  await logAudit({
    userId: (auth as any).userId,
    action: "client.import",
    metadata: { imported, updated, skipped, invalid, total: rows.length },
    ip: getClientIp(req),
  });

  return json({ imported, updated, skipped, invalid, total: rows.length, errors });
}
