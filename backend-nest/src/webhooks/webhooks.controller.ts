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
import { WebhooksService } from './webhooks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { CreateWebhookDto, UpdateWebhookDto } from './dto/webhook.dto';

@ApiTags('Webhooks')
@Controller('webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * Create a new webhook
   */
  @Post()
  @ApiOperation({ summary: 'Create webhook' })
  async create(@CurrentUser() user: RequestUser, @Body() dto: CreateWebhookDto) {
    return this.webhooksService.create(user.workspaceId, user.id, dto);
  }

  /**
   * Get all webhooks for workspace
   */
  @Get()
  @ApiOperation({ summary: 'Get workspace webhooks' })
  async findAll(@CurrentUser() user: RequestUser) {
    return this.webhooksService.findAll(user.workspaceId);
  }

  /**
   * Get webhook by ID
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get webhook by ID' })
  async findOne(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.webhooksService.findOne(id, user.workspaceId);
  }

  /**
   * Update webhook
   */
  @Patch(':id')
  @ApiOperation({ summary: 'Update webhook' })
  async update(
    @Param('id') id: string,
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateWebhookDto,
  ) {
    return this.webhooksService.update(id, user.workspaceId, dto);
  }

  /**
   * Delete webhook
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete webhook' })
  async remove(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    await this.webhooksService.remove(id, user.workspaceId);
  }

  /**
   * Get webhook deliveries
   */
  @Get(':id/deliveries')
  @ApiOperation({ summary: 'Get webhook delivery history' })
  async getDeliveries(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.webhooksService.getDeliveries(id, user.workspaceId);
  }

  /**
   * Test webhook
   */
  @Post(':id/test')
  @ApiOperation({ summary: 'Test webhook' })
  async testWebhook(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.webhooksService.testWebhook(id, user.workspaceId);
  }

  /**
   * Regenerate webhook secret
   */
  @Post(':id/regenerate-secret')
  @ApiOperation({ summary: 'Regenerate webhook secret' })
  async regenerateSecret(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.webhooksService.regenerateSecret(id, user.workspaceId);
  }
}
