import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { TemplatesService } from './templates.service';
import { RequestUser } from '../common/interfaces/auth.interface';
import { TemplateCategory } from '@prisma/client';
import {
  CreateWidgetTemplateDto,
  UpdateWidgetTemplateDto,
  CreatePortalTemplateDto,
  UpdatePortalTemplateDto,
  CreatePortalFromTemplateDto,
} from './dto/template.dto';
// import { TemplateCategory } from '@prisma/client';

@ApiTags('Templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // ============================================
  // Widget Templates
  // ============================================

  @Post('widgets')
  @ApiOperation({ summary: 'Create a widget template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createWidgetTemplate(
    @Request() req: { user: RequestUser },
    @Body() dto: CreateWidgetTemplateDto,
  ) {
    return this.templatesService.createWidgetTemplate(req.user.workspaceId, req.user.id, dto);
  }

  @Get('widgets')
  @ApiOperation({ summary: 'Get widget templates' })
  @ApiResponse({ status: 200, description: 'Returns widget templates' })
  async findWidgetTemplates(
    @Request() req: { user: RequestUser },
    @Query('category') category?: TemplateCategory,
    @Query('widgetType') widgetType?: string,
    @Query('search') search?: string,
    @Query('publicOnly') publicOnly?: boolean,
  ) {
    return this.templatesService.findWidgetTemplates(req.user.workspaceId, {
      category,
      widgetType,
      search,
      publicOnly,
    });
  }

  @Get('widgets/:id')
  @ApiOperation({ summary: 'Get a widget template' })
  @ApiResponse({ status: 200, description: 'Returns the widget template' })
  async findWidgetTemplate(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.templatesService.findWidgetTemplate(id, req.user.workspaceId);
  }

  @Patch('widgets/:id')
  @ApiOperation({ summary: 'Update a widget template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updateWidgetTemplate(
    @Request() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: UpdateWidgetTemplateDto,
  ) {
    return this.templatesService.updateWidgetTemplate(id, req.user.workspaceId, dto);
  }

  @Delete('widgets/:id')
  @ApiOperation({ summary: 'Delete a widget template' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deleteWidgetTemplate(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.templatesService.deleteWidgetTemplate(id, req.user.workspaceId);
  }

  @Post('widgets/:id/use')
  @ApiOperation({ summary: 'Use a widget template (get config)' })
  @ApiResponse({ status: 200, description: 'Returns template configuration' })
  async useWidgetTemplate(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.templatesService.useWidgetTemplate(id, req.user.workspaceId);
  }

  // ============================================
  // Portal Templates
  // ============================================

  @Post('portals')
  @ApiOperation({ summary: 'Create a portal template' })
  @ApiResponse({ status: 201, description: 'Template created successfully' })
  async createPortalTemplate(
    @Request() req: { user: RequestUser },
    @Body() dto: CreatePortalTemplateDto,
  ) {
    return this.templatesService.createPortalTemplate(req.user.workspaceId, req.user.id, dto);
  }

  @Get('portals')
  @ApiOperation({ summary: 'Get portal templates' })
  @ApiResponse({ status: 200, description: 'Returns portal templates' })
  async findPortalTemplates(
    @Request() req: { user: RequestUser },
    @Query('category') category?: TemplateCategory,
    @Query('search') search?: string,
    @Query('publicOnly') publicOnly?: boolean,
  ) {
    return this.templatesService.findPortalTemplates(req.user.workspaceId, {
      category,
      search,
      publicOnly,
    });
  }

  @Get('portals/:id')
  @ApiOperation({ summary: 'Get a portal template' })
  @ApiResponse({ status: 200, description: 'Returns the portal template' })
  async findPortalTemplate(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.templatesService.findPortalTemplate(id, req.user.workspaceId);
  }

  @Patch('portals/:id')
  @ApiOperation({ summary: 'Update a portal template' })
  @ApiResponse({ status: 200, description: 'Template updated successfully' })
  async updatePortalTemplate(
    @Request() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: UpdatePortalTemplateDto,
  ) {
    return this.templatesService.updatePortalTemplate(id, req.user.workspaceId, dto);
  }

  @Delete('portals/:id')
  @ApiOperation({ summary: 'Delete a portal template' })
  @ApiResponse({ status: 200, description: 'Template deleted successfully' })
  async deletePortalTemplate(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.templatesService.deletePortalTemplate(id, req.user.workspaceId);
  }

  @Post('portals/:id/use')
  @ApiOperation({ summary: 'Use a portal template (get config)' })
  @ApiResponse({ status: 200, description: 'Returns template configuration' })
  async usePortalTemplate(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.templatesService.usePortalTemplate(id, req.user.workspaceId);
  }

  @Post('portals/:id/create')
  @ApiOperation({ summary: 'Create a new portal from template' })
  @ApiResponse({ status: 201, description: 'Portal created from template' })
  async createPortalFromTemplate(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: CreatePortalFromTemplateDto,
  ) {
    return this.templatesService.createPortalFromTemplate(
      id,
      req.user.workspaceId,
      req.user.id,
      dto,
    );
  }

  // ============================================
  // Categories
  // ============================================

  @Get('categories')
  @ApiOperation({ summary: 'Get template categories with counts' })
  @ApiResponse({ status: 200, description: 'Returns categories' })
  async getCategories() {
    return this.templatesService.getCategories();
  }
}
