import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';

import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

import { CreateBadgeDto } from './dto/gamification.dto';
import { GamificationService } from './gamification.service';

@Controller('gamification')
@UseGuards(JwtAuthGuard)
export class GamificationController {
  constructor(private readonly gamificationService: GamificationService) {}

  @Get('profile')
  async getProfile(@Request() req) {
    return this.gamificationService.getProfile(req.user.userId);
  }

  @Get('leaderboard')
  async getLeaderboard(@Request() req) {
    return this.gamificationService.getLeaderboard(req.user.workspaceId);
  }

  @Post('badges')
  async createBadge(@Body() dto: CreateBadgeDto) {
    return this.gamificationService.createBadge(dto);
  }
}
