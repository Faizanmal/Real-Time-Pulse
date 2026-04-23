import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { IndustrySolutionsController } from './industry-solutions.controller';
import { IndustrySolutionsService } from './industry-solutions.service';

@Module({
  imports: [PrismaModule],
  controllers: [IndustrySolutionsController],
  providers: [IndustrySolutionsService],
  exports: [IndustrySolutionsService],
})
export class IndustrySolutionsModule {}
