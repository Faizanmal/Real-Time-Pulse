/**
 * =============================================================================
 * REAL-TIME PULSE - CORRELATION ID MODULE
 * =============================================================================
 *
 * Provides distributed tracing capabilities with correlation IDs that propagate
 * across services, databases, and external API calls.
 */

import { Module, Global } from '@nestjs/common';
import { CorrelationService } from './correlation.service';
import { CorrelationInterceptor } from './correlation.interceptor';

@Global()
@Module({
  providers: [CorrelationService, CorrelationInterceptor],
  exports: [CorrelationService, CorrelationInterceptor],
})
export class CorrelationModule {}
