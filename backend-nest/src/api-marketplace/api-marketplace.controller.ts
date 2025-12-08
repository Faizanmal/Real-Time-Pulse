import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiMarketplaceService } from './api-marketplace.service';
import { CustomEndpointService } from './custom-endpoint.service';
import { EndpointBuilderService } from './endpoint-builder.service';
import type { BuilderStep } from './endpoint-builder.service';

@ApiTags('API Marketplace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-marketplace')
export class ApiMarketplaceController {
  constructor(
    private readonly marketplaceService: ApiMarketplaceService,
    private readonly endpointService: CustomEndpointService,
    private readonly builderService: EndpointBuilderService,
  ) {}

  // Marketplace Connectors

  @Get('connectors')
  @ApiOperation({ summary: 'Get marketplace connectors' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'verified', required: false, type: Boolean })
  async getConnectors(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('verified') verified?: string,
  ) {
    return this.marketplaceService.getMarketplaceConnectors({
      category,
      search,
      verified:
        verified === 'true' ? true : verified === 'false' ? false : undefined,
    });
  }

  @Get('connectors/categories')
  @ApiOperation({ summary: 'Get connector categories' })
  async getCategories() {
    return this.marketplaceService.getCategories();
  }

  @Get('connectors/:connectorId')
  @ApiOperation({ summary: 'Get connector by ID' })
  @ApiParam({ name: 'connectorId', description: 'Connector ID' })
  async getConnector(@Param('connectorId') connectorId: string) {
    return this.marketplaceService.getConnector(connectorId);
  }

  @Post('connectors/:connectorId/install')
  @ApiOperation({ summary: 'Install connector' })
  @ApiParam({ name: 'connectorId', description: 'Connector ID' })
  async installConnector(
    @Request() req: any,
    @Param('connectorId') connectorId: string,
    @Body()
    dto: { config: Record<string, any>; credentials?: Record<string, any> },
  ) {
    return this.marketplaceService.installConnector(
      req.user.workspaceId,
      connectorId,
      dto.config,
      dto.credentials,
    );
  }

  @Get('installed')
  @ApiOperation({ summary: 'Get installed connectors' })
  async getInstalledConnectors(@Request() req: any) {
    return this.marketplaceService.getInstalledConnectors(req.user.workspaceId);
  }

  @Delete('installed/:installationId')
  @ApiOperation({ summary: 'Uninstall connector' })
  @ApiParam({ name: 'installationId', description: 'Installation ID' })
  async uninstallConnector(
    @Request() req: any,
    @Param('installationId') installationId: string,
  ) {
    await this.marketplaceService.uninstallConnector(
      req.user.workspaceId,
      installationId,
    );
    return { success: true };
  }

  @Put('installed/:installationId/config')
  @ApiOperation({ summary: 'Update connector configuration' })
  @ApiParam({ name: 'installationId', description: 'Installation ID' })
  async updateConnectorConfig(
    @Request() req: any,
    @Param('installationId') installationId: string,
    @Body() dto: { config: Record<string, any> },
  ) {
    return this.marketplaceService.updateConnectorConfig(
      req.user.workspaceId,
      installationId,
      dto.config,
    );
  }

  @Post('connectors/publish')
  @ApiOperation({ summary: 'Publish custom connector to marketplace' })
  async publishConnector(@Body() dto: any) {
    return this.marketplaceService.publishConnector(dto);
  }

  // Custom Endpoints

  @Post('endpoints')
  @ApiOperation({ summary: 'Create custom API endpoint' })
  async createEndpoint(
    @Request() req: any,
    @Body()
    dto: {
      name: string;
      description?: string;
      method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
      path: string;
      authentication: 'none' | 'api_key' | 'bearer' | 'workspace';
      parameters?: any[];
      dataSource: {
        type: 'query' | 'portal' | 'widget' | 'connector';
        sourceId: string;
        config?: any;
      };
      rateLimit?: { requests: number; windowMs: number };
      caching?: { enabled: boolean; ttlSeconds: number };
    },
  ) {
    return this.endpointService.createEndpoint(req.user.workspaceId, dto);
  }

  @Get('endpoints')
  @ApiOperation({ summary: 'Get custom endpoints' })
  async getEndpoints(@Request() req: any) {
    return this.endpointService.getEndpoints(req.user.workspaceId);
  }

  @Get('endpoints/:endpointId')
  @ApiOperation({ summary: 'Get endpoint by ID' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async getEndpoint(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpointService.getEndpoint(req.user.workspaceId, endpointId);
  }

  @Put('endpoints/:endpointId')
  @ApiOperation({ summary: 'Update endpoint' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async updateEndpoint(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
    @Body() dto: any,
  ) {
    return this.endpointService.updateEndpoint(
      req.user.workspaceId,
      endpointId,
      dto,
    );
  }

  @Delete('endpoints/:endpointId')
  @ApiOperation({ summary: 'Delete endpoint' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async deleteEndpoint(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
  ) {
    await this.endpointService.deleteEndpoint(req.user.workspaceId, endpointId);
    return { success: true };
  }

  @Post('endpoints/:endpointId/activate')
  @ApiOperation({ summary: 'Activate endpoint' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async activateEndpoint(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpointService.activateEndpoint(
      req.user.workspaceId,
      endpointId,
    );
  }

  @Post('endpoints/:endpointId/deactivate')
  @ApiOperation({ summary: 'Deactivate endpoint' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async deactivateEndpoint(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
  ) {
    return this.endpointService.deactivateEndpoint(
      req.user.workspaceId,
      endpointId,
    );
  }

  @Post('endpoints/:endpointId/regenerate-key')
  @ApiOperation({ summary: 'Regenerate API key' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async regenerateApiKey(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
  ) {
    const apiKey = await this.endpointService.regenerateApiKey(
      req.user.workspaceId,
      endpointId,
    );
    return { apiKey };
  }

  @Post('endpoints/:endpointId/execute')
  @ApiOperation({ summary: 'Execute custom endpoint' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  async executeEndpoint(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
    @Body() params: Record<string, any>,
  ) {
    return this.endpointService.executeEndpoint(
      req.user.workspaceId,
      endpointId,
      params,
    );
  }

  @Get('endpoints/:endpointId/stats')
  @ApiOperation({ summary: 'Get endpoint usage statistics' })
  @ApiParam({ name: 'endpointId', description: 'Endpoint ID' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  async getEndpointStats(
    @Request() req: any,
    @Param('endpointId') endpointId: string,
    @Query('days') days?: string,
  ) {
    return this.endpointService.getUsageStats(
      req.user.workspaceId,
      endpointId,
      days ? parseInt(days, 10) : 7,
    );
  }

  // Endpoint Builder

  @Get('builder/init')
  @ApiOperation({ summary: 'Initialize endpoint builder' })
  initBuilder() {
    return this.builderService.initializeBuilder();
  }

  @Post('builder/validate')
  @ApiOperation({ summary: 'Validate builder step' })
  validateStep(@Body() step: BuilderStep) {
    return this.builderService.validateStep(step);
  }

  @Post('builder/build')
  @ApiOperation({ summary: 'Build endpoint from steps' })
  buildEndpoint(@Body() steps: BuilderStep[]) {
    return this.builderService.buildEndpoint(steps);
  }

  @Post('builder/openapi')
  @ApiOperation({ summary: 'Generate OpenAPI spec for endpoint' })
  generateOpenAPI(@Body() endpoint: any) {
    return this.builderService.generateOpenAPISpec(endpoint);
  }

  @Post('builder/code-samples')
  @ApiOperation({ summary: 'Generate code samples' })
  generateCodeSamples(
    @Body() dto: { endpoint: any; baseUrl: string; apiKey?: string },
  ) {
    return this.builderService.generateCodeSamples(
      dto.endpoint,
      dto.baseUrl,
      dto.apiKey,
    );
  }

  @Get('builder/data-sources')
  @ApiOperation({ summary: 'Get available data sources' })
  getDataSources() {
    return this.builderService.getAvailableDataSources();
  }
}
