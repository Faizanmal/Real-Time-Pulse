import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ARVisualizationService, ARSceneConfig } from './ar-visualization.service';
import { ARSceneService } from './ar-scene.service';

@ApiTags('AR Visualization')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ar')
export class ARVisualizationController {
  constructor(
    private readonly arService: ARVisualizationService,
    private readonly sceneService: ARSceneService,
  ) {}

  @Post('scenes')
  @ApiOperation({ summary: 'Create AR scene' })
  async createScene(
    @Request() req: any,
    @Body()
    dto: {
      name: string;
      description?: string;
      type: 'portal' | 'widget' | 'custom';
      targetId?: string;
      config?: Partial<ARSceneConfig>;
    },
  ) {
    return this.arService.createScene(req.user.workspaceId, dto);
  }

  @Get('scenes')
  @ApiOperation({ summary: 'Get all AR scenes' })
  async getScenes(@Request() req: any) {
    return this.arService.getScenes(req.user.workspaceId);
  }

  @Get('scenes/:sceneId')
  @ApiOperation({ summary: 'Get AR scene by ID' })
  @ApiParam({ name: 'sceneId', description: 'Scene ID' })
  async getScene(@Request() req: any, @Param('sceneId') sceneId: string) {
    return this.arService.getScene(req.user.workspaceId, sceneId);
  }

  @Put('scenes/:sceneId')
  @ApiOperation({ summary: 'Update AR scene' })
  @ApiParam({ name: 'sceneId', description: 'Scene ID' })
  async updateScene(
    @Request() req: any,
    @Param('sceneId') sceneId: string,
    @Body()
    dto: {
      name?: string;
      description?: string;
      config?: Partial<ARSceneConfig>;
    },
  ) {
    return this.arService.updateScene(req.user.workspaceId, sceneId, dto);
  }

  @Delete('scenes/:sceneId')
  @ApiOperation({ summary: 'Delete AR scene' })
  @ApiParam({ name: 'sceneId', description: 'Scene ID' })
  async deleteScene(@Request() req: any, @Param('sceneId') sceneId: string) {
    await this.arService.deleteScene(req.user.workspaceId, sceneId);
    return { success: true };
  }

  @Get('scenes/:sceneId/qr')
  @ApiOperation({ summary: 'Get QR code for AR scene' })
  @ApiParam({ name: 'sceneId', description: 'Scene ID' })
  async getQRCode(@Param('sceneId') sceneId: string, @Query('baseUrl') baseUrl?: string) {
    const qrCode = await this.arService.generateQRCode(sceneId, baseUrl);
    return { qrCode };
  }

  @Post('scenes/:sceneId/markers')
  @ApiOperation({ summary: 'Create AR marker for scene' })
  @ApiParam({ name: 'sceneId', description: 'Scene ID' })
  async createMarker(
    @Request() req: any,
    @Param('sceneId') sceneId: string,
    @Body()
    dto: {
      type: 'qr' | 'image' | 'location';
      location?: { lat: number; lng: number; radius: number };
    },
  ) {
    return this.arService.createMarker(req.user.workspaceId, sceneId, dto);
  }

  @Get('markers')
  @ApiOperation({ summary: 'Get all AR markers' })
  async getMarkers(@Request() req: any, @Query('sceneId') sceneId?: string) {
    return this.arService.getMarkers(req.user.workspaceId, sceneId);
  }

  @Post('convert')
  @ApiOperation({ summary: 'Convert widget data to 3D format' })
  async convertTo3D(@Body() dto: { widgetType: string; widgetData: any }) {
    return this.arService.convertToAR3D(dto.widgetType, dto.widgetData);
  }

  @Post('scene-definition')
  @ApiOperation({ summary: 'Generate AR scene definition' })
  async generateSceneDefinition(
    @Request() req: any,
    @Body()
    dto: {
      type: 'portal' | 'widget';
      targetId: string;
      visualizationType: string;
      data: any;
    },
  ) {
    return this.sceneService.generateSceneDefinition(req.user.workspaceId, dto);
  }

  @Post('export/aframe')
  @ApiOperation({ summary: 'Export scene to A-Frame/AR.js format' })
  async exportToAFrame(@Body() dto: { sceneDefinition: any }) {
    const html = await this.sceneService.exportToAFrame(dto.sceneDefinition);
    return { html };
  }

  @Post('export/threejs')
  @ApiOperation({ summary: 'Export scene to Three.js format' })
  async exportToThreeJS(@Body() dto: { sceneDefinition: any }) {
    return this.sceneService.exportToThreeJS(dto.sceneDefinition);
  }
}
