import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { WidgetService } from './widget.service';
import { CreateWidgetDto, UpdateWidgetDto } from './dto/widget.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

@Controller('widgets')
@UseGuards(JwtAuthGuard)
export class WidgetController {
  constructor(private readonly widgetService: WidgetService) {}

  /**
   * Create a new widget
   */
  @Post()
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateWidgetDto) {
    return this.widgetService.create(user.workspaceId, dto);
  }

  /**
   * Get all widgets for a portal
   */
  @Get('portal/:portalId')
  async findAllByPortal(@Param('portalId') portalId: string, @CurrentUser() user: RequestUser) {
    return this.widgetService.findAllByPortal(portalId, user.workspaceId);
  }

  /**
   * Get widget by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.widgetService.findOne(id, user.workspaceId);
  }

  /**
   * Update widget
   */
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateWidgetDto,
  ) {
    return this.widgetService.update(id, user.workspaceId, dto);
  }

  /**
   * Delete widget
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.widgetService.remove(id, user.workspaceId);
  }

  /**
   * Refresh widget data
   */
  @Post(':id/refresh')
  async refreshData(@Param('id') id: string, @CurrentUser() user: RequestUser): Promise<any> {
    return this.widgetService.refreshData(id, user.workspaceId);
  }
}
