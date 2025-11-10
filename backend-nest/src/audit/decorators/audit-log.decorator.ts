import { SetMetadata } from '@nestjs/common';
import type { AuditAction } from '@prisma/client';

export const AUDIT_LOG_KEY = 'audit_log';

export interface AuditLogMetadata {
  action: AuditAction;
  entity: string;
}

export const AuditLog = (action: AuditAction, entity: string) =>
  SetMetadata(AUDIT_LOG_KEY, { action, entity });
