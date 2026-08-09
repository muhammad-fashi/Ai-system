import { prisma } from "@/lib/prisma";
import { apiAuth, json, error, parsePagination, getClientIp } from "@/lib/api";
import { clientCreateSchema } from "@/lib/validation";
import { normalizePhone, isValidPhone } from "@/lib/utils";
import { logAudit } from "@/lib/audit";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const q = url.searchParams.get("q")?.trim();
  const status = url.searchParams.get("status");
  const interest = url.searchParams.get("interest");
  const industry = url.searchParams.get("industry");
  const doNotCall = url.searchParams.get("doNotCall");
  const sortBy = url.searchParams.get("sortBy") || "createdAt";
  const sortDir = (url.searchParams.get("sortDir") || "desc") as "asc" | "desc";

  const where: Prisma.ClientWhereInput = {};
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { website: { contains: q, mode: "insensitive" } },
    ];
  }
  if (status) where.status = status as any;
  if (interest) where.interestLevel = interest as any;
  if (industry) where.industry = { contains: industry, mode: "insensitive" };
  if (doNotCall === "true") where.doNotCall = true;

  const allowedSort = ["createdAt", "firstName", "companyName", "status", "lastCallAt", "leadScore", "callCount"];
  const orderBy: Prisma.ClientOrderByWithRelationInput = allowedSort.includes(sortBy)
    ? ({ [sortBy]: sortDir } as any)
    : { createdAt: "desc" };

  const [total, clients] = await Promise.all([
    prisma.client.count({ where }),
    prisma.client.findMany({ where, orderBy, skip, take }),
  ]);

  return json({
    clients,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}

export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = clientCreateSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "Invalid input", 400);
  }

  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  if (!isValidPhone(phone)) {
    return error("Invalid phone number format", 400);
  }

  const client = await prisma.client.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName || null,
      companyName: data.companyName || null,
      phone,
      email: data.email || null,
      website: data.website || null,
      industry: data.industry || null,
      country: data.country || null,
      city: data.city || null,
      timezone: data.timezone || null,
      leadSource: data.leadSource || null,
      servicesNeeded: data.servicesNeeded || [],
      notes: data.notes || null,
      preferredLanguage: data.preferredLanguage || null,
      preferredCallTime: data.preferredCallTime || null,
      status: (data.status as any) || "NEW",
      interestLevel: (data.interestLevel as any) || "UNKNOWN",
      customFields: (data.customFields as any) || undefined,
    },
  });

  await logAudit({
    userId: (auth as any).userId,
    action: "client.created",
    target: client.id,
    ip: getClientIp(req),
  });

  return json({ client }, 201);
}
