'use client';

import { useState } from 'react';
import { exportsApi, type ExportFormat } from '@/lib/api/index';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Download, FileText, FileSpreadsheet, File, RefreshCw,
  Calendar, Settings, CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';

const exportTypes = [
  { 
    id: 'portal', 
    name: 'Portal Data', 
    description: 'Export portal configurations and settings',
    icon: FileText,
    formats: ['pdf', 'csv', 'excel'] as ExportFormat[]
  },
  { 
    id: 'analytics', 
    name: 'Analytics Report', 
    description: 'Export analytics and usage statistics',
    icon: FileSpreadsheet,
    formats: ['pdf', 'csv', 'excel'] as ExportFormat[]
  },
  { 
    id: 'audit', 
    name: 'Audit Logs', 
    description: 'Export audit trail and activity logs',
    icon: File,
    formats: ['csv', 'excel'] as ExportFormat[]
  },
  { 
    id: 'users', 
    name: 'User Data', 
    description: 'Export user information and roles',
    icon: FileText,
    formats: ['csv', 'excel'] as ExportFormat[]
  },
  { 
    id: 'widgets', 
    name: 'Widget Configurations', 
    description: 'Export widget settings and layouts',
    icon: Settings,
    formats: ['csv', 'excel'] as ExportFormat[]
  },
  { 
    id: 'billing', 
    name: 'Billing History', 
    description: 'Export invoices and payment history',
    icon: FileSpreadsheet,
    formats: ['pdf', 'csv'] as ExportFormat[]
  },
];

const formatLabels: Record<ExportFormat, string> = {
  pdf: 'PDF Document',
  csv: 'CSV Spreadsheet',
  excel: 'Excel Workbook',
  json: 'JSON File',
};

const formatIcons: Record<ExportFormat, typeof FileText> = {
  pdf: FileText,
  csv: FileSpreadsheet,
  excel: File,
  json: File,
};

export default function ExportsPage() {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [includeMetadata, setIncludeMetadata] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [recentExports, setRecentExports] = useState<Array<{
    id: string;
    type: string;
    format: ExportFormat;
    timestamp: Date;
  }>>([]);

  const handleExport = async () => {
    if (!selectedType) {
      toast.error('Please select an export type');
      return;
    }

    setExporting(true);
    try {
      const _options = {
        type: selectedType,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        includeMetadata,
      };

      let blob: Blob;
      let filename: string;

      switch (format) {
        case 'pdf':
          blob = await exportsApi.exportPortalToPdf('current');
          filename = `${selectedType}-export-${new Date().toISOString().split('T')[0]}.pdf`;
          break;
        case 'csv':
          blob = await exportsApi.exportPortalToCsv('current');
          filename = `${selectedType}-export-${new Date().toISOString().split('T')[0]}.csv`;
          break;
        case 'excel':
          blob = await exportsApi.exportPortalToExcel('current');
          filename = `${selectedType}-export-${new Date().toISOString().split('T')[0]}.xlsx`;
          break;
        default:
          throw new Error('Invalid format');
      }

      exportsApi.downloadBlob(blob, filename);
      
      setRecentExports(prev => [{
        id: Date.now().toString(),
        type: selectedType,
        format,
        timestamp: new Date(),
      }, ...prev.slice(0, 9)]);

      toast.success('Export completed successfully');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const selectedExportType = exportTypes.find(t => t.id === selectedType);

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <Download className="h-8 w-8 text-purple-500" />
          Data Export
        </h1>
        <p className="text-muted-foreground mt-1">
          Export your data in various formats
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Export Types */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-semibold">Select Data to Export</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {exportTypes.map((type) => {
              const Icon = type.icon;
              const isSelected = selectedType === type.id;
              return (
                <Card 
                  key={type.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${isSelected ? 'border-purple-500 border-2 bg-purple-50 dark:bg-purple-900/20' : ''}`}
                  onClick={() => setSelectedType(type.id)}
                >
                  <CardContent className="pt-6">
                    <div className="flex items-start gap-4">
                      <div className={`p-3 rounded-lg ${isSelected ? 'bg-purple-500 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h3 className="font-medium">{type.name}</h3>
                          {isSelected && <CheckCircle2 className="h-5 w-5 text-purple-500" />}
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{type.description}</p>
                        <div className="flex gap-1 mt-2">
                          {type.formats.map(f => (
                            <Badge key={f} variant="secondary" className="text-xs">
                              {f.toUpperCase()}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Export Options */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Export Options</h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Format</Label>
                <Select 
                  value={format} 
                  onValueChange={(v) => setFormat(v as ExportFormat)}
                  disabled={!selectedExportType}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedExportType?.formats || ['csv', 'excel', 'pdf']).map(f => {
                      const FormatIcon = formatIcons[f];
                      return (
                        <SelectItem key={f} value={f}>
                          <div className="flex items-center gap-2">
                            <FormatIcon className="h-4 w-4" />
                            {formatLabels[f]}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Date Range (optional)
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="date"
                    placeholder="From"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                  />
                  <Input
                    type="date"
                    placeholder="To"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="metadata"
                  checked={includeMetadata}
                  onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
                />
                <label htmlFor="metadata" className="text-sm cursor-pointer">
                  Include metadata
                </label>
              </div>

              <Button 
                className="w-full" 
                onClick={handleExport}
                disabled={!selectedType || exporting}
              >
                {exporting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export Data
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Recent Exports */}
          {recentExports.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Exports</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentExports.map((exp) => {
                    const FormatIcon = formatIcons[exp.format];
                    return (
                      <div key={exp.id} className="flex items-center justify-between p-2 rounded-lg bg-accent/50">
                        <div className="flex items-center gap-2">
                          <FormatIcon className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm capitalize">{exp.type}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {exp.timestamp.toLocaleTimeString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Quick Export Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Quick Export</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={async () => {
            setExporting(true);
            try {
              const blob = await exportsApi.exportPortalToCsv('current');
              exportsApi.downloadBlob(blob, `analytics-${new Date().toISOString().split('T')[0]}.csv`);
              toast.success('Analytics exported');
            } catch {
              toast.error('Export failed');
            } finally {
              setExporting(false);
            }
          }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-blue-100 dark:bg-blue-900">
                  <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">Analytics CSV</h3>
                  <p className="text-sm text-muted-foreground">Quick export analytics data</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={async () => {
            setExporting(true);
            try {
              const blob = await exportsApi.exportPortalToPdf('current');
              exportsApi.downloadBlob(blob, `audit-report-${new Date().toISOString().split('T')[0]}.pdf`);
              toast.success('Audit report exported');
            } catch {
              toast.error('Export failed');
            } finally {
              setExporting(false);
            }
          }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-100 dark:bg-red-900">
                  <FileText className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="font-medium">Audit PDF</h3>
                  <p className="text-sm text-muted-foreground">Quick export audit report</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={async () => {
            setExporting(true);
            try {
              const blob = await exportsApi.exportPortalToExcel('current');
              exportsApi.downloadBlob(blob, `users-${new Date().toISOString().split('T')[0]}.xlsx`);
              toast.success('Users exported');
            } catch {
              toast.error('Export failed');
            } finally {
              setExporting(false);
            }
          }}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-100 dark:bg-green-900">
                  <File className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-medium">Users Excel</h3>
                  <p className="text-sm text-muted-foreground">Quick export user data</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
