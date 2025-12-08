'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar,
  Plus,
  Trash2,
  Play,
  Eye,
  Clock,
  Mail,
  FileText,
  MoreVertical,
} from 'lucide-react';
import {
  scheduledReportsApi,
  ScheduledReport,
  CreateScheduledReportDto,
  downloadBlob,
} from '@/lib/enterprise-api';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ScheduledReportsManagerProps {
  className?: string;
  portalId?: string;
}

export function ScheduledReportsManager({
  className,
  portalId,
}: ScheduledReportsManagerProps) {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadReports = useCallback(async () => {
    try {
      const data = await scheduledReportsApi.getAll();
      setReports(portalId ? data.filter((r) => r.portalId === portalId) : data);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  }, [portalId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const deleteReport = async (reportId: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;

    try {
      await scheduledReportsApi.delete(reportId);
      setReports(reports.filter((r) => r.id !== reportId));
      toast.success('Report deleted');
    } catch (error) {
      console.error('Failed to delete report:', error);
      toast.error('Failed to delete report');
    }
  };

  const sendNow = async (reportId: string) => {
    try {
      await scheduledReportsApi.sendNow(reportId);
      toast.success('Report sent successfully');
      loadReports();
    } catch (error) {
      console.error('Failed to send report:', error);
      toast.error('Failed to send report');
    }
  };

  const previewReport = async (report: ScheduledReport) => {
    try {
      const blob = await scheduledReportsApi.preview(report.id);
      downloadBlob(blob, `${report.name}-preview.${report.format}`);
      toast.success('Preview downloaded');
    } catch (error) {
      console.error('Failed to preview report:', error);
      toast.error('Failed to generate preview');
    }
  };

  const toggleReport = async (reportId: string, isActive: boolean) => {
    try {
      await scheduledReportsApi.update(reportId, { isActive });
      setReports(reports.map((r) => (r.id === reportId ? { ...r, isActive } : r)));
      toast.success(`Report ${isActive ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Failed to update report:', error);
      toast.error('Failed to update report');
    }
  };

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Calendar className="h-5 w-5 text-green-500" />
          <h3 className="text-lg font-semibold">Scheduled Reports</h3>
          {reports.length > 0 && (
            <Badge variant="secondary">{reports.length}</Badge>
          )}
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Schedule Report
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <ScheduledReportForm
              portalId={portalId}
              onSuccess={() => {
                setIsDialogOpen(false);
                loadReports();
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-24 bg-gray-200 rounded"></div>
          <div className="h-24 bg-gray-200 rounded"></div>
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No scheduled reports configured.</p>
          <p className="text-sm">Create your first report to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <ReportCard
              key={report.id}
              report={report}
              onDelete={deleteReport}
              onSendNow={sendNow}
              onPreview={previewReport}
              onToggle={toggleReport}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface ReportCardProps {
  report: ScheduledReport;
  onDelete: (id: string) => void;
  onSendNow: (id: string) => void;
  onPreview: (report: ScheduledReport) => void;
  onToggle: (id: string, isActive: boolean) => void;
}

function ReportCard({
  report,
  onDelete,
  onSendNow,
  onPreview,
  onToggle,
}: ReportCardProps) {
  const formatSchedule = (schedule: ScheduledReport['schedule']) => {
    const time = `${schedule.hour.toString().padStart(2, '0')}:${schedule.minute.toString().padStart(2, '0')}`;
    switch (schedule.frequency) {
      case 'daily':
        return `Daily at ${time}`;
      case 'weekly':
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        return `Every ${days[schedule.dayOfWeek || 0]} at ${time}`;
      case 'monthly':
        return `Monthly on day ${schedule.dayOfMonth || 1} at ${time}`;
      default:
        return schedule.frequency;
    }
  };

  const formatBadge = (format: string) => {
    const colors: Record<string, string> = {
      pdf: 'bg-red-100 text-red-800',
      csv: 'bg-green-100 text-green-800',
      excel: 'bg-blue-100 text-blue-800',
    };
    return colors[format] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h4 className="font-semibold">{report.name}</h4>
            <Badge className={formatBadge(report.format)}>
              {report.format.toUpperCase()}
            </Badge>
            {report.isActive ? (
              <Badge variant="default" className="bg-green-500">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Paused</Badge>
            )}
          </div>

          {report.description && (
            <p className="text-sm text-gray-600 mb-3">{report.description}</p>
          )}

          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-gray-400" />
              <span>{formatSchedule(report.schedule)}</span>
              <span className="text-gray-400">({report.schedule.timezone})</span>
            </div>

            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <span>{report.recipients.length} recipient(s)</span>
            </div>

            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-gray-400" />
              <span>
                {report.includeCharts && 'Charts'}
                {report.includeCharts && report.includeTables && ' + '}
                {report.includeTables && 'Tables'}
              </span>
            </div>

            {report.nextScheduledAt && (
              <div className="text-xs text-gray-500">
                Next send: {new Date(report.nextScheduledAt).toLocaleString()}
              </div>
            )}

            {report.lastSentAt && (
              <div className="text-xs text-gray-500">
                Last sent: {new Date(report.lastSentAt).toLocaleString()} ({report.sendCount} times)
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Switch
            checked={report.isActive}
            onCheckedChange={(checked) => onToggle(report.id, checked)}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onSendNow(report.id)}>
                <Play className="h-4 w-4 mr-2" />
                Send Now
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onPreview(report)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(report.id)}
                className="text-red-600"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

interface ScheduledReportFormProps {
  portalId?: string;
  onSuccess: () => void;
}

function ScheduledReportForm({ portalId, onSuccess }: ScheduledReportFormProps) {
  const [formData, setFormData] = useState<CreateScheduledReportDto>({
    name: '',
    description: '',
    portalId: portalId || '',
    format: 'pdf',
    schedule: {
      frequency: 'weekly',
      dayOfWeek: 1,
      hour: 9,
      minute: 0,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
    recipients: [],
    includeCharts: true,
    includeTables: true,
    customMessage: '',
    isActive: true,
  });
  const [emailInput, setEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const addEmail = () => {
    if (emailInput && emailInput.includes('@')) {
      setFormData({
        ...formData,
        recipients: [...formData.recipients, emailInput],
      });
      setEmailInput('');
    }
  };

  const removeEmail = (email: string) => {
    setFormData({
      ...formData,
      recipients: formData.recipients.filter((e) => e !== email),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.portalId) {
      toast.error('Please select a portal');
      return;
    }
    if (formData.recipients.length === 0) {
      toast.error('Please add at least one recipient');
      return;
    }

    setSubmitting(true);
    try {
      await scheduledReportsApi.create(formData);
      toast.success('Scheduled report created successfully');
      onSuccess();
    } catch (error) {
      console.error('Failed to create report:', error);
      toast.error('Failed to create scheduled report');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>Schedule Report</DialogTitle>
        <DialogDescription>
          Set up automated report delivery to your team
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="name">Report Name *</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Weekly Dashboard Summary"
            required
          />
        </div>

        <div>
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) =>
              setFormData({ ...formData, description: e.target.value })
            }
            placeholder="Summary of key metrics and insights"
          />
        </div>

        {!portalId && (
          <div>
            <Label htmlFor="portalId">Portal ID *</Label>
            <Input
              id="portalId"
              value={formData.portalId}
              onChange={(e) =>
                setFormData({ ...formData, portalId: e.target.value })
              }
              placeholder="portal-123"
              required
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="format">Format *</Label>
            <Select
              value={formData.format}
              onValueChange={(value: 'pdf' | 'csv' | 'excel') =>
                setFormData({ ...formData, format: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pdf">PDF</SelectItem>
                <SelectItem value="csv">CSV</SelectItem>
                <SelectItem value="excel">Excel</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="frequency">Frequency *</Label>
            <Select
              value={formData.schedule.frequency}
              onValueChange={(value: 'daily' | 'weekly' | 'monthly') =>
                setFormData({
                  ...formData,
                  schedule: { ...formData.schedule, frequency: value },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {formData.schedule.frequency === 'weekly' && (
          <div>
            <Label>Day of Week</Label>
            <Select
              value={formData.schedule.dayOfWeek?.toString()}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  schedule: { ...formData.schedule, dayOfWeek: parseInt(value) },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sunday</SelectItem>
                <SelectItem value="1">Monday</SelectItem>
                <SelectItem value="2">Tuesday</SelectItem>
                <SelectItem value="3">Wednesday</SelectItem>
                <SelectItem value="4">Thursday</SelectItem>
                <SelectItem value="5">Friday</SelectItem>
                <SelectItem value="6">Saturday</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {formData.schedule.frequency === 'monthly' && (
          <div>
            <Label>Day of Month</Label>
            <Select
              value={formData.schedule.dayOfMonth?.toString()}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  schedule: { ...formData.schedule, dayOfMonth: parseInt(value) },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                  <SelectItem key={day} value={day.toString()}>
                    {day}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Hour</Label>
            <Select
              value={formData.schedule.hour.toString()}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  schedule: { ...formData.schedule, hour: parseInt(value) },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => i).map((hour) => (
                  <SelectItem key={hour} value={hour.toString()}>
                    {hour.toString().padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Timezone</Label>
            <Input
              value={formData.schedule.timezone}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  schedule: { ...formData.schedule, timezone: e.target.value },
                })
              }
            />
          </div>
        </div>

        <div>
          <Label>Recipients *</Label>
          <div className="flex gap-2">
            <Input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="email@example.com"
              onKeyPress={(e) =>
                e.key === 'Enter' && (e.preventDefault(), addEmail())
              }
            />
            <Button type="button" onClick={addEmail} variant="outline">
              Add
            </Button>
          </div>
          {formData.recipients.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {formData.recipients.map((email) => (
                <Badge key={email} variant="secondary" className="gap-1">
                  {email}
                  <button
                    type="button"
                    onClick={() => removeEmail(email)}
                    className="ml-1 hover:text-red-600"
                  >
                    ×
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <Label>Include in Report</Label>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.includeCharts}
                onChange={(e) =>
                  setFormData({ ...formData, includeCharts: e.target.checked })
                }
              />
              <span className="text-sm">Charts</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.includeTables}
                onChange={(e) =>
                  setFormData({ ...formData, includeTables: e.target.checked })
                }
              />
              <span className="text-sm">Tables</span>
            </label>
          </div>
        </div>

        <div>
          <Label htmlFor="customMessage">Custom Message</Label>
          <Textarea
            id="customMessage"
            value={formData.customMessage}
            onChange={(e) =>
              setFormData({ ...formData, customMessage: e.target.value })
            }
            placeholder="Add a personal message to include with the report..."
          />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="button" variant="outline" onClick={onSuccess}>
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Creating...' : 'Create Report'}
        </Button>
      </div>
    </form>
  );
}
