import {
  Controller,
  Get,
  Param,
  UseGuards,
  Res,
  StreamableFile,
} from '@nestjs/common';
import type { Response } from 'express';
import { ExportService } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';
import type { RequestUser } from '../common/interfaces/auth.interface';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

@ApiTags('Exports')
@Controller('exports')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * Export portal data to PDF
   */
  @Get('portal/:id/pdf')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export portal to PDF' })
  async exportPortalToPDF(
    @Param('id') portalId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportService.exportPortalToPDF(
      portalId,
      user.workspaceId,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="portal-${portalId}.pdf"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  /**
   * Export portal data to CSV
   */
  @Get('portal/:id/csv')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export portal data to CSV' })
  async exportPortalToCSV(
    @Param('id') portalId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportService.exportPortalToCSV(
      portalId,
      user.workspaceId,
    );

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="portal-${portalId}.csv"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  /**
   * Export portal data to Excel
   */
  @Get('portal/:id/excel')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export portal data to Excel' })
  async exportPortalToExcel(
    @Param('id') portalId: string,
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const buffer = await this.exportService.exportPortalToExcel(
      portalId,
      user.workspaceId,
    );

    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="portal-${portalId}.xlsx"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  /**
   * Export widget data
   */
  @Get('widget/:id/:format')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Export widget data in specified format' })
  @ApiQuery({
    name: 'format',
    enum: ['csv', 'json', 'excel'],
    required: true,
  })
  async exportWidget(
    @Param('id') widgetId: string,
    @Param('format') format: 'csv' | 'json' | 'excel',
    @CurrentUser() user: RequestUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { buffer, contentType, extension } =
      await this.exportService.exportWidget(widgetId, format, user.workspaceId);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="widget-${widgetId}.${extension}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }
}
