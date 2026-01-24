import { Controller, Post, Get, Body, Param, Query, UseGuards } from '@nestjs/common';
import { IntegrationBuilderService } from './integration-builder.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('integration-builder')
@UseGuards(JwtAuthGuard)
export class IntegrationBuilderController {
  constructor(private readonly integrationBuilderService: IntegrationBuilderService) {}

  @Post('integrations')
  async createIntegration(@Body() body: { workspaceId: string; integration: any }) {
    return await this.integrationBuilderService.createIntegration(
      body.workspaceId,
      body.integration,
    );
  }

  @Post('integrations/import-openapi')
  async importFromOpenAPI(@Body() body: { workspaceId: string; openAPISpec: any; name: string }) {
    return await this.integrationBuilderService.importFromOpenAPI(
      body.workspaceId,
      body.openAPISpec,
      body.name,
    );
  }

  @Post('integrations/:id/oauth2')
  async setupOAuth2(@Param('id') integrationId: string, @Body() oauth2Config: any) {
    const authUrl = await this.integrationBuilderService.setupOAuth2(integrationId, oauth2Config);
    return { authUrl };
  }

  @Post('integrations/:id/oauth2/callback')
  async handleOAuth2Callback(@Param('id') integrationId: string, @Body() body: { code: string }) {
    return await this.integrationBuilderService.handleOAuth2Callback(integrationId, body.code);
  }

  @Post('integrations/:id/transformations')
  async addTransformation(@Param('id') integrationId: string, @Body() transformation: any) {
    return await this.integrationBuilderService.addTransformation(integrationId, transformation);
  }

  @Post('integrations/:id/widgets')
  async createCustomWidget(@Param('id') integrationId: string, @Body() widget: any) {
    return await this.integrationBuilderService.createCustomWidget(integrationId, widget);
  }

  @Post('integrations/:id/test/:endpointId')
  async testEndpoint(
    @Param('id') integrationId: string,
    @Param('endpointId') endpointId: string,
    @Body() testData?: any,
  ) {
    return await this.integrationBuilderService.testEndpoint(integrationId, endpointId, testData);
  }

  @Post('integrations/:id/execute/:endpointId')
  async executeIntegration(
    @Param('id') integrationId: string,
    @Param('endpointId') endpointId: string,
    @Body() params?: any,
  ) {
    return await this.integrationBuilderService.executeIntegration(
      integrationId,
      endpointId,
      params,
    );
  }

  @Get('integrations/:id')
  async getIntegration(@Param('id') integrationId: string) {
    return await this.integrationBuilderService.getIntegration(integrationId);
  }

  @Get('integrations')
  async listIntegrations(@Query('workspaceId') workspaceId: string) {
    return await this.integrationBuilderService.listIntegrations(workspaceId);
  }
}
