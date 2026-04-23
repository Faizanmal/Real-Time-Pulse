import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { EnhancedComplianceController } from './enhanced-compliance.controller';
import { EnhancedComplianceService } from './enhanced-compliance.service';

@Module({
  imports: [PrismaModule],
  controllers: [EnhancedComplianceController],
  providers: [EnhancedComplianceService],
  exports: [EnhancedComplianceService],
})
export class EnhancedComplianceModule {}
