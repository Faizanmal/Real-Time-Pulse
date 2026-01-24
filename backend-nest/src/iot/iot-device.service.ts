import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';

export interface IoTDevice {
  id: string;
  name: string;
  deviceType: string;
  status: 'online' | 'offline' | 'warning' | 'error';
  lastSeen: Date;
  metadata: Record<string, any>;
  telemetry: Record<string, any>;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
  tags: string[];
}

export interface DeviceMetric {
  deviceId: string;
  timestamp: Date;
  metrics: Record<string, number>;
}

export interface DeviceAlert {
  id: string;
  deviceId: string;
  type: 'threshold' | 'anomaly' | 'offline' | 'error';
  severity: 'info' | 'warning' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

export interface EdgeNode {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  devices: string[];
  capabilities: string[];
  resources: {
    cpu: number;
    memory: number;
    storage: number;
  };
  lastHeartbeat: Date;
}

@Injectable()
export class IoTDeviceService {
  private readonly logger = new Logger(IoTDeviceService.name);
  private deviceCache = new Map<string, IoTDevice>();
  private metricsBuffer: DeviceMetric[] = [];
  private alertsBuffer: DeviceAlert[] = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Register a new IoT device
   */
  async registerDevice(
    workspaceId: string,
    deviceData: {
      name: string;
      deviceType: string;
      metadata?: Record<string, any>;
      location?: { lat: number; lng: number; address?: string };
      tags?: string[];
    },
  ): Promise<IoTDevice> {
    const device = await this.prisma.ioTDevice.create({
      data: {
        workspaceId,
        name: deviceData.name,
        deviceType: deviceData.deviceType,
        status: 'offline',
        metadata: deviceData.metadata || {},
        location: deviceData.location || undefined,
        tags: deviceData.tags || [],
        lastSeen: new Date(),
      },
    });

    const iotDevice: IoTDevice = {
      id: device.id,
      name: device.name,
      deviceType: device.deviceType,
      status: device.status as any,
      lastSeen: device.lastSeen,
      metadata: device.metadata as Record<string, any>,
      telemetry: {},
      location: device.location as any,
      tags: device.tags,
    };

    this.deviceCache.set(device.id, iotDevice);
    this.eventEmitter.emit('iot.device.registered', iotDevice);

    return iotDevice;
  }

  /**
   * Get all devices for a workspace
   */
  async getDevices(
    workspaceId: string,
    filters?: {
      status?: string;
      deviceType?: string;
      tags?: string[];
    },
  ): Promise<IoTDevice[]> {
    const devices = await this.prisma.ioTDevice.findMany({
      where: {
        workspaceId,
        ...(filters?.status && { status: filters.status }),
        ...(filters?.deviceType && { deviceType: filters.deviceType }),
        ...(filters?.tags && { tags: { hasSome: filters.tags } }),
      },
      orderBy: { lastSeen: 'desc' },
    });

    return devices.map((device) => ({
      id: device.id,
      name: device.name,
      deviceType: device.deviceType,
      status: device.status as any,
      lastSeen: device.lastSeen,
      metadata: device.metadata as Record<string, any>,
      telemetry: this.deviceCache.get(device.id)?.telemetry || {},
      location: device.location as any,
      tags: device.tags,
    }));
  }

  /**
   * Get a single device by ID
   */
  async getDevice(deviceId: string, workspaceId: string): Promise<IoTDevice> {
    const device = await this.prisma.ioTDevice.findFirst({
      where: { id: deviceId, workspaceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    return {
      id: device.id,
      name: device.name,
      deviceType: device.deviceType,
      status: device.status as any,
      lastSeen: device.lastSeen,
      metadata: device.metadata as Record<string, any>,
      telemetry: this.deviceCache.get(device.id)?.telemetry || {},
      location: device.location as any,
      tags: device.tags,
    };
  }

  /**
   * Update device status
   */
  async updateDeviceStatus(
    deviceId: string,
    status: 'online' | 'offline' | 'warning' | 'error',
  ): Promise<void> {
    await this.prisma.ioTDevice.update({
      where: { id: deviceId },
      data: {
        status,
        lastSeen: status === 'online' ? new Date() : undefined,
      },
    });

    const cached = this.deviceCache.get(deviceId);
    if (cached) {
      cached.status = status;
      cached.lastSeen = new Date();
    }

    this.eventEmitter.emit('iot.device.status', { deviceId, status });
  }

  /**
   * Receive telemetry data from device
   */
  async receiveTelemetry(deviceId: string, telemetry: Record<string, any>): Promise<void> {
    const device = this.deviceCache.get(deviceId);
    if (device) {
      device.telemetry = { ...device.telemetry, ...telemetry };
      device.lastSeen = new Date();
      device.status = 'online';
    }

    // Buffer metrics for batch insert
    this.metricsBuffer.push({
      deviceId,
      timestamp: new Date(),
      metrics: telemetry,
    });

    // Check thresholds and generate alerts
    await this.checkThresholds(deviceId, telemetry);

    this.eventEmitter.emit('iot.telemetry', { deviceId, telemetry });
  }

  /**
   * Check telemetry against thresholds and generate alerts
   */
  private async checkThresholds(deviceId: string, telemetry: Record<string, any>): Promise<void> {
    const thresholds = await this.prisma.ioTThreshold.findMany({
      where: { deviceId, enabled: true },
    });

    for (const threshold of thresholds) {
      const value = telemetry[threshold.metricName];
      if (value === undefined) continue;

      let triggered = false;
      switch (threshold.operator) {
        case 'gt':
          triggered = value > threshold.value;
          break;
        case 'gte':
          triggered = value >= threshold.value;
          break;
        case 'lt':
          triggered = value < threshold.value;
          break;
        case 'lte':
          triggered = value <= threshold.value;
          break;
        case 'eq':
          triggered = value === threshold.value;
          break;
      }

      if (triggered) {
        this.alertsBuffer.push({
          id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          deviceId,
          type: 'threshold',
          severity: threshold.severity as any,
          message: `${threshold.metricName} ${threshold.operator} ${threshold.value} (current: ${value})`,
          timestamp: new Date(),
          acknowledged: false,
        });

        this.eventEmitter.emit('iot.alert', {
          deviceId,
          threshold,
          value,
        });
      }
    }
  }

  /**
   * Send command to device
   */
  async sendCommand(
    deviceId: string,
    command: string,
    payload: Record<string, any>,
  ): Promise<{ success: boolean; response?: any }> {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new NotFoundException('Device not found');
    }

    if (device.status === 'offline') {
      throw new BadRequestException('Device is offline');
    }

    // Emit command event - actual delivery handled by MQTT/protocol service
    this.eventEmitter.emit('iot.command', {
      deviceId,
      command,
      payload,
    });

    // Log command
    await this.prisma.ioTCommandLog.create({
      data: {
        deviceId,
        command,
        payload,
        status: 'sent',
      },
    });

    return { success: true };
  }

  /**
   * Get device metrics history
   */
  async getMetricsHistory(
    deviceId: string,
    startTime: Date,
    endTime: Date,
    metrics?: string[],
    aggregation: 'raw' | '1m' | '5m' | '1h' | '1d' = 'raw',
  ): Promise<DeviceMetric[]> {
    const data = await this.prisma.ioTMetric.findMany({
      where: {
        deviceId,
        timestamp: {
          gte: startTime,
          lte: endTime,
        },
      },
      orderBy: { timestamp: 'asc' },
    });

    let result = data.map((d) => ({
      deviceId: d.deviceId,
      timestamp: d.timestamp,
      metrics: d.metrics as Record<string, number>,
    }));

    // Filter metrics if specified
    if (metrics && metrics.length > 0) {
      result = result.map((d) => ({
        ...d,
        metrics: Object.fromEntries(
          Object.entries(d.metrics).filter(([key]) => metrics.includes(key)),
        ),
      }));
    }

    // Aggregate if needed
    if (aggregation !== 'raw') {
      result = this.aggregateMetrics(result, aggregation);
    }

    return result;
  }

  /**
   * Aggregate metrics into time buckets
   */
  private aggregateMetrics(
    data: DeviceMetric[],
    aggregation: '1m' | '5m' | '1h' | '1d',
  ): DeviceMetric[] {
    const bucketMs = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000,
    }[aggregation];

    const buckets = new Map<number, DeviceMetric[]>();

    for (const metric of data) {
      const bucketKey = Math.floor(metric.timestamp.getTime() / bucketMs) * bucketMs;
      if (!buckets.has(bucketKey)) {
        buckets.set(bucketKey, []);
      }
      buckets.get(bucketKey).push(metric);
    }

    return Array.from(buckets.entries()).map(([bucketTime, metrics]) => {
      const aggregatedMetrics: Record<string, number> = {};
      const metricCounts: Record<string, number> = {};

      for (const m of metrics) {
        for (const [key, value] of Object.entries(m.metrics)) {
          if (!aggregatedMetrics[key]) {
            aggregatedMetrics[key] = 0;
            metricCounts[key] = 0;
          }
          aggregatedMetrics[key] += value;
          metricCounts[key]++;
        }
      }

      // Calculate averages
      for (const key of Object.keys(aggregatedMetrics)) {
        aggregatedMetrics[key] /= metricCounts[key];
      }

      return {
        deviceId: metrics[0].deviceId,
        timestamp: new Date(bucketTime),
        metrics: aggregatedMetrics,
      };
    });
  }

  /**
   * Get device alerts
   */
  async getAlerts(
    workspaceId: string,
    filters?: {
      deviceId?: string;
      severity?: string;
      acknowledged?: boolean;
    },
  ): Promise<DeviceAlert[]> {
    const alerts = await this.prisma.ioTAlert.findMany({
      where: {
        device: { workspaceId },
        ...(filters?.deviceId && { deviceId: filters.deviceId }),
        ...(filters?.severity && { severity: filters.severity }),
        ...(filters?.acknowledged !== undefined && {
          acknowledged: filters.acknowledged,
        }),
      },
      orderBy: { timestamp: 'desc' },
      take: 100,
    });

    return alerts.map((a) => ({
      id: a.id,
      deviceId: a.deviceId,
      type: a.type as any,
      severity: a.severity as any,
      message: a.message,
      timestamp: a.timestamp,
      acknowledged: a.acknowledged,
    }));
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string): Promise<void> {
    await this.prisma.ioTAlert.update({
      where: { id: alertId },
      data: { acknowledged: true, acknowledgedAt: new Date() },
    });
  }

  /**
   * Flush metrics buffer to database
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async flushMetrics(): Promise<void> {
    if (this.metricsBuffer.length === 0) return;

    const metrics = [...this.metricsBuffer];
    this.metricsBuffer = [];

    try {
      await this.prisma.ioTMetric.createMany({
        data: metrics.map((m) => ({
          deviceId: m.deviceId,
          timestamp: m.timestamp,
          metrics: m.metrics,
        })),
      });
      this.logger.log(`Flushed ${metrics.length} metrics to database`);
    } catch (error) {
      this.logger.error('Failed to flush metrics', error);
      // Re-add to buffer on failure
      this.metricsBuffer.push(...metrics);
    }
  }

  /**
   * Flush alerts buffer to database
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async flushAlerts(): Promise<void> {
    if (this.alertsBuffer.length === 0) return;

    const alerts = [...this.alertsBuffer];
    this.alertsBuffer = [];

    try {
      await this.prisma.ioTAlert.createMany({
        data: alerts.map((a) => ({
          deviceId: a.deviceId,
          type: a.type,
          severity: a.severity,
          message: a.message,
          timestamp: a.timestamp,
          acknowledged: false,
        })),
      });
      this.logger.log(`Flushed ${alerts.length} alerts to database`);
    } catch (error) {
      this.logger.error('Failed to flush alerts', error);
      this.alertsBuffer.push(...alerts);
    }
  }

  /**
   * Check for offline devices
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async checkOfflineDevices(): Promise<void> {
    const offlineThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes

    const devices = await this.prisma.ioTDevice.findMany({
      where: {
        status: 'online',
        lastSeen: { lt: offlineThreshold },
      },
    });

    for (const device of devices) {
      await this.updateDeviceStatus(device.id, 'offline');
      this.alertsBuffer.push({
        id: `alert-offline-${device.id}`,
        deviceId: device.id,
        type: 'offline',
        severity: 'warning',
        message: `Device ${device.name} went offline`,
        timestamp: new Date(),
        acknowledged: false,
      });
    }
  }
}
