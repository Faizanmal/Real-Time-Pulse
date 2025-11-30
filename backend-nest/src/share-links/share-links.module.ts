import { Module } from '@nestjs/common';
import { ShareLinksService } from './share-links.service';
import { ShareLinksController } from './share-links.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ShareLinksController],
  providers: [ShareLinksService],
  exports: [ShareLinksService],
})
export class ShareLinksModule {}
