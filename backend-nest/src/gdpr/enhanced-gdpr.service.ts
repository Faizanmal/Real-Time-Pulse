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
  requestedAt: Date;
  completedAt?: Date;
}

interface DeletionRequest {
  id: string;
  workspaceId: string;
  requesterEmail: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | 'CANCELLED';
  submittedAt: Date;
  processedAt?: Date;
  dataCategories: string[];
}

interface ConsentRecord {
  id: string;
  workspaceId: string;
  subjectEmail: string;
  consentType: string;
  consented: boolean;
  consentedAt?: Date;
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
        requestedAt: new Date(),
      } as any,
    });

    // Process export asynchronously
    this.processDataExport(request.id).catch((err) =>
      this.logger.error(`Export processing failed: ${err}`, 'GdprService'),
    );

    await (this.auditService as any).logAction({
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

      await this.prisma.dataExportRequest.update({
        where: { id: requestId },
        data: {
          status: 'completed',
          downloadUrl,
          completedAt: new Date(),
        } as any,
      });

      // Send notification email
      const user = await this.prisma.user.findUnique({ where: { id: request.userId } });
      if (user) {
        await (this.emailService as any).send({
          to: user.email,
          subject: 'Your Data Export is Ready',
          template: 'gdpr-export-ready',
          data: {
            name: user.name,
            downloadUrl,
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
          // Exclude password and sensitive tokens
        } as any,
      }),
      this.prisma.workspace.findMany({
        where: { users: { some: { id: userId } } },
        select: { id: true, name: true, slug: true, createdAt: true } as any,
      }),
      this.prisma.portal.findMany({
        where: { createdById: userId },
        select: { id: true, name: true, description: true, createdAt: true } as any,
      }),
      this.prisma.widget.findMany({
        where: { portal: { createdById: userId } },
        select: { id: true, name: true, type: true, config: true, createdAt: true } as any,
      }),
      this.prisma.comment.findMany({
        where: { authorId: userId },
        select: { id: true, content: true, createdAt: true } as any,
      }),
      this.prisma.annotation.findMany({
        where: { userId },
        select: { id: true, text: true, createdAt: true } as any,
      }),
      this.prisma.auditLog.findMany({
        where: { userId },
        select: { id: true, action: true, details: true, createdAt: true } as any,
        take: 1000,
      }),
      (this.prisma as any).userSession.findMany({
        where: { userId },
        select: { id: true, ipAddress: true, userAgent: true, createdAt: true },
      }),
      this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, type: true, title: true, message: true, createdAt: true },
      }),
      this.prisma.gDPRConsent.findMany({
        where: {
          subjectEmail: (await this.prisma.user.findUnique({ where: { id: userId } }))?.email,
        },
        select: {
          id: true,
          consentType: true,
          consented: true,
          consentedAt: true,
          revokedAt: true,
        } as any,
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
    const rows = data.map((item) => headers.map((h) => JSON.stringify(item[h] ?? '')).join(','));
    return [headers.join(','), ...rows].join('\n');
  }

  private async uploadToStorage(filename: string, _content: any): Promise<string> {
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const request = await this.prisma.gDPRDataRequest.create({
      data: {
        workspaceId: user.workspaceId,
        requesterEmail: user.email,
        requesterName: user.name,
        requestType: 'ERASURE',
        status: 'PENDING',
        metadata: { dataCategories },
        submittedAt: new Date(),
      } as any,
    });

    await (this.auditService as any).logAction({
      action: 'GDPR_DELETION_REQUESTED',
      userId,
      details: { requestId: request.id, dataCategories },
    });

    // Send confirmation email
    await (this.emailService as any).send({
      to: user.email,
      subject: 'Account Deletion Request Received',
      template: 'gdpr-deletion-scheduled',
      data: {
        name: user.name,
        scheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        cancelUrl: `${this.configService.get('app.frontendUrl')}/settings/cancel-deletion/${request.id}`,
      },
    });

    return {
      id: request.id,
      workspaceId: request.workspaceId,
      requesterEmail: request.requesterEmail,
      status: request.status as any,
      submittedAt: request.submittedAt,
      dataCategories,
    };
  }

  /**
   * Cancel a pending deletion request
   */
  async cancelDeletion(requestId: string, userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const request = await this.prisma.gDPRDataRequest.findFirst({
      where: { id: requestId, requesterEmail: user.email, status: 'PENDING' },
    });

    if (!request) {
      throw new BadRequestException('Deletion request not found or already processed');
    }

    await this.prisma.gDPRDataRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED' },
    });

    await (this.auditService as any).logAction({
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
        status: 'PENDING',
        submittedAt: { lte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }, // 30 days ago
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
      data: { status: 'IN_PROGRESS' },
    });

    try {
      const request = await this.prisma.gDPRDataRequest.findUnique({
        where: { id: requestId },
      });

      if (!request) throw new Error('Request not found');

      const user = await this.prisma.user.findFirst({
        where: { email: request.requesterEmail, workspaceId: request.workspaceId },
      });

      if (!user) throw new Error('User not found');

      const userId = user.id;
      const categories = (request.metadata as any)?.dataCategories || ['all'];

      // Delete data in proper order (respect foreign keys)
      await this.prisma.$transaction(async (tx) => {
        // Always delete in order of dependencies
        await tx.notification.deleteMany({ where: { userId } });
        await tx.userSession.deleteMany({ where: { userId } });
        await tx.comment.deleteMany({ where: { authorId: userId } });
        await tx.annotation.deleteMany({ where: { userId } });

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
        data: { status: 'COMPLETED', processedAt: new Date() },
      });

      this.logger.log(`Data deletion completed: ${requestId}`, 'GdprService');
    } catch (error) {
      await this.prisma.gDPRDataRequest.update({
        where: { id: requestId },
        data: { status: 'REJECTED' },
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
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found');

    const existing = await this.prisma.gDPRConsent.findFirst({
      where: { subjectEmail: user.email, consentType: consentType as any },
    });

    if (existing) {
      const consent = await this.prisma.gDPRConsent.update({
        where: { id: existing.id },
        data: {
          consented: granted,
          ...(granted ? { consentedAt: new Date() } : { revokedAt: new Date() }),
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      });

      await (this.auditService as any).logAction({
        action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        userId,
        details: { consentType },
      });

      return {
        id: consent.id,
        workspaceId: consent.workspaceId,
        subjectEmail: consent.subjectEmail,
        consentType: consent.consentType,
        consented: consent.consented,
        consentedAt: consent.consentedAt,
        revokedAt: consent.revokedAt,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
      };
    } else {
      const consent = await this.prisma.gDPRConsent.create({
        data: {
          workspaceId: user.workspaceId,
          subjectEmail: user.email,
          subjectName: user.name,
          consentType: consentType as any,
          purpose: '',
          consented: granted,
          consentedAt: granted ? new Date() : undefined,
          ipAddress: metadata?.ipAddress,
          userAgent: metadata?.userAgent,
        },
      });

      await (this.auditService as any).logAction({
        action: granted ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
        userId,
        details: { consentType },
      });

      return {
        id: consent.id,
        workspaceId: consent.workspaceId,
        subjectEmail: consent.subjectEmail,
        consentType: consent.consentType,
        consented: consent.consented,
        consentedAt: consent.consentedAt,
        revokedAt: consent.revokedAt,
        ipAddress: consent.ipAddress,
        userAgent: consent.userAgent,
      };
    }
  }

  /**
   * Get user consents
   */
  async getUserConsents(userId: string): Promise<ConsentRecord[]> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return [];

    const consents = await this.prisma.gDPRConsent.findMany({
      where: { subjectEmail: user.email },
    });

    return consents.map((c) => ({
      id: c.id,
      workspaceId: c.workspaceId,
      subjectEmail: c.subjectEmail,
      consentType: c.consentType,
      consented: c.consented,
      consentedAt: c.consentedAt,
      revokedAt: c.revokedAt,
      ipAddress: c.ipAddress,
      userAgent: c.userAgent,
    }));
  }

  /**
   * Check if user has given specific consent
   */
  async hasConsent(userId: string, consentType: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return false;

    const consent = await this.prisma.gDPRConsent.findFirst({
      where: { subjectEmail: user.email, consentType: consentType as any },
    });

    return (consent as any)?.consented ?? false;
  }

  /**
   * Get consent types and their status
   */
  getConsentTypes(): { type: string; description: string; required: boolean }[] {
    return [
      {
        type: 'DATA_PROCESSING',
        description: 'Essential cookies for site functionality',
        required: true,
      },
      { type: 'ANALYTICS', description: 'Analytics cookies for usage tracking', required: false },
      { type: 'MARKETING', description: 'Marketing cookies for personalized ads', required: false },
      { type: 'THIRD_PARTY_SHARING', description: 'Third-party integrations', required: false },
      { type: 'PROFILING', description: 'Profiling for personalized experience', required: false },
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

    this.logger.log(
      `Starting data retention cleanup for data older than ${retentionDate.toISOString()}`,
      'GdprService',
    );

    try {
      // Clean up old audit logs
      const auditLogsDeleted = await this.prisma.auditLog.deleteMany({
        where: { createdAt: { lt: retentionDate } },
      });

      // Clean up old sessions
      const sessionsDeleted = await this.prisma.userSession.deleteMany({
        where: { createdAt: { lt: retentionDate } },
      });

      // Clean up old notifications
      const notificationsDeleted = await this.prisma.notification.deleteMany({
        where: { createdAt: { lt: retentionDate } },
      });

      // Clean up old export files
      const exportsDeleted = await this.prisma.dataExportRequest.deleteMany({
        where: { requestedAt: { lt: retentionDate } },
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
