import { prisma } from "./prisma";

export async function logAudit(params: {
  userId?: string | null;
  action: string;
  target?: string | null;
  metadata?: Record<string, unknown> | null;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        target: params.target ?? null,
        metadata: (params.metadata as object) ?? undefined,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // Never let audit logging break the main flow.
  }
}

export async function notify(params: {
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown> | null;
}) {
  try {
    await prisma.notification.create({
      data: {
        type: params.type,
        title: params.title,
        message: params.message,
        metadata: (params.metadata as object) ?? undefined,
      },
    });
  } catch {
    // best-effort
  }
}
