import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { BackupService } from './backup.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('backups')
@UseGuards(JwtAuthGuard)
export class BackupController {
  constructor(private readonly backupService: BackupService) {}

  @Post()
  async createBackup(
    @Body() body: { type?: 'full' | 'incremental'; description?: string },
  ) {
    return await this.backupService.createBackup(body.type, body.description);
  }

  @Get()
  async listBackups() {
    return await this.backupService.listBackups();
  }

  @Post(':id/restore')
  async restoreBackup(@Param('id') backupId: string) {
    const success = await this.backupService.restoreBackup(backupId);
    return { success, backupId };
  }

  @Post('restore/point-in-time')
  async restoreToPointInTime(@Body() body: { timestamp: string }) {
    const timestamp = new Date(body.timestamp);
    const success = await this.backupService.restoreToPointInTime(timestamp);
    return { success, timestamp };
  }
}
