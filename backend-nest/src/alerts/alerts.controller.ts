import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import { AlertsService } from './alerts.service';
import { CreateAlertDto, UpdateAlertDto } from './dto/alert.dto';

const ALERT_ID_PARAM = 'id';
const ALERT_ID_ROUTE = ':id';
const ALERT_HISTORY_ROUTE = ':id/history';
const ALERT_TEST_ROUTE = ':id/test';

@ApiTags('Alerts')
@Controller('alerts')
@UseGuards(JwtAuthGuard)
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  /**
   * Create a new alert
   */
  @Post()
  @ApiOperation({ summary: 'Create alert' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateAlertDto) {
    return this.alertsService.create(user.workspaceId, user.id, dto);
  }

  /**
   * Get all alerts for workspace
   */
  @Get()
  @ApiOperation({ summary: 'Get workspace alerts' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.alertsService.findAll(user.workspaceId);
  }

  /**
   * Get alert by ID
   */
  @Get(ALERT_ID_ROUTE)
  @ApiOperation({ summary: 'Get alert by ID' })
  async findOne(@Param(ALERT_ID_PARAM) id: string, @CurrentUser() user: RequestUser) {
    return this.alertsService.findOne(id, user.workspaceId);
  }

  /**
   * Update alert
   */
  @Patch(ALERT_ID_ROUTE)
  @ApiOperation({ summary: 'Update alert' })
  async update(
    @Param(ALERT_ID_PARAM) id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateAlertDto,
  ) {
    return this.alertsService.update(id, user.workspaceId, dto);
  }

  /**
   * Delete alert
   */
  @Delete(ALERT_ID_ROUTE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete alert' })
  async remove(@Param(ALERT_ID_PARAM) id: string, @CurrentUser() user: RequestUser) {
    await this.alertsService.remove(id, user.workspaceId);
  }

  /**
   * Get alert history
   */
  @Get(ALERT_HISTORY_ROUTE)
  @ApiOperation({ summary: 'Get alert trigger history' })
  async getHistory(@Param(ALERT_ID_PARAM) id: string, @CurrentUser() user: RequestUser) {
    return this.alertsService.getHistory(id, user.workspaceId);
  }

  /**
   * Test alert (trigger manually)
   */
  @Post(ALERT_TEST_ROUTE)
  @ApiOperation({ summary: 'Test alert configuration' })
  async testAlert(@Param(ALERT_ID_PARAM) id: string, @CurrentUser() user: RequestUser) {
    return this.alertsService.testAlert(id, user.workspaceId);
  }
}
