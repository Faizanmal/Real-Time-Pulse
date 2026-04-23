import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { IntegrationBuilderController } from './integration-builder.controller';
import { IntegrationBuilderService } from './integration-builder.service';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationBuilderController],
  providers: [IntegrationBuilderService],
  exports: [IntegrationBuilderService],
})
export class IntegrationBuilderModule {}
