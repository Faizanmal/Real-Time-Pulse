import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConsentType, GDPRRequestType, GDPRRequestStatus, Prisma } from '@prisma/client';

@Injectable()
export class GdprService {
  private readonly logger = new Logger(GdprService.name);

  constructor(private prisma: PrismaService) {}

  // Consent Management
  async recordConsent(data: {
    workspaceId: string;
    userId?: string;
    subjectEmail: string;
    subjectName?: string;
    consentType: ConsentType;
    purpose: string;
    consented: boolean;
    ipAddress?: string;
    userAgent?: string;
    expiresAt?: Date;
  }) {
    return this.prisma.gDPRConsent.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        subjectEmail: data.subjectEmail,
        subjectName: data.subjectName,
        consentType: data.consentType,
        purpose: data.purpose,
        consented: data.consented,
        consentedAt: data.consented ? new Date() : null,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        expiresAt: data.expiresAt,
      },
    });
  }

  async revokeConsent(consentId: string, reason?: string) {
    return this.prisma.gDPRConsent.update({
      where: { id: consentId },
      data: {
        consented: false,
        revokedAt: new Date(),
        revocationReason: reason,
      },
    });
  }

  async getConsents(
    workspaceId: string,
    filters?: {
      subjectEmail?: string;
      consentType?: ConsentType;
      consented?: boolean;
    },
  ) {
    return this.prisma.gDPRConsent.findMany({
      where: {
        workspaceId,
        ...(filters?.subjectEmail && { subjectEmail: filters.subjectEmail }),
        ...(filters?.consentType && { consentType: filters.consentType }),
        ...(filters?.consented !== undefined && {
          consented: filters.consented,
        }),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getConsentById(consentId: string) {
    return this.prisma.gDPRConsent.findUnique({
      where: { id: consentId },
    });
  }

  // Data Requests
  async createDataRequest(data: {
    workspaceId: string;
    requesterEmail: string;
    requesterName?: string;
    requestType: GDPRRequestType;
  }) {
    return this.prisma.gDPRDataRequest.create({
      data: {
        workspaceId: data.workspaceId,
        requesterEmail: data.requesterEmail,
        requesterName: data.requesterName,
        requestType: data.requestType,
      },
    });
  }

  async getDataRequests(
    workspaceId: string,
    filters?: {
      requesterEmail?: string;
      requestType?: GDPRRequestType;
      status?: GDPRRequestStatus;
    },
  ) {
    return this.prisma.gDPRDataRequest.findMany({
      where: {
        workspaceId,
        ...(filters?.requesterEmail && {
          requesterEmail: filters.requesterEmail,
        }),
        ...(filters?.requestType && { requestType: filters.requestType }),
        ...(filters?.status && { status: filters.status }),
      },
      include: {
        auditTrail: {
          orderBy: { timestamp: 'desc' },
        },
      },
      orderBy: { submittedAt: 'desc' },
    });
  }

  async getDataRequestById(requestId: string) {
    return this.prisma.gDPRDataRequest.findUnique({
      where: { id: requestId },
      include: {
        auditTrail: {
          orderBy: { timestamp: 'desc' },
        },
      },
    });
  }

  async updateDataRequestStatus(
    requestId: string,
    status: GDPRRequestStatus,
    performedBy?: string,
    notes?: string,
  ) {
    const request = await this.prisma.gDPRDataRequest.update({
      where: { id: requestId },
      data: {
        status,
        ...(status === GDPRRequestStatus.COMPLETED && {
          processedAt: new Date(),
          processedBy: performedBy,
        }),
      },
    });

    // Add audit trail entry
    await this.addAuditTrailEntry(requestId, {
      action: `Status updated to ${status}`,
      performedBy,
      details: { notes },
    });

    return request;
  }

  async processDataAccessRequest(requestId: string, performedBy: string) {
    const request = await this.getDataRequestById(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Update status to in progress
    await this.updateDataRequestStatus(requestId, GDPRRequestStatus.IN_PROGRESS, performedBy);

    // Collect all data for the requester
    const userData = await this.collectUserData(request.workspaceId, request.requesterEmail);

    // Generate data export (in production, this would create a downloadable file)
    const exportUrl = await this.generateDataExport(userData);

    // Update request with export URL
    await this.prisma.gDPRDataRequest.update({
      where: { id: requestId },
      data: {
        dataExportUrl: exportUrl,
        dataExportExpiry: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    // Mark as completed
    await this.updateDataRequestStatus(requestId, GDPRRequestStatus.COMPLETED, performedBy);

    return { exportUrl, expiresIn: '7 days' };
  }

  async processDataErasureRequest(requestId: string, performedBy: string) {
    const request = await this.getDataRequestById(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Update status to in progress
    await this.updateDataRequestStatus(requestId, GDPRRequestStatus.IN_PROGRESS, performedBy);

    // Perform data deletion/anonymization
    const deletionResult = await this.deleteOrAnonymizeUserData(
      request.workspaceId,
      request.requesterEmail,
    );

    // Update request with deletion info
    await this.prisma.gDPRDataRequest.update({
      where: { id: requestId },
      data: {
        deletionCompletedAt: new Date(),
        dataRetained: deletionResult.retained as Prisma.InputJsonValue,
      },
    });

    // Mark as completed
    await this.updateDataRequestStatus(
      requestId,
      GDPRRequestStatus.COMPLETED,
      performedBy,
      'Data has been deleted/anonymized',
    );

    return deletionResult;
  }

  private async collectUserData(workspaceId: string, email: string) {
    // Collect all user data from various tables
    const user = await this.prisma.user.findFirst({
      where: { email, workspaceId },
      include: {
        createdPortals: true,
        shareLinks: true,
        alerts: true,
        scheduledReports: true,
        webhooks: true,
        comments: true,
        auditLogs: true,
      },
    });

    const consents = await this.prisma.gDPRConsent.findMany({
      where: { subjectEmail: email, workspaceId },
    });

    const dataRequests = await this.prisma.gDPRDataRequest.findMany({
      where: { requesterEmail: email, workspaceId },
    });

    return {
      user,
      consents,
      dataRequests,
      exportDate: new Date().toISOString(),
    };
  }

  private async generateDataExport(_userData: any): Promise<string> {
    // In production, this would:
    // 1. Create a JSON/CSV file
    // 2. Upload to S3/R2
    // 3. Return download URL
    // For now, we'll simulate with a placeholder
    return `https://exports.example.com/data-${Date.now()}.json`;
  }

  private async deleteOrAnonymizeUserData(workspaceId: string, email: string) {
    const user = await this.prisma.user.findFirst({
      where: { email, workspaceId },
    });

    if (!user) {
      return { deleted: 0, anonymized: 0, retained: {} };
    }

    // Anonymize user data (replace with generic values)
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@anonymized.local`,
        firstName: 'Deleted',
        lastName: 'User',
        name: 'Deleted User',
        avatar: null,
        googleId: null,
        githubId: null,
        firebaseUid: null,
      },
    });

    // Delete consents
    const deletedConsents = await this.prisma.gDPRConsent.deleteMany({
      where: { subjectEmail: email, workspaceId },
    });

    // Anonymize comments
    await this.prisma.comment.updateMany({
      where: { authorId: user.id },
      data: {
        content: '[Content deleted by user request]',
      },
    });

    // Some data may need to be retained for legal/accounting reasons
    const retained = {
      auditLogs: 'Retained for 7 years for compliance',
      financialRecords: 'Retained for tax purposes',
    };

    return {
      deleted: deletedConsents.count,
      anonymized: 1,
      retained,
    };
  }

  private async addAuditTrailEntry(
    requestId: string,
    data: {
      action: string;
      performedBy?: string;
      details?: any;
    },
  ) {
    return this.prisma.gDPRDataRequestAudit.create({
      data: {
        requestId,
        action: data.action,
        performedBy: data.performedBy,
        details: data.details as Prisma.InputJsonValue,
      },
    });
  }

  async getConsentStats(workspaceId: string) {
    const consents = await this.prisma.gDPRConsent.findMany({
      where: { workspaceId },
    });

    const total = consents.length;
    const active = consents.filter(
      (c) => c.consented && (!c.expiresAt || c.expiresAt > new Date()),
    ).length;
    const revoked = consents.filter((c) => c.revokedAt !== null).length;
    const expired = consents.filter((c) => c.expiresAt && c.expiresAt <= new Date()).length;

    const byType: Record<string, number> = {};
    consents.forEach((c) => {
      byType[c.consentType] = (byType[c.consentType] || 0) + 1;
    });

    return {
      total,
      active,
      revoked,
      expired,
      byType,
    };
  }

  async getDataRequestStats(workspaceId: string) {
    const requests = await this.prisma.gDPRDataRequest.findMany({
      where: { workspaceId },
    });

    const total = requests.length;
    const byStatus: Record<string, number> = {};
    const byType: Record<string, number> = {};

    requests.forEach((r) => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.requestType] = (byType[r.requestType] || 0) + 1;
    });

    // Calculate average response time for completed requests
    const completedRequests = requests.filter(
      (r) => r.status === GDPRRequestStatus.COMPLETED && r.processedAt,
    );

    const avgResponseTimeHours =
      completedRequests.length > 0
        ? completedRequests.reduce((sum, r) => {
            const hours = (r.processedAt.getTime() - r.submittedAt.getTime()) / (1000 * 60 * 60);
            return sum + hours;
          }, 0) / completedRequests.length
        : 0;

    return {
      total,
      byStatus,
      byType,
      avgResponseTimeHours: parseFloat(avgResponseTimeHours.toFixed(2)),
    };
  }
}
