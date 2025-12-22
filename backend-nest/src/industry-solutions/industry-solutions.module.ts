import { Module } from '@nestjs/common';
import { IndustrySolutionsController } from './industry-solutions.controller';
import { IndustrySolutionsService } from './industry-solutions.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [IndustrySolutionsController],
  providers: [IndustrySolutionsService],
  exports: [IndustrySolutionsService],
})
export class IndustrySolutionsModule {}
