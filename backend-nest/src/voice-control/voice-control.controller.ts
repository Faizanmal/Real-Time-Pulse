import { Controller, Post, Get, Body, Query, UseGuards, Request } from '@nestjs/common';
import { VoiceControlService } from './voice-control.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceControlController {
  constructor(private readonly voiceControlService: VoiceControlService) {}

  @Post('command')
  async processCommand(@Body() body: { text: string; workspaceId: string }, @Request() req: any) {
    const userId = req.user.id;
    const response = await this.voiceControlService.processCommand(
      body.text,
      userId,
      body.workspaceId,
    );

    // Save to history
    await this.voiceControlService.saveCommandHistory(
      userId,
      body.text,
      response.action,
      response.success,
    );

    return response;
  }

  @Get('history')
  async getHistory(@Query('limit') limit: string, @Request() req: any) {
    const userId = req.user.id;
    return await this.voiceControlService.getCommandHistory(userId, parseInt(limit) || 10);
  }
}
