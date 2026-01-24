import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { IoTDeviceService, IoTDevice, DeviceAlert } from './iot-device.service';
import { EdgeComputingService, EdgeNodeConfig, EdgeProcessingRule } from './edge-computing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// DTOs
interface RegisterDeviceDto {
  name: string;
  deviceType: string;
  metadata?: Record<string, any>;
  location?: { lat: number; lng: number; address?: string };
  tags?: string[];
}

interface SendCommandDto {
  command: string;
  payload: Record<string, any>;
}

interface RegisterEdgeNodeDto {
  name: string;
  location: string;
  processingRules?: EdgeProcessingRule[];
  dataFilters?: any[];
  aggregationConfig?: any;
}

interface DeployRulesDto {
  rules: EdgeProcessingRule[];
}

@Controller('iot')
@UseGuards(JwtAuthGuard)
export class IoTController {
  constructor(
    private readonly iotDeviceService: IoTDeviceService,
    private readonly edgeComputingService: EdgeComputingService,
  ) {}

  // ==================== DEVICES ====================

  /**
   * Register a new IoT device
   */
  @Post('devices')
  async registerDevice(@Body() dto: RegisterDeviceDto, @Req() req: any): Promise<IoTDevice> {
    return this.iotDeviceService.registerDevice(req.user.workspaceId, dto);
  }

  /**
   * Get all devices
   */
  @Get('devices')
  async getDevices(
    @Query('status') status: string,
    @Query('deviceType') deviceType: string,
    @Query('tags') tags: string,
    @Req() req: any,
  ): Promise<IoTDevice[]> {
    return this.iotDeviceService.getDevices(req.user.workspaceId, {
      status,
      deviceType,
      tags: tags ? tags.split(',') : undefined,
    });
  }

  /**
   * Get a single device
   */
  @Get('devices/:id')
  async getDevice(@Param('id') id: string, @Req() req: any): Promise<IoTDevice> {
    return this.iotDeviceService.getDevice(id, req.user.workspaceId);
  }

  /**
   * Send command to device
   */
  @Post('devices/:id/command')
  async sendCommand(
    @Param('id') id: string,
    @Body() dto: SendCommandDto,
  ): Promise<{ success: boolean }> {
    return this.iotDeviceService.sendCommand(id, dto.command, dto.payload);
  }

  /**
   * Get device metrics history
   */
  @Get('devices/:id/metrics')
  async getMetricsHistory(
    @Param('id') id: string,
    @Query('start') start: string,
    @Query('end') end: string,
    @Query('metrics') metrics: string,
    @Query('aggregation') aggregation: 'raw' | '1m' | '5m' | '1h' | '1d',
  ) {
    return this.iotDeviceService.getMetricsHistory(
      id,
      new Date(start),
      new Date(end),
      metrics ? metrics.split(',') : undefined,
      aggregation,
    );
  }

  // ==================== ALERTS ====================

  /**
   * Get all alerts
   */
  @Get('alerts')
  async getAlerts(
    @Query('deviceId') deviceId: string,
    @Query('severity') severity: string,
    @Query('acknowledged') acknowledged: string,
    @Req() req: any,
  ): Promise<DeviceAlert[]> {
    return this.iotDeviceService.getAlerts(req.user.workspaceId, {
      deviceId,
      severity,
      acknowledged: acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined,
    });
  }

  /**
   * Acknowledge an alert
   */
  @Post('alerts/:id/acknowledge')
  async acknowledgeAlert(@Param('id') id: string): Promise<{ success: boolean }> {
    await this.iotDeviceService.acknowledgeAlert(id);
    return { success: true };
  }

  // ==================== EDGE NODES ====================

  /**
   * Register an edge node
   */
  @Post('edge/nodes')
  async registerEdgeNode(@Body() dto: RegisterEdgeNodeDto): Promise<{ success: boolean }> {
    const nodeId = `edge-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await this.edgeComputingService.registerNode({
      id: nodeId,
      name: dto.name,
      location: dto.location,
      processingRules: dto.processingRules || [],
      dataFilters: dto.dataFilters || [],
      aggregationConfig: dto.aggregationConfig || { interval: 60, metrics: [] },
    });
    return { success: true };
  }

  /**
   * Get all edge nodes
   */
  @Get('edge/nodes')
  async getEdgeNodes(): Promise<EdgeNodeConfig[]> {
    return this.edgeComputingService.getNodes();
  }

  /**
   * Get edge node status
   */
  @Get('edge/nodes/:id/status')
  async getEdgeNodeStatus(@Param('id') id: string) {
    return this.edgeComputingService.getNodeStatus(id);
  }

  /**
   * Get all edge node statuses
   */
  @Get('edge/status')
  async getAllEdgeNodeStatuses() {
    return this.edgeComputingService.getAllNodeStatuses();
  }

  /**
   * Deploy rules to edge node
   */
  @Post('edge/nodes/:id/rules')
  async deployRules(
    @Param('id') id: string,
    @Body() dto: DeployRulesDto,
  ): Promise<{ success: boolean }> {
    await this.edgeComputingService.deployRules(id, dto.rules);
    return { success: true };
  }

  /**
   * Set edge node maintenance mode
   */
  @Post('edge/nodes/:id/maintenance')
  async setMaintenanceMode(
    @Param('id') id: string,
    @Body() dto: { enabled: boolean },
  ): Promise<{ success: boolean }> {
    this.edgeComputingService.setMaintenanceMode(id, dto.enabled);
    return { success: true };
  }
}
