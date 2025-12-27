import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  Patch,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IndustrySolutionsService } from './industry-solutions.service';
import { IndustryType } from '@prisma/client';

@Controller('industry-solutions')
@UseGuards(JwtAuthGuard)
export class IndustrySolutionsController {
  constructor(
    private readonly industrySolutionsService: IndustrySolutionsService,
  ) {}

  @Get('templates')
  async getTemplates(@Query('industry') industry?: IndustryType) {
    return this.industrySolutionsService.getTemplates(industry);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.industrySolutionsService.getTemplate(id);
  }

  @Post('templates')
  async createTemplate(
    @Body()
    data: {
      name: string;
      description?: string;
      industry: IndustryType;
      config: any;
      thumbnail?: string;
    },
  ) {
    return this.industrySolutionsService.createTemplate(data);
  }

  @Post('templates/:id/deploy')
  async deployTemplate(
    @Param('id') templateId: string,
    @Req() req: any,
    @Body()
    data: {
      portalId: string;
      customizations?: any;
    },
  ) {
    return this.industrySolutionsService.deployTemplate(
      templateId,
      req.user.workspaceId,
      data.portalId,
      data.customizations,
    );
  }

  @Get('deployments')
  async getDeployments(@Req() req: any) {
    return this.industrySolutionsService.getDeployments(req.user.workspaceId);
  }

  @Patch('deployments/:id/compliance')
  async updateComplianceStatus(
    @Param('id') deploymentId: string,
    @Req() req: any,
    @Body() data: { complianceStatus: any },
  ) {
    return this.industrySolutionsService.updateComplianceStatus(
      deploymentId,
      req.user.workspaceId,
      data.complianceStatus,
    );
  }

  @Get('deployments/:id/compliance')
  async getComplianceCheck(@Param('id') deploymentId: string, @Req() req: any) {
    return this.industrySolutionsService.getComplianceCheck(
      deploymentId,
      req.user.workspaceId,
    );
  }

  @Get('healthcare/templates')
  async getHealthcareTemplates() {
    return this.industrySolutionsService.getHealthcareTemplates();
  }

  @Post('healthcare/dashboard')
  async createHealthcareDashboard(@Req() req: any, @Body() portalData: any) {
    return this.industrySolutionsService.createHealthcareDashboard(
      req.user.workspaceId,
      portalData,
    );
  }

  @Post('templates/:id/rate')
  async rateTemplate(
    @Param('id') templateId: string,
    @Body() data: { rating: number },
  ) {
    return this.industrySolutionsService.rateTemplate(templateId, data.rating);
  }
}
