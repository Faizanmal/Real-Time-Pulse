import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { ShareLinksController } from './share-links.controller';
import { ShareLinksService } from './share-links.service';

@Module({
  imports: [PrismaModule],
  controllers: [ShareLinksController],
  providers: [ShareLinksService],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
