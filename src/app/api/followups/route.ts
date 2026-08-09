import { prisma } from "@/lib/prisma";
import { apiAuth, json, error } from "@/lib/api";
import { followUpCreateSchema } from "@/lib/validation";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const where: Prisma.FollowUpWhereInput = {};
  if (status) where.status = status as any;

  const followUps = await prisma.followUp.findMany({
    where,
    orderBy: { scheduledAt: "asc" },
    include: {
      client: true,
      call: { select: { id: true, summary: true } },
      assignedTo: { select: { id: true, name: true } },
    },
  });
  return json({ followUps });
}

export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  const parsed = followUpCreateSchema.safeParse(body);
  if (!parsed.success) {
    return error(parsed.error.issues[0]?.message || "Invalid input", 400);
  }
  const d = parsed.data;
  const followUp = await prisma.followUp.create({
    data: {
      clientId: d.clientId,
      callId: d.callId || null,
      scheduledAt: new Date(d.scheduledAt),
      reason: d.reason || null,
      notes: d.notes || null,
      autoCall: d.autoCall ?? false,
      assignedToId: d.assignedToId || null,
      status: "PENDING",
    },
  });
  await prisma.client.update({
    where: { id: d.clientId },
    data: { nextFollowUp: new Date(d.scheduledAt) },
  });
  return json({ followUp }, 201);
}
