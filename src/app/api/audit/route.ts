import { prisma } from "@/lib/prisma";
import { apiAuth, json, parsePagination } from "@/lib/api";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const auth = await apiAuth();
  if (auth instanceof NextResponse) return auth;
  const url = new URL(req.url);
  const { page, pageSize, skip, take } = parsePagination(url);
  const [total, logs] = await Promise.all([
    prisma.auditLog.count(),
    prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      skip,
      take,
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);
  return json({ logs, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } });
}
