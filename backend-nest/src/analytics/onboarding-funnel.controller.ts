import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { IsBoolean } from 'class-validator';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';

import { OnboardingFunnelService } from './onboarding-funnel.service';

class AnalyticsConsentDto {
  @IsBoolean()
  consented: boolean;
}

@Controller('onboarding')
@UseGuards(JwtAuthGuard)
export class OnboardingFunnelController {
  constructor(private readonly funnel: OnboardingFunnelService) {}

  @Get('status')
  getStatus(@CurrentUser() user: RequestUser) {
    return this.funnel.getStatus(user.workspaceId, user.id);
  }

  @Patch('analytics-consent')
  setAnalyticsConsent(@CurrentUser() user: RequestUser, @Body() dto: AnalyticsConsentDto) {
    return this.funnel.setConsent(user.workspaceId, user.id, dto.consented);
  }
}

