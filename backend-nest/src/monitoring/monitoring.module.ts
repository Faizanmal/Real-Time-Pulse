/**
 * Enhanced Monitoring & Observability Module
 * Integrates APM, custom metrics, and alerting
 */

import { Module, Global } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { MonitoringService } from './monitoring.service';
import { MetricsController } from './metrics.controller';
// import { HealthIndicatorService } from './health-indicator.service';
import { AlertingService } from './alerting.service';
// import { TraceService } from './trace.service';

@Global()
@Module({
  imports: [TerminusModule],
  controllers: [MetricsController],
  providers: [
    MonitoringService,
    // HealthIndicatorService,
    AlertingService,
    // TraceService,
  ],
  exports: [MonitoringService, AlertingService, /* TraceService */],
})
export class MonitoringModule {}
