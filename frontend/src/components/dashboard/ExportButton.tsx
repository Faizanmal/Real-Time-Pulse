'use client';

import { useState } from 'react';
import { Download, FileText, Table, File } from 'lucide-react';
import { exportApi, downloadBlob } from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface ExportButtonProps {
  portalId: string;
  portalName?: string;
}

export function ExportButton({ portalId, portalName = 'portal' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  const handleExport = async (format: 'pdf' | 'csv' | 'excel') => {
    setLoading(true);
    setExportingFormat(format);

    try {
      let blob: Blob;
      let filename: string;

      switch (format) {
        case 'pdf':
          blob = await exportApi.exportPortalToPDF(portalId);
          filename = `${portalName}-report.pdf`;
          break;
        case 'csv':
          blob = await exportApi.exportPortalToCSV(portalId);
          filename = `${portalName}-data.csv`;
          break;
        case 'excel':
          blob = await exportApi.exportPortalToExcel(portalId);
          filename = `${portalName}-report.xlsx`;
          break;
      }

      downloadBlob(blob, filename);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      setLoading(false);
      setExportingFormat(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          className="gap-2"
        >
          <Download className="h-4 w-4" />
          {loading ? `Exporting ${exportingFormat}...` : 'Export'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => handleExport('pdf')}
          disabled={loading}
          className="gap-2"
        >
          <FileText className="h-4 w-4" />
          Export as PDF
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('excel')}
          disabled={loading}
          className="gap-2"
        >
          <Table className="h-4 w-4" />
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => handleExport('csv')}
          disabled={loading}
          className="gap-2"
        >
          <File className="h-4 w-4" />
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface WidgetExportButtonProps {
  widgetId: string;
  widgetTitle?: string;
}

export function WidgetExportButton({ widgetId, widgetTitle = 'widget' }: WidgetExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleExport = async (format: 'json' | 'csv' | 'excel') => {
    setLoading(true);

    try {
      // Only widgetId and format are required by exportApi.exportWidget
      const blob = await exportApi.exportWidget(widgetId, format);
      const ext = format === 'excel' ? 'xlsx' : format;
      downloadBlob(blob, `${widgetTitle}-data.${ext}`);
      toast.success(`Widget exported as ${format.toUpperCase()}`);
    } catch (error) {
      // error is unknown type
      console.error('Export failed:', error);
      toast.error('Export failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          className="h-8 w-8 p-0"
        >
          <Download className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => handleExport('json')}>
          Export as JSON
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('excel')}>
          Export as Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => handleExport('csv')}>
          Export as CSV
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
