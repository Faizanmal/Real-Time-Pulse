import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';
import * as ExcelJS from 'exceljs';

interface ExportResult {
  buffer: Uint8Array;
  contentType: string;
  extension: string;
}

@Injectable()
export class ExportService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Export portal to PDF
   */
  async exportPortalToPDF(portalId: string, workspaceId: string): Promise<Buffer> {
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: {
          include: {
            integration: true,
          },
        },
        workspace: true,
        createdBy: true,
      },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(24).fillColor('#3B82F6').text(portal.name, { align: 'center' });
      doc.moveDown();

      // Metadata
      doc.fontSize(10).fillColor('#666666');
      doc.text(`Workspace: ${portal.workspace.name}`);
      doc.text(`Created: ${portal.createdAt.toLocaleDateString()}`);
      doc.text(`Last Updated: ${portal.updatedAt.toLocaleDateString()}`);
      if (portal.description) {
        doc.text(`Description: ${portal.description}`);
      }
      doc.moveDown(2);

      // Widgets
      doc.fontSize(18).fillColor('#000000').text('Widgets', { underline: true });
      doc.moveDown();

      portal.widgets.forEach((widget, index) => {
        doc
          .fontSize(14)
          .fillColor('#3B82F6')
          .text(`${index + 1}. ${widget.name}`);
        doc.fontSize(10).fillColor('#666666');
        doc.text(`Type: ${widget.type}`);
        if (widget.integration) {
          doc.text(`Integration: ${widget.integration.provider}`);
        }
        doc.text(`Last Refreshed: ${widget.lastRefreshedAt?.toLocaleString() || 'Never'}`);

        // Widget config preview
        doc.fontSize(9).fillColor('#999999');
        doc.text(`Config: ${JSON.stringify(widget.config).substring(0, 100)}...`);
        doc.moveDown();
      });

      // Footer
      doc
        .fontSize(8)
        .fillColor('#999999')
        .text(
          `Generated on ${new Date().toLocaleString()} by Real-Time Pulse`,
          50,
          doc.page.height - 50,
          { align: 'center' },
        );

      doc.end();
    });
  }

  /**
   * Export portal to CSV
   */
  async exportPortalToCSV(portalId: string, workspaceId: string): Promise<Buffer> {
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: {
          include: {
            integration: true,
          },
        },
      },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    const rows = [
      [
        'Widget Name',
        'Type',
        'Integration',
        'Grid Position (X,Y)',
        'Grid Size (W,H)',
        'Refresh Interval (s)',
        'Last Refreshed',
        'Config',
      ],
    ];

    portal.widgets.forEach((widget) => {
      rows.push([
        widget.name,
        widget.type,
        widget.integration?.provider || 'N/A',
        `${widget.gridX},${widget.gridY}`,
        `${widget.gridWidth},${widget.gridHeight}`,
        widget.refreshInterval.toString(),
        widget.lastRefreshedAt?.toISOString() || 'Never',
        JSON.stringify(widget.config),
      ]);
    });

    const csv = rows.map((row) => row.map(this.escapeCSV).join(',')).join('\n');
    return Buffer.from(csv, 'utf-8');
  }

  /**
   * Export portal to Excel
   */
  async exportPortalToExcel(portalId: string, workspaceId: string): Promise<Uint8Array> {
    const portal = await this.prisma.portal.findFirst({
      where: { id: portalId, workspaceId },
      include: {
        widgets: {
          include: {
            integration: true,
          },
        },
        workspace: true,
      },
    });

    if (!portal) {
      throw new NotFoundException('Portal not found');
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Real-Time Pulse';
    workbook.created = new Date();

    // Portal Info Sheet
    const infoSheet = workbook.addWorksheet('Portal Info');
    infoSheet.columns = [
      { header: 'Property', key: 'property', width: 20 },
      { header: 'Value', key: 'value', width: 50 },
    ];

    infoSheet.addRows([
      { property: 'Name', value: portal.name },
      { property: 'Slug', value: portal.slug },
      { property: 'Description', value: portal.description || 'N/A' },
      { property: 'Workspace', value: portal.workspace.name },
      { property: 'Public', value: portal.isPublic ? 'Yes' : 'No' },
      { property: 'Created', value: portal.createdAt.toISOString() },
      { property: 'Updated', value: portal.updatedAt.toISOString() },
      { property: 'Widget Count', value: portal.widgets.length },
    ]);

    // Style header
    infoSheet.getRow(1).font = { bold: true };
    infoSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };

    // Widgets Sheet
    const widgetsSheet = workbook.addWorksheet('Widgets');
    widgetsSheet.columns = [
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Type', key: 'type', width: 15 },
      { header: 'Integration', key: 'integration', width: 20 },
      { header: 'Grid X', key: 'gridX', width: 10 },
      { header: 'Grid Y', key: 'gridY', width: 10 },
      { header: 'Width', key: 'gridWidth', width: 10 },
      { header: 'Height', key: 'gridHeight', width: 10 },
      { header: 'Refresh Interval', key: 'refreshInterval', width: 15 },
      { header: 'Last Refreshed', key: 'lastRefreshedAt', width: 20 },
      { header: 'Config', key: 'config', width: 40 },
    ];

    portal.widgets.forEach((widget) => {
      widgetsSheet.addRow({
        name: widget.name,
        type: widget.type,
        integration: widget.integration?.provider || 'N/A',
        gridX: widget.gridX,
        gridY: widget.gridY,
        gridWidth: widget.gridWidth,
        gridHeight: widget.gridHeight,
        refreshInterval: widget.refreshInterval,
        lastRefreshedAt: widget.lastRefreshedAt?.toISOString() || 'Never',
        config: JSON.stringify(widget.config),
      });
    });

    // Style header
    widgetsSheet.getRow(1).font = { bold: true };
    widgetsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF3B82F6' },
    };

    return (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array;
  }

  /**
   * Export widget data
   */
  async exportWidget(
    widgetId: string,
    format: 'csv' | 'json' | 'excel',
    workspaceId: string,
  ): Promise<ExportResult> {
    const widget = await this.prisma.widget.findFirst({
      where: {
        id: widgetId,
        portal: { workspaceId },
      },
      include: {
        integration: true,
        portal: true,
      },
    });

    if (!widget) {
      throw new NotFoundException('Widget not found');
    }

    switch (format) {
      case 'json':
        return {
          buffer: Buffer.from(JSON.stringify(widget, null, 2), 'utf-8'),
          contentType: 'application/json',
          extension: 'json',
        };

      case 'csv': {
        const csv = [
          ['Property', 'Value'],
          ['Name', widget.name],
          ['Type', widget.type],
          ['Portal', widget.portal.name],
          ['Integration', widget.integration?.provider || 'N/A'],
          ['Grid Position', `${widget.gridX},${widget.gridY}`],
          ['Grid Size', `${widget.gridWidth}x${widget.gridHeight}`],
          ['Refresh Interval', `${widget.refreshInterval}s`],
          ['Last Refreshed', widget.lastRefreshedAt?.toISOString() || 'Never'],
          ['Config', JSON.stringify(widget.config)],
        ]
          .map((row) => row.map(this.escapeCSV).join(','))
          .join('\n');

        return {
          buffer: Buffer.from(csv, 'utf-8'),
          contentType: 'text/csv',
          extension: 'csv',
        };
      }

      case 'excel': {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Widget Data');

        sheet.columns = [
          { header: 'Property', key: 'property', width: 20 },
          { header: 'Value', key: 'value', width: 50 },
        ];

        sheet.addRows([
          { property: 'Name', value: widget.name },
          { property: 'Type', value: widget.type },
          { property: 'Portal', value: widget.portal.name },
          {
            property: 'Integration',
            value: widget.integration?.provider || 'N/A',
          },
          {
            property: 'Grid Position',
            value: `${widget.gridX},${widget.gridY}`,
          },
          {
            property: 'Grid Size',
            value: `${widget.gridWidth}x${widget.gridHeight}`,
          },
          { property: 'Refresh Interval', value: `${widget.refreshInterval}s` },
          {
            property: 'Last Refreshed',
            value: widget.lastRefreshedAt?.toISOString() || 'Never',
          },
          { property: 'Config', value: JSON.stringify(widget.config) },
        ]);

        sheet.getRow(1).font = { bold: true };

        return {
          buffer: (await workbook.xlsx.writeBuffer()) as unknown as Uint8Array,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          extension: 'xlsx',
        };
      }
    }
  }

  /**
   * Escape CSV fields
   */
  private escapeCSV = (field: string): string => {
    if (field.includes(',') || field.includes('"') || field.includes('\n')) {
      return `"${field.replace(/"/g, '""')}"`;
    }
    return field;
  };
}
