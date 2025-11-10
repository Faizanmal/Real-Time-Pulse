import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiResponse,
} from '@nestjs/swagger';
import { IntegrationService } from './integration.service';
import type { IntegrationConfig } from './integration.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Integrations')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('v1/integrations')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new integration' })
  @ApiResponse({ status: 201, description: 'Integration created successfully' })
  async createIntegration(@Body() config: IntegrationConfig) {
    return this.integrationService.createIntegration(config);
  }

  @Get('workspace/:workspaceId')
  @ApiOperation({ summary: 'Get all integrations for a workspace' })
  @ApiResponse({
    status: 200,
    description: 'Integrations retrieved successfully',
  })
  async getIntegrations(@Param('workspaceId') workspaceId: string) {
    return this.integrationService.getIntegrations(workspaceId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific integration' })
  @ApiResponse({
    status: 200,
    description: 'Integration retrieved successfully',
  })
  async getIntegration(@Param('id') id: string) {
    return this.integrationService.getIntegration(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update integration settings' })
  @ApiResponse({ status: 200, description: 'Integration updated successfully' })
  async updateIntegration(
    @Param('id') id: string,
    @Body() settings: Record<string, any>,
  ) {
    return this.integrationService.updateIntegration(id, settings);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete an integration' })
  @ApiResponse({ status: 200, description: 'Integration deleted successfully' })
  async deleteIntegration(@Param('id') id: string) {
    return this.integrationService.deleteIntegration(id);
  }

  @Post(':id/sync')
  @ApiOperation({ summary: 'Trigger data sync for an integration' })
  @ApiResponse({ status: 200, description: 'Sync triggered successfully' })
  async triggerSync(
    @Param('id') id: string,
    @Body() body: { syncType?: 'full' | 'incremental' },
  ) {
    return this.integrationService.triggerSync(id, body.syncType);
  }

  @Get(':id/test')
  @ApiOperation({ summary: 'Test integration connection' })
  @ApiResponse({ status: 200, description: 'Connection test completed' })
  async testConnection(@Param('id') id: string) {
    return this.integrationService.testConnection(id);
  }

  @Post(':id/fetch')
  @ApiOperation({ summary: 'Fetch data from integration' })
  @ApiResponse({ status: 200, description: 'Data fetched successfully' })
  async fetchData(
    @Param('id') id: string,

    @Body() body: { dataType: string; params?: any },
  ): Promise<unknown> {
    return this.integrationService.fetchData(id, body.dataType, body.params);
  }
}
