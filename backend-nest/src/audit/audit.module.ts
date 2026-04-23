import { Module, Global } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';

@Global()
@Module({
  imports: [PrismaModule],
  providers: [AuditService],
  controllers: [AuditController],
  exports: [AuditService],
})
export class AuditModule {}
