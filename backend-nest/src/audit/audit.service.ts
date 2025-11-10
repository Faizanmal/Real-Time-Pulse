import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuditAction } from '@prisma/client';

export interface AuditLogData {
  workspaceId: string;
  userId?: string;
  userEmail: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  ipAddress?: string;
  userAgent?: string;
  method: string;
  endpoint: string;
  oldValues?: any;
  newValues?: any;
  metadata?: any;
  success?: boolean;
  errorMessage?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          ...data,
          success: data.success ?? true,
        },
      });
    } catch (error) {
      // Don't throw - audit logging shouldn't break the main flow
      this.logger.error('Failed to create audit log', error);
    }
  }

  async findByWorkspace(
    workspaceId: string,
    options?: {
      limit?: number;
      offset?: number;
      action?: AuditAction;
      entity?: string;
      userId?: string;
      startDate?: Date;
      endDate?: Date;
    },
  ) {
    const where: any = { workspaceId };

    if (options?.action) where.action = options.action;
    if (options?.entity) where.entity = options.entity;
    if (options?.userId) where.userId = options.userId;

    if (options?.startDate || options?.endDate) {
      where.createdAt = {};
      if (options.startDate) where.createdAt.gte = options.startDate;
      if (options.endDate) where.createdAt.lte = options.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: options?.limit || 50,
        skip: options?.offset || 0,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { logs, total };
  }

  async findByEntity(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
