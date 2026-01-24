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
import { ShareLinksService } from './share-links.service';
import { RequestUser } from '../common/interfaces/auth.interface';
import { CreateShareLinkDto, UpdateShareLinkDto, AccessShareLinkDto } from './dto/share-link.dto';

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
    return this.shareLinksService.findAll(req.user.workspaceId, portalId);
  }

  @Get(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a share link by ID' })
  @ApiResponse({ status: 200, description: 'Returns the share link' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    return this.shareLinksService.findOne(id, req.user.workspaceId);
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
    return this.shareLinksService.update(id, req.user.workspaceId, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Delete a share link' })
  @ApiResponse({ status: 200, description: 'Share link deleted successfully' })
  async delete(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.shareLinksService.delete(id, req.user.workspaceId);
  }

  @Post(':id/regenerate')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Regenerate share link token' })
  @ApiResponse({ status: 200, description: 'Token regenerated successfully' })
  async regenerateToken(@Request() req: { user: RequestUser }, @Param('id') id: string) {
    return this.shareLinksService.regenerateToken(id, req.user.workspaceId);
  }

  // ============================================
  // Public Endpoints (Accessing shared portals)
  // ============================================

  @Get('public/:token/check')
  @ApiOperation({ summary: 'Check if password is required for share link' })
  @ApiResponse({
    status: 200,
    description: 'Returns password requirement status',
  })
  async checkPasswordRequired(@Param('token') token: string) {
    return this.shareLinksService.checkPasswordRequired(token);
  }

  @Post('public/:token/access')
  @ApiOperation({ summary: 'Access a shared portal' })
  @ApiResponse({ status: 200, description: 'Returns the shared portal data' })
  async accessSharedPortal(@Param('token') token: string, @Body() dto: AccessShareLinkDto) {
    return this.shareLinksService.accessSharedPortal(token, dto.password);
  }
}
