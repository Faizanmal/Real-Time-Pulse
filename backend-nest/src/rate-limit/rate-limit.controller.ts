import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('rate-limit')
@UseGuards(JwtAuthGuard)
export class RateLimitController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Post('configure')
  async configureRateLimit(@Body() config: any) {
    await this.rateLimitService.setRateLimit(config);
    return { success: true };
  }

  @Post('queue')
  async queueRequest(@Body() body: any) {
    const requestId = await this.rateLimitService.queueRequest(
      body.integrationId,
      body.endpoint,
      body.method,
      body.params,
      body.priority,
    );
    return { requestId };
  }

  @Get('monitoring')
  async getMonitoring(@Query('integrationId') integrationId?: string) {
    return await this.rateLimitService.getMonitoring(integrationId);
  }

  @Get('queue/stats')
  async getQueueStats() {
    return await this.rateLimitService.getQueueStats();
  }

  @Post(':integrationId/clear')
  async clearRateLimit(@Param('integrationId') integrationId: string) {
    await this.rateLimitService.clearRateLimit(integrationId);
    return { success: true };
  }

  @Post(':integrationId/adjust')
  async adjustRateLimit(
    @Param('integrationId') integrationId: string,
    @Body() body: { adjustment: 'increase' | 'decrease' },
  ) {
    await this.rateLimitService.adjustRateLimit(integrationId, body.adjustment);
    return { success: true };
  }
}
