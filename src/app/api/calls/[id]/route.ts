import { prisma } from "@/lib/prisma";
import { apiAuth, json, error } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const call = await prisma.call.findUnique({
    where: { id },
    include: { client: true, campaign: { select: { id: true, name: true } } },
  });
  if (!call) return error("Call not found", 404);
  return json({ call });
}

/** Manual outcome override. body: { outcome, interestLevel, nextAction } */
export async function PUT(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["outcome", "interestLevel", "nextAction", "summary"]) {
    if (k in body) data[k] = body[k];
  }
  const call = await prisma.call.update({ where: { id }, data });
  return json({ call });
}
