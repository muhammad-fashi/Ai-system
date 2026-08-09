import { prisma } from "@/lib/prisma";
import { apiAuth, json } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const [notifications, unread] = await Promise.all([
    prisma.notification.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
    prisma.notification.count({ where: { read: false } }),
  ]);
  return json({ notifications, unread });
}

/** Mark notifications read. body: { ids?: string[], all?: boolean } */
export async function PUT(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const body = await req.json().catch(() => ({}));
  if (body.all) {
    await prisma.notification.updateMany({ where: { read: false }, data: { read: true } });
  } else if (Array.isArray(body.ids)) {
    await prisma.notification.updateMany({ where: { id: { in: body.ids } }, data: { read: true } });
  }
  return json({ ok: true });
}
