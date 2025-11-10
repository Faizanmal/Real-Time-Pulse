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
} from '@nestjs/common';
import { PortalService } from './portal.service';
import { CreatePortalDto, UpdatePortalDto } from './dto/portal.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

@Controller('portals')
export class PortalController {
  constructor(private readonly portalService: PortalService) {}

  /**
   * Create a new portal
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreatePortalDto) {
    return this.portalService.create(user.workspaceId, user.id, dto);
  }

  /**
   * Get all portals for authenticated user's workspace
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const size = pageSize ? parseInt(pageSize, 10) : 20;
    return this.portalService.findAll(user.workspaceId, user.id, pageNum, size);
  }

  /**
   * Get portal by share token (public access - no auth required)
   */
  @Get('share/:shareToken')
  async findByShareToken(@Param('shareToken') shareToken: string) {
    return this.portalService.findByShareToken(shareToken);
  }

  /**
   * Get a single portal by ID
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.portalService.findOne(id, user.workspaceId, user.id);
  }

  /**
   * Update a portal
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdatePortalDto,
  ) {
    return this.portalService.update(id, user.workspaceId, user.id, dto);
  }

  /**
   * Delete a portal
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.portalService.remove(id, user.workspaceId, user.id);
  }

  /**
   * Regenerate share token for a portal
   */
  @Post(':id/regenerate-token')
  @UseGuards(JwtAuthGuard)
  async regenerateToken(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.portalService.regenerateShareToken(
      id,
      user.workspaceId,
      user.id,
    );
  }
}
