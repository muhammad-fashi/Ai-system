import { prisma } from "@/lib/prisma";
import { apiAuth, json, error } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const services = await prisma.service.findMany({ orderBy: { name: "asc" } });
  return json({ services });
}

export async function POST(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => null);
  if (!body?.name) return error("Name required", 400);
  const service = await prisma.service.upsert({
    where: { name: body.name },
    create: { name: body.name, description: body.description || null, active: body.active ?? true },
    update: { description: body.description ?? undefined, active: body.active ?? undefined },
  });
  return json({ service }, 201);
}
