import { Module } from '@nestjs/common';
import { EnhancedComplianceController } from './enhanced-compliance.controller';
import { EnhancedComplianceService } from './enhanced-compliance.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EnhancedComplianceController],
  providers: [EnhancedComplianceService],
  exports: [EnhancedComplianceService],
})
export class EnhancedComplianceModule {}
