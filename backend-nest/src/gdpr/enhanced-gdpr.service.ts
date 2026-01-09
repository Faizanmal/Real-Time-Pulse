/**
 * Enhanced GDPR Compliance Service
 * Provides comprehensive GDPR data export, deletion, and consent management
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { EmailService } from '../email/email.service';
import { v4 as uuidv4 } from 'uuid';
import * as archiver from 'archiver';
import { PassThrough } from 'stream';

interface DataExportRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  downloadUrl?: string;
  expiresAt?: Date;
  createdAt: Date;
}

interface DeletionRequest {
  id: string;
  userId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  scheduledAt: Date;
  completedAt?: Date;
  dataCategories: string[];
}

interface ConsentRecord {
  id: string;
  userId: string;
  consentType: string;
  granted: boolean;
  grantedAt?: Date;
  revokedAt?: Date;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class EnhancedGdprService {
  private readonly retentionPeriodDays: number;
  private readonly exportExpiryHours: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
    private readonly emailService: EmailService,
  ) {
    this.retentionPeriodDays = this.configService.get<number>('gdpr.retentionPeriodDays') || 365;
    this.exportExpiryHours = this.configService.get<number>('gdpr.exportExpiryHours') || 48;
  }

  // ==================== DATA EXPORT (Right to Access) ====================

  /**
   * Request a data export for a user
   */
  async requestDataExport(
    userId: string,
    format: 'json' | 'csv' = 'json',
  ): Promise<DataExportRequest> {
    const existingRequest = await this.prisma.dataExportRequest.findFirst({
      where: {
        userId,
        status: { in: ['pending', 'processing'] },
      },
    });

    if (existingRequest) {
      throw new BadRequestException('You already have a pending export request');
    }

    const request = await this.prisma.dataExportRequest.create({
      data: {
        id: uuidv4(),
        userId,
        format,
        status: 'pending',
        createdAt: new Date(),
      },
    });

    // Process export asynchronously
    this.processDataExport(request.id).catch((err) =>
      this.logger.error(`Export processing failed: ${err}`, 'GdprService'),
    );

    await this.auditService.logAction({
      action: 'GDPR_EXPORT_REQUESTED',
      userId,
      details: { requestId: request.id, format },
    });

    return request as unknown as DataExportRequest;
  }

  /**
   * Process a data export request
   */
  private async processDataExport(requestId: string): Promise<void> {
    await this.prisma.dataExportRequest.update({
      where: { id: requestId },
      data: { status: 'processing' },
    });

    try {
      const request = await this.prisma.dataExportRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) throw new Error('Request not found');

      // Collect all user data
      const userData = await this.collectUserData(request.userId);

      // Generate export file
      const downloadUrl = await this.generateExportFile(
        userData,
        request.format as 'json' | 'csv',
        request.userId,
      );

      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.exportExpiryHours);

      await this.prisma.dataExportRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          downloadUrl,
          expiresAt,
          completedAt: new Date(),
        },
      });

      // Send notification email
      const user = await this.prisma.user.findUnique({ where: { id: request.userId } });
      if (user) {
        await this.emailService.send({
          to: user.email,
          subject: 'Your Data Export is Ready',
          template: 'gdpr-export-ready',
          data: {
            name: user.name,
            downloadUrl,
            expiresAt,
          },
        });
      }

      this.logger.log(`Data export completed: ${requestId}`, 'GdprService');
    } catch (error) {
      await this.prisma.dataExportRequest.update({
        where: { id: requestId },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  /**
   * Collect all data for a user
   */
  private async collectUserData(userId: string): Promise<any> {
    const [
      user,
      workspaces,
      portals,
      widgets,
      comments,
      annotations,
      auditLogs,
      sessions,
      notifications,
      consents,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          avatar: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          settings: true,
          // Exclude password and sensitive tokens
        },
      }),
      this.prisma.workspace.findMany({
        where: { ownerId: userId },
        select: { id: true, name: true, description: true, createdAt: true },
      }),
      this.prisma.portal.findMany({
        where: { createdById: userId },
        select: { id: true, name: true, description: true, createdAt: true },
      }),
      this.prisma.widget.findMany({
        where: { createdById: userId },
        select: { id: true, name: true, type: true, config: true, createdAt: true },
      }),
      this.prisma.comment.findMany({
        where: { userId },
        select: { id: true, content: true, createdAt: true },
      }),
      this.prisma.annotation.findMany({
        where: { userId },
        select: { id: true, text: true, createdAt: true },
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        select: { id: true, action: true, details: true, createdAt: true },
        take: 1000,
      }),
      this.prisma.session.findMany({
        where: { userId },
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, type: true, title: true, message: true, createdAt: true },
      }),
      this.prisma.gDPRConsent.findMany({
        where: { userId },
        select: { id: true, type: true, granted: true, grantedAt: true, revokedAt: true },
      }),
    ]);

    return {
      exportDate: new Date().toISOString(),
      user,
      workspaces,
      portals,
      widgets,
      comments,
      annotations,
      auditLogs,
      sessions,
      notifications,
      consents,
    };
  }

  /**
   * Generate export file in specified format
   */
  private async generateExportFile(
    data: any,
    format: 'json' | 'csv',
    userId: string,
  ): Promise<string> {
    const filename = `gdpr-export-${userId}-${Date.now()}`;

    if (format === 'json') {
      // Store JSON file
      const content = JSON.stringify(data, null, 2);
      // In production, upload to S3 or similar
      const url = await this.uploadToStorage(filename + '.json', content);
      return url;
    } else {
      // Convert to CSV (multiple files in zip)
      const archive = archiver('zip');
      const passthrough = new PassThrough();
      archive.pipe(passthrough);

      for (const [key, value] of Object.entries(data)) {
        if (Array.isArray(value) && value.length > 0) {
          const csv = this.convertToCSV(value);
          archive.append(csv, { name: `${key}.csv` });
        }
      }

      await archive.finalize();
      const url = await this.uploadToStorage(filename + '.zip', passthrough);
      return url;
    }
  }

  private convertToCSV(data: any[]): string {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    const rows = data.map((item) =>
      headers.map((h) => JSON.stringify(item[h] ?? '')).join(','),
    );
    return [headers.join(','), ...rows].join('\n');
  }

  private async uploadToStorage(filename: string, content: any): Promise<string> {
    // In production, upload to S3
    // For now, return a placeholder URL
    return `https://storage.realtimepulse.com/exports/${filename}`;
  }

  // ==================== DATA DELETION (Right to be Forgotten) ====================

  /**
   * Request account and data deletion
   */
  async requestDeletion(
    userId: string,
    dataCategories: string[] = ['all'],
  ): Promise<DeletionRequest> {
    // Schedule deletion after grace period (30 days for account recovery)
    const gracePeriodDays = 30;
    const scheduledAt = new Date();
    scheduledAt.setDate(scheduledAt.getDate() + gracePeriodDays);

    const request = await this.prisma.gDPRDataRequest.create({
      data: {
        id: uuidv4(),
        userId,
        status: 'pending',
        dataCategories,
        scheduledAt,
        createdAt: new Date(),
      },
    });

    await this.auditService.logAction({
      action: 'GDPR_DELETION_REQUESTED',
      userId,
      details: { requestId: request.id, scheduledAt, dataCategories },
    });

    // Send confirmation email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      await this.emailService.send({
        to: user.email,
        subject: 'Account Deletion Request Received',
        template: 'gdpr-deletion-scheduled',
        data: {
          name: user.name,
          scheduledAt,
          cancelUrl: `${this.configService.get('app.frontendUrl')}/settings/cancel-deletion/${request.id}`,
        },
      });
    }

    return request as unknown as DeletionRequest;
  }

  /**
   * Cancel a pending deletion request
   */
  async cancelDeletion(requestId: string, userId: string): Promise<void> {
    const request = await this.prisma.gDPRDataRequest.findFirst({
      where: { id: requestId, userId, status: 'pending' },
    });

    if (!request) {
      throw new BadRequestException('Deletion request not found or already processed');
    }

    await this.prisma.gDPRDataRequest.update({
      where: { id: requestId },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    await this.auditService.logAction({
      action: 'GDPR_DELETION_CANCELLED',
      userId,
      details: { requestId },
    });
  }

  /**
   * Process scheduled deletions
   */
  @Cron(CronExpression.EVERY_HOUR)
  async processScheduledDeletions(): Promise<void> {
    const dueRequests = await this.prisma.gDPRDataRequest.findMany({
      where: {
        status: 'pending',
        scheduledAt: { lte: new Date() },
      },
    });

    for (const request of dueRequests) {
      try {
        await this.executeDataDeletion(request.id);
      } catch (error) {
        this.logger.error(`Deletion failed for ${request.id}: ${error}`, 'GdprService');
      }
    }
  }

  /**
   * Execute data deletion
   */
  private async executeDataDeletion(requestId: string): Promise<void> {
    await this.prisma.gDPRDataRequest.update({
      where: { id: requestId },
      data: { status: 'processing' },
    });

    try {
      const request = await this.prisma.gDPRDataRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) throw new Error('Request not found');

      const userId = request.userId;
      const categories = request.dataCategories as string[];

      // Delete data in proper order (respect foreign keys)
      await this.prisma.$transaction(async (tx) => {
        // Always delete in order of dependencies
        await tx.notification.deleteMany({ where: { userId } });
        await tx.session.deleteMany({ where: { userId } });
        await tx.comment.deleteMany({ where: { userId } });
        await tx.annotation.deleteMany({ where: { userId } });
        
        if (categories.includes('all') || categories.includes('widgets')) {
          await tx.widget.deleteMany({ where: { createdById: userId } });
        }
        
        if (categories.includes('all') || categories.includes('portals')) {
          await tx.portal.deleteMany({ where: { createdById: userId } });
        }
        
        if (categories.includes('all') || categories.includes('workspaces')) {
          await tx.workspace.deleteMany({ where: { ownerId: userId } });
        }

        // Anonymize audit logs (retain for compliance, but remove PII)
        await tx.auditLog.updateMany({
          where: { userId },
          data: { userId: 'deleted-user', ipAddress: null, userAgent: null },
        });

        if (categories.includes('all') || categories.includes('account')) {
          await tx.user.delete({ where: { id: userId } });
        }
      });

      await this.prisma.gDPRDataRequest.update({
        where: { id: requestId },
        data: { status: 'completed', completedAt: new Date() },
      });

      this.logger.log(`Data deletion completed: ${requestId}`, 'GdprService');
    } catch (error) {
      await this.prisma.gDPRDataRequest.update({
        where: { id: requestId },
        data: { status: 'failed' },
      });
      throw error;
    }
  }

  // ==================== CONSENT MANAGEMENT ====================

  /**
   * Record user consent
   */
  async recordConsent(
    userId: string,
    consentType: string,
    granted: boolean,
    metadata?: { ipAddress?: string; userAgent?: string },
  ): Promise<ConsentRecord> {
    const consent = await this.prisma.gDPRConsent.upsert({
      where: {
        userId_type: { userId, type: consentType },
      },
      update: {
        granted,
        ...(granted ? { grantedAt: new Date() } : { revokedAt: new Date() }),
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
      create: {
        id: uuidv4(),
        userId,
        type: consentType,
        granted,
        grantedAt: granted ? new Date() : undefined,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    await this.auditService.logAction({
      action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
      userId,
      details: { consentType },
    });

    return consent as unknown as ConsentRecord;
  }

  /**
   * Get user consents
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const consents = await this.prisma.gDPRConsent.findMany({
      where: { userId },
    });
    return consents as unknown as ConsentRecord[];
  }

  /**
   * Check if user has given specific consent
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const consent = await this.prisma.gDPRConsent.findUnique({
      where: { userId_type: { userId, type: consentType } },
    });
    return consent?.granted ?? false;
  }

  /**
   * Get consent types and their status
   */
  getConsentTypes(): { type: string; description: string; required: boolean }[] {
    return [
      { type: 'essential', description: 'Essential cookies for site functionality', required: true },
      { type: 'analytics', description: 'Analytics cookies for usage tracking', required: false },
      { type: 'marketing', description: 'Marketing cookies for personalized ads', required: false },
      { type: 'third_party', description: 'Third-party integrations', required: false },
      { type: 'email_marketing', description: 'Email marketing communications', required: false },
      { type: 'data_processing', description: 'Processing of personal data for service', required: true },
    ];
  }

  // ==================== DATA RETENTION ====================

  /**
   * Clean up expired data based on retention policy
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async cleanupExpiredData(): Promise<void> {
    const retentionDate = new Date();
    retentionDate.setDate(retentionDate.getDate() - this.retentionPeriodDays);

    this.logger.log(`Starting data retention cleanup for data older than ${retentionDate}`, 'GdprService');

    try {
      // Clean up old audit logs
      const auditLogsDeleted = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: retentionDate } },
      });

      // Clean up old sessions
      const sessionsDeleted = await this.prisma.session.deleteMany({
        where: { createdAt: { lt: retentionDate }, isValid: false },
      });

      // Clean up old notifications
      const notificationsDeleted = await this.prisma.notification.deleteMany({
        where: { createdAt: { lt: retentionDate }, read: true },
      });

      // Clean up expired export files
      const exportsDeleted = await this.prisma.dataExportRequest.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });

      this.logger.log(
        `Retention cleanup completed: ${auditLogsDeleted.count} audit logs, ${sessionsDeleted.count} sessions, ${notificationsDeleted.count} notifications, ${exportsDeleted.count} exports`,
        'GdprService',
      );
    } catch (error) {
      this.logger.error(`Retention cleanup failed: ${error}`, 'GdprService');
    }
  }

  // ==================== DATA PORTABILITY ====================

  /**
   * Generate data portability package (machine-readable format)
   */
  async generatePortabilityPackage(userId: string): Promise<string> {
    const data = await this.collectUserData(userId);

    // Convert to standardized format (e.g., JSON-LD)
    const portableData = {
      '@context': 'https://schema.org/',
      '@type': 'Person',
      identifier: data.user.id,
      email: data.user.email,
      name: data.user.name,
      dateCreated: data.user.createdAt,
      owns: data.workspaces.map((w: any) => ({
        '@type': 'CreativeWork',
        identifier: w.id,
        name: w.name,
        description: w.description,
      })),
    };

    // Generate and return download URL
    const url = await this.uploadToStorage(
      `portability-${userId}-${Date.now()}.json`,
      JSON.stringify(portableData, null, 2),
    );

    return url;
  }
}
