import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
  ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { VoiceService } from './voice.service';
import { VoiceCommandService } from './voice-command.service';
import { RequestUser } from '../common/interfaces/auth.interface';

@ApiTags('Voice')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('voice')
export class VoiceController {
  constructor(
    private readonly voiceService: VoiceService,
    private readonly commandService: VoiceCommandService,
  ) {}

  @Post('transcribe')
  @ApiOperation({ summary: 'Transcribe audio to text' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('audio'))
  async transcribe(
    @UploadedFile() file: Express.Multer.File,
    @Query('language') language?: string,
  ) {
    return this.voiceService.transcribeAudio(file.buffer, { language });
  }

  @Post('command')
  @ApiOperation({ summary: 'Process voice command' })
  async processCommand(
    @Request() req: { user: RequestUser },
    @Body() dto: { transcript: string },
  ) {
    return this.voiceService.processVoiceCommand(
      req.user.workspaceId,
      dto.transcript,
    );
  }

  @Post('synthesize')
  @ApiOperation({ summary: 'Generate speech from text' })
  async synthesize(
    @Body()
    dto: {
      text: string;
      voice?: string;
      rate?: number;
      pitch?: number;
    },
  ) {
    return this.voiceService.synthesizeSpeech(dto.text, dto);
  }

  @Post('annotations')
  @ApiOperation({ summary: 'Create voice annotation' })
  async createAnnotation(
    @Request() req: { user: RequestUser },
    @Body()
    dto: {
      portalId: string;
      widgetId?: string;
      transcript: string;
      audioUrl?: string;
      timestamp?: number;
    },
  ) {
    return this.voiceService.createAnnotation(
      req.user.workspaceId,
      req.user.id,
      dto,
    );
  }

  @Get('annotations/:portalId')
  @ApiOperation({ summary: 'Get annotations for a portal' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  async getAnnotations(
    @Request() req: { user: RequestUser },
    @Param('portalId') portalId: string,
  ) {
    return this.voiceService.getAnnotations(req.user.workspaceId, portalId);
  }

  @Delete('annotations/:portalId/:annotationId')
  @ApiOperation({ summary: 'Delete annotation' })
  @ApiParam({ name: 'portalId', description: 'Portal ID' })
  @ApiParam({ name: 'annotationId', description: 'Annotation ID' })
  async deleteAnnotation(
    @Request() req: { user: RequestUser },
    @Param('portalId') portalId: string,
    @Param('annotationId') annotationId: string,
  ) {
    await this.voiceService.deleteAnnotation(
      req.user.workspaceId,
      portalId,
      annotationId,
    );
    return { success: true };
  }

  @Get('voices')
  @ApiOperation({ summary: 'Get available TTS voices' })
  getVoices() {
    return this.voiceService.getAvailableVoices();
  }

  @Get('languages')
  @ApiOperation({ summary: 'Get supported languages' })
  getLanguages() {
    return this.voiceService.getSupportedLanguages();
  }

  @Get('commands')
  @ApiOperation({ summary: 'Get available voice commands' })
  getCommands() {
    return this.commandService.getAvailableCommands();
  }

  @Post('accessibility/describe')
  @ApiOperation({ summary: 'Generate accessibility description for widget' })
  generateDescription(
    @Body() dto: { widgetType: string; widgetData: Record<string, unknown> },
  ) {
    const description = this.voiceService.generateAccessibilityDescription(
      dto.widgetType,
      dto.widgetData,
    );
    return { description };
  }
}
