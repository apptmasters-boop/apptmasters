import { prisma } from "@/lib/db";

interface AuditParams {
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Record<string, unknown>;
  userId?: string;
  apartmentId?: string;
}

export async function logAudit({ action, entityType, entityId, meta, userId, apartmentId }: AuditParams) {
  await prisma.auditLog.create({
    data: {
      action,
      entityType,
      entityId: entityId ?? null,
      meta: meta ? JSON.stringify(meta) : "{}",
      userId: userId ?? null,
      apartmentId: apartmentId ?? null,
    },
  }).catch(() => {}); // never block the main operation
}
