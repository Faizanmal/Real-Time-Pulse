import {
  ForbiddenException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import { IntegrationService } from './integration.service';
import type { IntegrationConfig } from './integration.service';

@ApiTags('Integrations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard, AgencyRoleGuard)
@Controller('integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  async createIntegration(@Body() config: IntegrationConfig, @CurrentUser() user: RequestUser) {
    return this.integrationService.createIntegration({ ...config, workspaceId: user.workspaceId });
  }

  @Post('demo')
  @ApiOperation({ summary: 'Create or reuse this workspace’s fictional demo connector' })
  async createDemoIntegration(@CurrentUser() user: RequestUser) {
    return this.integrationService.createDemoIntegration(user.workspaceId);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all integrations for a workspace' })
  @ApiResponse({
    status: 200,
    description: 'Integrations retrieved successfully',
  })
  async getIntegrations(@Param('workspaceId') workspaceId: string, @CurrentUser() user: RequestUser) {
    if (workspaceId !== user.workspaceId) throw new ForbiddenException('Access denied to this workspace');
    return this.integrationService.getIntegrations(user.workspaceId);
  }

  @Get('workspace/:workspaceId/sync-freshness')
  @ApiOperation({ summary: 'Get workspace-scoped connector freshness and sync queue metrics' })
  async getSyncFreshness(@Param('workspaceId') workspaceId: string, @CurrentUser() user: RequestUser) {
    if (workspaceId !== user.workspaceId) throw new ForbiddenException('Access denied to this workspace');
    return this.integrationService.getSyncFreshness(user.workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific integration' })
  @ApiResponse({
    status: 200,
    description: 'Integration retrieved successfully',
  })
  async getIntegration(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.getIntegration(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update integration settings' })
  @ApiResponse({ status: 200, description: 'Integration updated successfully' })
  async updateIntegration(@Param('id') id: string, @Body() settings: Record<string, any>, @CurrentUser() user: RequestUser) {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.updateIntegration(id, settings);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an integration' })
  @ApiResponse({ status: 200, description: 'Integration deleted successfully' })
  async deleteIntegration(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.deleteIntegration(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger data sync for an integration' })
  @ApiResponse({ status: 200, description: 'Sync triggered successfully' })
  async triggerSync(@Param('id') id: string, @Body() body: { syncType?: 'full' | 'incremental'; dryRun?: boolean; requestId?: string }, @CurrentUser() user: RequestUser) {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.triggerSync(id, body.syncType, body.dryRun === true, body.requestId);
  }

  @Post(':id/refresh')
  @ApiOperation({ summary: 'Refresh provider authorization without returning credentials' })
  async refreshToken(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.refreshToken(id);
  }

  @Get(':id/test')
  @ApiOperation({ summary: 'Test integration connection' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  async testConnection(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.testConnection(id);
  }

  @Post(':id/fetch')
  @ApiOperation({ summary: 'Fetch data from integration' })
  @ApiResponse({ status: 200, description: 'Data fetched successfully' })
  async fetchData(
    @Param('id') id: string,

    @Body() body: { dataType: string; params?: any },
    @CurrentUser() user: RequestUser,
  ): Promise<unknown> {
    await this.integrationService.assertWorkspaceAccess(id, user.workspaceId);
    return this.integrationService.fetchData(id, body.dataType, body.params);
  }
}
