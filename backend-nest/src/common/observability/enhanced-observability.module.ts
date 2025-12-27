import { Module, Global } from '@nestjs/common';
import { EnhancedObservabilityService } from './enhanced-observability.service';

@Global()
@Module({
  providers: [EnhancedObservabilityService],
  exports: [EnhancedObservabilityService],
})
export class EnhancedObservabilityModule {}
