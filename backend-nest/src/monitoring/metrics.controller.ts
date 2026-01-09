/**
 * Metrics Controller
 * Exposes Prometheus-compatible metrics endpoint
 */

import { Controller, Get, Header } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiProduces } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { AlertingService } from './alerting.service';
import { Public } from '../auth/decorators/public.decorator';

@ApiTags('Monitoring')
@Controller('metrics')
export class MetricsController {
  constructor(
    private readonly monitoringService: MonitoringService,
    private readonly alertingService: AlertingService,
  ) {}

  @Get()
  @Public()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiProduces('text/plain')
  getMetrics(): string {
    return this.monitoringService.getPrometheusMetrics();
  }

  @Get('json')
  @ApiOperation({ summary: 'Get metrics in JSON format' })
  getMetricsJson() {
    return this.monitoringService.getMetrics();
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get active alerts' })
  getActiveAlerts() {
    return {
      active: this.alertingService.getActiveAlerts(),
      rules: this.alertingService.getAlertRules(),
    };
  }

  @Get('alerts/history')
  @ApiOperation({ summary: 'Get alert history' })
  getAlertHistory() {
    return this.alertingService.getAlertHistory();
  }
}
