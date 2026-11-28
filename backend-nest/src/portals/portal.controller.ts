import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AgencyRoleGuard } from '../auth/guards/agency-role.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import { CreatePortalDto, PublicPortalViewDto, PublishPortalDto, UpdatePortalDto } from './dto/portal.dto';
import { PortalService } from './portal.service';

@Controller('portals')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  @Post('demo')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async createDemoClientPortal(@CurrentUser() user: RequestUser) {
    return this.portalService.createDemoClientPortal(user.workspaceId, user.id);
  }

  /**
   * Create a new portal
   */
  @Post()
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreatePortalDto) {
    return this.portalService.create(user.workspaceId, user.id, dto);
  }

  /**
   * Get all portals for authenticated user's workspace
   */
  @Get()
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? Number(page) : 1;
    const size = pageSize ? Number(pageSize) : 20;
    return this.portalService.findAll(user.workspaceId, user.id, pageNum, size);
  }

  @Get('attention')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async findAttention(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.portalService.findAttention(user.workspaceId, user.id, page ? Number(page) : 1, pageSize ? Number(pageSize) : 5);
  }

  @Post('bulk-unpublish')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async bulkUnpublish(@CurrentUser() user: RequestUser, @Body() body: { portalIds?: unknown }) {
    return this.portalService.bulkUnpublish(body?.portalIds as string[], user.workspaceId, user.id);
  }

  /**
   * Get portal by share token (public access - no auth required)
   */
  @Get('share/:shareToken')
  async findByShareToken(
    @Param('shareToken') shareToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicPortalViewDto> {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.portalService.findByShareToken(shareToken);
  }

  @Get('share/:shareToken/view')
  async findPublicView(
    @Param('shareToken') shareToken: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicPortalViewDto> {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.portalService.findPublicViewByShareToken(shareToken);
  }

  /**
   * Get a single portal by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portalService.findOne(id, user.workspaceId, user.id);
  }

  /**
   * Update a portal
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePortalDto,
  ) {
    return this.portalService.update(id, user.workspaceId, user.id, dto);
  }

  @Get(':id/preview')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async previewDraft(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portalService.previewDraft(id, user.workspaceId, user.id);
  }

  @Post(':id/publish')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async publishDraft(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: PublishPortalDto,
  ) {
    return this.portalService.publishDraft(id, user.workspaceId, user.id, dto);
  }

  @Post(':id/unpublish')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async unpublish(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portalService.unpublish(id, user.workspaceId, user.id);
  }

  /**
   * Delete a portal
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.portalService.remove(id, user.workspaceId, user.id);
  }

  /**
   * Regenerate share token for a portal
   */
  @Post(':id/regenerate-token')
  @UseGuards(JwtAuthGuard, AgencyRoleGuard)
  async regenerateToken(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portalService.regenerateShareToken(id, user.workspaceId, user.id);
  }
}
