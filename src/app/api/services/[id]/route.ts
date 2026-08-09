import { prisma } from "@/lib/prisma";
import { apiAuth, json } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const data: any = {};
  for (const k of ["name", "description", "active"]) if (k in body) data[k] = body[k];
  const service = await prisma.service.update({ where: { id }, data });
  return json({ service });
}

export async function DELETE(_req: Request, { params }: Params) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  await prisma.service.delete({ where: { id } });
  return json({ ok: true });
}
