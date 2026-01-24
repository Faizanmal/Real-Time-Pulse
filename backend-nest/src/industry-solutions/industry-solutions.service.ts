import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IndustryType } from '@prisma/client';

@Injectable()
export class IndustrySolutionsService {
  constructor(private prisma: PrismaService) {}

  // Get all industry templates
  async getTemplates(industry?: IndustryType) {
    return this.prisma.industryTemplate.findMany({
      where: {
        isActive: true,
        ...(industry && { industry }),
      },
      orderBy: [{ rating: 'desc' }, { usageCount: 'desc' }],
    });
  }

  // Get a specific template
  async getTemplate(id: string) {
    const template = await this.prisma.industryTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  // Create a new industry template
  async createTemplate(data: {
    name: string;
    description?: string;
    industry: IndustryType;
    config: any;
    thumbnail?: string;
  }) {
    return this.prisma.industryTemplate.create({
      data,
    });
  }

  // Deploy a template to a workspace
  async deployTemplate(
    templateId: string,
    workspaceId: string,
    portalId: string,
    customizations?: any,
  ) {
    await this.getTemplate(templateId);

    // Increment usage count
    await this.prisma.industryTemplate.update({
      where: { id: templateId },
      data: {
        usageCount: { increment: 1 },
      },
    });

    // Create deployment
    const deployment = await this.prisma.industryDeployment.create({
      data: {
        workspaceId,
        templateId,
        portalId,
        customizations,
      },
      include: {
        template: true,
        portal: true,
      },
    });

    return deployment;
  }

  // Get deployments for a workspace
  async getDeployments(workspaceId: string) {
    return this.prisma.industryDeployment.findMany({
      where: { workspaceId },
      include: {
        template: true,
        portal: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // Update compliance status for a deployment
  async updateComplianceStatus(deploymentId: string, workspaceId: string, complianceStatus: any) {
    const deployment = await this.prisma.industryDeployment.findFirst({
      where: {
        id: deploymentId,
        workspaceId,
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return this.prisma.industryDeployment.update({
      where: { id: deploymentId },
      data: {
        complianceStatus,
        lastComplianceCheck: new Date(),
      },
    });
  }

  // Get healthcare-specific templates
  async getHealthcareTemplates() {
    return this.getTemplates(IndustryType.HEALTHCARE);
  }

  // Create healthcare dashboard with HIPAA compliance
  async createHealthcareDashboard(workspaceId: string, portalData: any) {
    // Find healthcare template
    const templates = await this.getHealthcareTemplates();
    const template = templates[0];

    if (!template) {
      throw new NotFoundException('Healthcare template not found');
    }

    // Create portal with healthcare configuration
    const portal = await this.prisma.portal.create({
      data: {
        ...portalData,
        workspaceId,
      },
    });

    // Deploy template
    const deployment = await this.deployTemplate(template.id, workspaceId, portal.id, {
      hipaaCompliant: true,
      encryptionEnabled: true,
      auditLoggingEnabled: true,
    });

    return {
      portal,
      deployment,
    };
  }

  // Rate a template
  async rateTemplate(templateId: string, rating: number) {
    if (rating < 0 || rating > 5) {
      throw new BadRequestException('Rating must be between 0 and 5');
    }

    const template = await this.getTemplate(templateId);

    // Calculate new average rating (simple average for now)
    const newRating = template.rating === 0 ? rating : (template.rating + rating) / 2;

    return this.prisma.industryTemplate.update({
      where: { id: templateId },
      data: {
        rating: newRating,
      },
    });
  }

  // Get compliance check results
  async getComplianceCheck(deploymentId: string, workspaceId: string) {
    const deployment = await this.prisma.industryDeployment.findFirst({
      where: {
        id: deploymentId,
        workspaceId,
      },
      include: {
        template: true,
      },
    });

    if (!deployment) {
      throw new NotFoundException('Deployment not found');
    }

    return {
      deployment,
      complianceStatus: deployment.complianceStatus,
      lastCheck: deployment.lastComplianceCheck,
      recommendations: this.getComplianceRecommendations(deployment.template.industry),
    };
  }

  // Get compliance recommendations based on industry
  private getComplianceRecommendations(industry: IndustryType) {
    const recommendations: Record<IndustryType, string[]> = {
      [IndustryType.HEALTHCARE]: [
        'Enable end-to-end encryption for all PHI data',
        'Implement access controls with role-based permissions',
        'Enable comprehensive audit logging',
        'Conduct regular HIPAA compliance audits',
        'Implement data retention and disposal policies',
      ],
      [IndustryType.FINANCE]: [
        'Implement PCI-DSS compliant payment processing',
        'Enable multi-factor authentication',
        'Conduct regular security assessments',
        'Implement fraud detection mechanisms',
        'Ensure SOX compliance for financial reporting',
      ],
      [IndustryType.RETAIL]: [
        'Protect customer payment information',
        'Implement secure checkout processes',
        'Enable inventory tracking and auditing',
        'Comply with consumer protection regulations',
      ],
      [IndustryType.EDUCATION]: [
        'Comply with FERPA for student data',
        'Implement secure student information systems',
        'Enable parent/guardian access controls',
        'Protect student privacy',
      ],
      [IndustryType.GOVERNMENT]: [
        'Implement FedRAMP compliance measures',
        'Enable advanced security controls',
        'Conduct regular security audits',
        'Ensure data sovereignty',
      ],
      [IndustryType.MANUFACTURING]: [
        'Implement supply chain tracking',
        'Enable quality control monitoring',
        'Track production metrics',
        'Ensure safety compliance',
      ],
      [IndustryType.REAL_ESTATE]: [
        'Protect client financial information',
        'Enable document management and storage',
        'Track property transactions',
        'Comply with fair housing regulations',
      ],
      [IndustryType.LOGISTICS]: [
        'Enable real-time shipment tracking',
        'Implement route optimization',
        'Track delivery performance',
        'Ensure customs compliance',
      ],
      [IndustryType.HOSPITALITY]: [
        'Protect guest information',
        'Enable booking and reservation tracking',
        'Monitor occupancy and revenue',
        'Ensure health and safety compliance',
      ],
      [IndustryType.TECHNOLOGY]: [
        'Implement API security measures',
        'Enable performance monitoring',
        'Track SLA compliance',
        'Protect intellectual property',
      ],
    };

    return recommendations[industry] || [];
  }
}
