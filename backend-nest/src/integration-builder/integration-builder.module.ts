import { Module } from '@nestjs/common';
import { IntegrationBuilderService } from './integration-builder.service';
import { IntegrationBuilderController } from './integration-builder.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IntegrationBuilderController],
  providers: [IntegrationBuilderService],
  exports: [IntegrationBuilderService],
})
export class IntegrationBuilderModule {}
