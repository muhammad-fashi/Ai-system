import { prisma } from "@/lib/prisma";
import { apiAuth, json, parsePagination } from "@/lib/api";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const status = url.searchParams.get("status");
  const outcome = url.searchParams.get("outcome");
  const interest = url.searchParams.get("interest");
  const campaignId = url.searchParams.get("campaignId");
  const q = url.searchParams.get("q")?.trim();
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");

  const where: Prisma.CallWhereInput = {};
  if (status) where.status = status as any;
  if (outcome) where.outcome = outcome as any;
  if (interest) where.interestLevel = interest as any;
  if (campaignId) where.campaignId = campaignId;
  if (from || to) {
    where.createdAt = {};
    if (from) (where.createdAt as any).gte = new Date(from);
    if (to) (where.createdAt as any).lte = new Date(to);
  }
  if (q) {
    where.OR = [
      { phoneNumber: { contains: q } },
      { retellCallId: { contains: q } },
      { client: { firstName: { contains: q, mode: "insensitive" } } },
      { client: { companyName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, calls] = await Promise.all([
    prisma.call.count({ where }),
    prisma.call.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { client: true, campaign: { select: { id: true, name: true } } },
    }),
  ]);

  return json({
    calls,
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  });
}
