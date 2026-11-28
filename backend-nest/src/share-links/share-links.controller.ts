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
  Res,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import type { Response } from 'express';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import type { AuthenticatedRequest, RequestUser } from '../common/interfaces/auth.interface';

import { CreateShareLinkDto, UpdateShareLinkDto, AccessShareLinkDto, SharedCommentDto, ShareAccessRequestDto } from './dto/share-link.dto';
import { ShareLinksService } from './share-links.service';

@ApiTags('Share Links')
@Controller('share-links')
export class ShareLinksController {
  constructor(private readonly shareLinksService: ShareLinksService) {}

  // ============================================
  // Authenticated Endpoints (Management)
  // ============================================

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a share link' })
  @ApiResponse({ status: 201, description: 'Share link created successfully' })
  async create(@Request() req: { user: RequestUser }, @Body() dto: CreateShareLinkDto) {
    return this.shareLinksService.create(req.user.workspaceId, req.user.id, dto);
  }

  @Get()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get all share links' })
  @ApiResponse({ status: 200, description: 'Returns all share links' })
  async findAll(@Request() req: { user: RequestUser }, @Query('portalId') portalId?: string) {
    return this.shareLinksService.findAll(req.user.workspaceId, req.user.id, portalId);
  }

  @Get('access-requests')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async listAccessRequests(@Request() req: { user: RequestUser }) {
    return this.shareLinksService.listAccessRequests(req.user.workspaceId, req.user.id);
  }

  @Patch('access-requests/:id/review')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async reviewAccessRequest(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.shareLinksService.reviewAccessRequest(id, req.user.workspaceId, req.user.id);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a share link by ID' })
  @ApiResponse({ status: 200, description: 'Returns the share link' })
  async findOne(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.shareLinksService.findOne(id, req.user.workspaceId, req.user.id);
  }

  @Get(':id/comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async listManagedComments(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.shareLinksService.listManagedComments(id, req.user.workspaceId, req.user.id);
  }

  @Delete(':id/comments/:commentId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  async deleteManagedComment(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Param('commentId') commentId: string) {
    return this.shareLinksService.deleteManagedComment(id, commentId, req.user.workspaceId, req.user.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update a share link' })
  @ApiResponse({ status: 200, description: 'Share link updated successfully' })
  async update(
    @Request() req: { user: RequestUser },
    @Param('id') id: string,
    @Body() dto: UpdateShareLinkDto,
  ) {
    return this.shareLinksService.update(id, req.user.workspaceId, req.user.id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a share link' })
  @ApiResponse({ status: 200, description: 'Share link deleted successfully' })
  async delete(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.shareLinksService.delete(id, req.user.workspaceId, req.user.id);
  }

  @Post(':id/regenerate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Regenerate share link token' })
  @ApiResponse({ status: 200, description: 'Token regenerated successfully' })
  async regenerateToken(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.shareLinksService.regenerateToken(id, req.user.workspaceId, req.user.id);
  }

  // ============================================
  // Public Endpoints (Accessing shared portals)
  // ============================================

  @Get('public/:token/check')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Check if password is required for share link' })
  @ApiResponse({
    status: 200,
    description: 'Returns password requirement status',
  })
  async checkPasswordRequired(@Param('token') token: string, @Request() req: any, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.shareLinksService.checkPasswordRequired(token, req.user?.id);
  }

  @Post('public/:token/access')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Access a shared portal' })
  @ApiResponse({ status: 200, description: 'Returns the shared portal data' })
  async accessSharedPortal(
    @Param('token') token: string,
    @Body() dto: AccessShareLinkDto,
    @Request() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.shareLinksService.accessSharedPortal(token, dto.password, {
      ip: req.ip,
      referrer: req.get('referer'),
    }, req.user?.id);
  }

  @Post('public/:token/export')
  @UseGuards(OptionalJwtAuthGuard)
  async exportSharedPortal(@Param('token') token: string, @Body() dto: AccessShareLinkDto, @Request() req: any, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache', 'Content-Disposition': 'attachment; filename="shared-portal.json"' });
    return this.shareLinksService.getSharedExport(token, dto.password, req.user?.id);
  }

  @Post('public/:token/comments/list')
  @UseGuards(OptionalJwtAuthGuard)
  async listSharedComments(@Param('token') token: string, @Body() dto: AccessShareLinkDto, @Request() req: any, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.shareLinksService.listSharedComments(token, dto.password, req.user?.id);
  }

  @Post('public/:token/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async createSharedComment(@Param('token') token: string, @Body() dto: SharedCommentDto, @Request() req: any, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.shareLinksService.createSharedComment(token, dto.password, dto.displayName, dto.content, req.user?.id);
  }

  @Post('public/:token/request-access')
  async requestAccess(@Param('token') token: string, @Body() dto: ShareAccessRequestDto, @Res({ passthrough: true }) res: Response) {
    res.set({ 'Cache-Control': 'no-store, private', Pragma: 'no-cache' });
    return this.shareLinksService.requestAccess(token, dto.email, dto.message);
  }
}
