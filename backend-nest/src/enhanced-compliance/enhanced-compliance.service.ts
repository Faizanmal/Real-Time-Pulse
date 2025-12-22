import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ComplianceStatus, DataSensitivity, IncidentSeverity, IncidentCategory, IncidentStatus } from '@prisma/client';

@Injectable()
export class EnhancedComplianceService {
  constructor(private prisma: PrismaService) {}

  // Compliance Frameworks
  async getFrameworks() {
    return this.prisma.complianceFramework.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getFramework(id: string) {
    const framework = await this.prisma.complianceFramework.findUnique({
      where: { id },
    });

    if (!framework) {
      throw new NotFoundException('Compliance framework not found');
    }

    return framework;
  }

  async createFramework(data: {
    name: string;
    description?: string;
    requirements: any;
    controls: any;
    auditSchedule?: string;
  }) {
    return this.prisma.complianceFramework.create({
      data,
    });
  }

  // Compliance Assessments
  async createAssessment(
    workspaceId: string,
    frameworkId: string,
    assessedBy: string,
  ) {
    const framework = await this.getFramework(frameworkId);

    // Perform assessment
    const assessmentResults = await this.performAssessment(workspaceId, framework);

    return this.prisma.complianceAssessment.create({
      data: {
        workspaceId,
        frameworkId,
        status: assessmentResults.status,
        score: assessmentResults.score,
        findings: assessmentResults.findings,
        gaps: assessmentResults.gaps,
        recommendations: assessmentResults.recommendations,
        assessedBy,
        nextAssessmentDue: this.calculateNextAssessment(framework.auditSchedule),
      },
      include: {
        framework: true,
      },
    });
  }

  async getAssessments(workspaceId: string, frameworkId?: string) {
    return this.prisma.complianceAssessment.findMany({
      where: {
        workspaceId,
        ...(frameworkId && { frameworkId }),
      },
      include: {
        framework: true,
      },
      orderBy: { assessedAt: 'desc' },
    });
  }

  async getAssessment(id: string, workspaceId: string) {
    const assessment = await this.prisma.complianceAssessment.findFirst({
      where: {
        id,
        workspaceId,
      },
      include: {
        framework: true,
      },
    });

    if (!assessment) {
      throw new NotFoundException('Assessment not found');
    }

    return assessment;
  }

  async updateRemediationPlan(
    assessmentId: string,
    workspaceId: string,
    remediationPlan: any,
    remediationStatus: string,
  ) {
    await this.getAssessment(assessmentId, workspaceId);

    return this.prisma.complianceAssessment.update({
      where: { id: assessmentId },
      data: {
        remediationPlan,
        remediationStatus,
      },
    });
  }

  // Data Mapping
  async createDataMapping(workspaceId: string, data: {
    dataType: string;
    location: string;
    fields: any;
    sensitivity: DataSensitivity;
    category: string;
    processingPurpose: string;
    legalBasis?: string;
    retentionPeriod?: string;
    encryptionMethod?: string;
    accessControls?: any;
  }) {
    return this.prisma.dataMapping.create({
      data: {
        workspaceId,
        ...data,
      },
    });
  }

  async getDataMappings(workspaceId: string, sensitivity?: DataSensitivity) {
    return this.prisma.dataMapping.findMany({
      where: {
        workspaceId,
        ...(sensitivity && { sensitivity }),
      },
      orderBy: [
        { sensitivity: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  async getDataMapping(id: string, workspaceId: string) {
    const mapping = await this.prisma.dataMapping.findFirst({
      where: {
        id,
        workspaceId,
      },
    });

    if (!mapping) {
      throw new NotFoundException('Data mapping not found');
    }

    return mapping;
  }

  async updateDataMapping(id: string, workspaceId: string, data: any) {
    await this.getDataMapping(id, workspaceId);

    return this.prisma.dataMapping.update({
      where: { id },
      data,
    });
  }

  async deleteDataMapping(id: string, workspaceId: string) {
    await this.getDataMapping(id, workspaceId);

    return this.prisma.dataMapping.delete({
      where: { id },
    });
  }

  // Security Incidents
  async createIncident(workspaceId: string, data: {
    title: string;
    description: string;
    severity: IncidentSeverity;
    category: IncidentCategory;
    affectedSystems?: any;
    affectedUsers?: any;
    assignedTo?: string;
  }) {
    return this.prisma.securityIncident.create({
      data: {
        workspaceId,
        status: IncidentStatus.DETECTED,
        ...data,
      },
    });
  }

  async getIncidents(workspaceId: string, filters?: {
    severity?: IncidentSeverity;
    status?: IncidentStatus;
    category?: IncidentCategory;
  }) {
    return this.prisma.securityIncident.findMany({
      where: {
        workspaceId,
        ...filters,
      },
      orderBy: [
        { severity: 'desc' },
        { detectedAt: 'desc' },
      ],
    });
  }

  async getIncident(id: string, workspaceId: string) {
    const incident = await this.prisma.securityIncident.findFirst({
      where: {
        id,
        workspaceId,
      },
    });

    if (!incident) {
      throw new NotFoundException('Security incident not found');
    }

    return incident;
  }

  async updateIncident(id: string, workspaceId: string, data: any) {
    await this.getIncident(id, workspaceId);

    const updates: any = { ...data };

    // Auto-set timestamps based on status changes
    if (data.status === IncidentStatus.INVESTIGATING && !data.reportedAt) {
      updates.reportedAt = new Date();
    } else if (data.status === IncidentStatus.RESOLVED && !data.resolvedAt) {
      updates.resolvedAt = new Date();
    }

    return this.prisma.securityIncident.update({
      where: { id },
      data: updates,
    });
  }

  // Compliance Dashboard
  async getComplianceDashboard(workspaceId: string) {
    const [assessments, incidents, mappings] = await Promise.all([
      this.getAssessments(workspaceId),
      this.getIncidents(workspaceId),
      this.getDataMappings(workspaceId),
    ]);

    const recentAssessment = assessments[0];
    const criticalIncidents = incidents.filter(i => 
      i.severity === IncidentSeverity.CRITICAL && 
      i.status !== IncidentStatus.CLOSED
    );
    const openIncidents = incidents.filter(i => 
      i.status !== IncidentStatus.CLOSED && 
      i.status !== IncidentStatus.RESOLVED
    );

    const sensitiveData = mappings.filter(m => 
      m.sensitivity === DataSensitivity.RESTRICTED || 
      m.sensitivity === DataSensitivity.CONFIDENTIAL
    );

    return {
      overview: {
        complianceScore: recentAssessment?.score || 0,
        complianceStatus: recentAssessment?.status || ComplianceStatus.NOT_ASSESSED,
        lastAssessment: recentAssessment?.assessedAt,
        nextAssessment: recentAssessment?.nextAssessmentDue,
      },
      incidents: {
        total: incidents.length,
        open: openIncidents.length,
        critical: criticalIncidents.length,
        recent: incidents.slice(0, 5),
      },
      dataInventory: {
        total: mappings.length,
        sensitive: sensitiveData.length,
        byCategory: this.groupByCategory(mappings),
        bySensitivity: this.groupBySensitivity(mappings),
      },
      frameworks: await this.getFrameworks(),
    };
  }

  // Private helper methods
  private async performAssessment(workspaceId: string, framework: any) {
    // Simulate compliance assessment
    // In production, implement actual compliance checks
    
    const requirements = framework.requirements as any[];
    const findings: any[] = [];
    const gaps: any[] = [];
    const recommendations: any[] = [];
    
    let passedChecks = 0;
    const totalChecks = requirements.length;

    for (const requirement of requirements) {
      // Simulate check
      const passed = Math.random() > 0.3; // 70% pass rate for demo
      
      if (passed) {
        passedChecks++;
        findings.push({
          requirement: requirement.id,
          status: 'PASS',
          notes: 'Requirement met',
        });
      } else {
        gaps.push({
          requirement: requirement.id,
          severity: 'MEDIUM',
          description: `Requirement ${requirement.id} not fully implemented`,
        });
        
        recommendations.push({
          requirement: requirement.id,
          action: `Implement ${requirement.name}`,
          priority: 'HIGH',
        });
      }
    }

    const score = (passedChecks / totalChecks) * 100;
    
    let status: ComplianceStatus;
    if (score >= 90) status = ComplianceStatus.COMPLIANT;
    else if (score >= 70) status = ComplianceStatus.PARTIALLY_COMPLIANT;
    else status = ComplianceStatus.NON_COMPLIANT;

    return {
      status,
      score: Math.round(score * 10) / 10,
      findings,
      gaps,
      recommendations,
    };
  }

  private calculateNextAssessment(auditSchedule?: string): Date {
    // Default to quarterly assessments
    const monthsToAdd = 3;
    const nextDate = new Date();
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd);
    return nextDate;
  }

  private groupByCategory(mappings: any[]): Record<string, number> {
    return mappings.reduce((acc, mapping) => {
      acc[mapping.category] = (acc[mapping.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupBySensitivity(mappings: any[]): Record<string, number> {
    return mappings.reduce((acc, mapping) => {
      acc[mapping.sensitivity] = (acc[mapping.sensitivity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }
}
