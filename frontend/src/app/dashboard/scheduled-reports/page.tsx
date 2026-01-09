'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { scheduledReportsApi, type ScheduledReport, type ReportRun } from '@/lib/api/index';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  FileText, Plus, RefreshCw, Edit, Trash2, Play, Calendar,
  Clock, CheckCircle2, XCircle, Mail, Download, History
} from 'lucide-react';
import { toast } from 'sonner';

const frequencyOptions = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
];

const formatOptions = [
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' },
  { value: 'excel', label: 'Excel' },
  { value: 'html', label: 'HTML' },
];

export default function ScheduledReportsPage() {
  const [reports, setReports] = useState<ScheduledReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedReportHistory, setSelectedReportHistory] = useState<ReportRun[]>([]);
  const [editingReport, setEditingReport] = useState<ScheduledReport | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formFrequency, setFormFrequency] = useState('weekly');
  const [formFormat, setFormFormat] = useState('pdf');
  const [formRecipients, setFormRecipients] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadReports = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scheduledReportsApi.getAll();
      setReports(data);
    } catch (error) {
      console.error('Failed to load reports:', error);
      toast.error('Failed to load scheduled reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormFrequency('weekly');
    setFormFormat('pdf');
    setFormRecipients('');
    setFormActive(true);
    setEditingReport(null);
  };

  const openEditDialog = (report: ScheduledReport) => {
    setEditingReport(report);
    setFormName(report.name);
    setFormDescription(report.description || '');
    setFormFrequency(report.schedule.frequency);
    setFormFormat(report.format);
    setFormRecipients(report.recipients.join(', '));
    setFormActive(report.enabled);
    setCreateDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error('Please enter a report name');
      return;
    }

    const recipients = formRecipients.split(',').map(e => e.trim()).filter(Boolean);
    if (recipients.length === 0) {
      toast.error('Please enter at least one recipient email');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: formName,
        description: formDescription || undefined,
        schedule: {
          frequency: formFrequency as 'daily' | 'weekly' | 'monthly',
          time: '09:00',
          timezone: 'UTC',
        },
        format: formFormat as 'pdf' | 'csv' | 'excel',
        recipients,
        enabled: formActive,
      };

      if (editingReport) {
        await scheduledReportsApi.update(editingReport.id, payload);
        toast.success('Report updated');
      } else {
        await scheduledReportsApi.create(payload);
        toast.success('Report created');
      }
      setCreateDialogOpen(false);
      resetForm();
      loadReports();
    } catch (error) {
      console.error('Save failed:', error);
      toast.error('Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this scheduled report?')) return;

    try {
      await scheduledReportsApi.delete(id);
      toast.success('Report deleted');
      loadReports();
    } catch (error) {
      console.error('Delete failed:', error);
      toast.error('Failed to delete report');
    }
  };

  const handleRunNow = async (id: string) => {
    try {
      await scheduledReportsApi.runNow(id);
      toast.success('Report generation started');
      loadReports();
    } catch (error) {
      console.error('Run failed:', error);
      toast.error('Failed to run report');
    }
  };

  const handleToggle = async (report: ScheduledReport) => {
    try {
      await scheduledReportsApi.update(report.id, { enabled: !report.enabled });
      loadReports();
    } catch (error) {
      console.error('Toggle failed:', error);
      toast.error('Failed to update report');
    }
  };

  const viewHistory = async (reportId: string) => {
    try {
      const history = await scheduledReportsApi.getHistory(reportId);
      setSelectedReportHistory(history);
      setHistoryDialogOpen(true);
    } catch (error) {
      console.error('Failed to load history:', error);
      toast.error('Failed to load report history');
    }
  };

  const stats = {
    total: reports.length,
    active: reports.filter(r => r.enabled).length,
    daily: reports.filter(r => r.schedule.frequency === 'daily').length,
    weekly: reports.filter(r => r.schedule.frequency === 'weekly').length,
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-purple-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Calendar className="h-8 w-8 text-purple-500" />
            Scheduled Reports
          </h1>
          <p className="text-muted-foreground mt-1">
            Automate report generation and delivery
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadReports} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={(open) => { setCreateDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Create Schedule
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingReport ? 'Edit Report Schedule' : 'Create Report Schedule'}</DialogTitle>
                <DialogDescription>
                  Configure automated report generation and delivery
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Report Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Weekly Performance Report"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the report"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    rows={2}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select value={formFrequency} onValueChange={setFormFrequency}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {frequencyOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Format</Label>
                    <Select value={formFormat} onValueChange={setFormFormat}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {formatOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="recipients" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    Recipients
                  </Label>
                  <Input
                    id="recipients"
                    placeholder="email1@example.com, email2@example.com"
                    value={formRecipients}
                    onChange={(e) => setFormRecipients(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Separate multiple emails with commas</p>
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="active">Active</Label>
                  <Switch
                    id="active"
                    checked={formActive}
                    onCheckedChange={setFormActive}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setCreateDialogOpen(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    editingReport ? 'Update' : 'Create'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Schedules</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Daily</p>
                <p className="text-2xl font-bold">{stats.daily}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Weekly</p>
                <p className="text-2xl font-bold">{stats.weekly}</p>
              </div>
              <Calendar className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Report List */}
      <Card>
        <CardHeader>
          <CardTitle>Report Schedules</CardTitle>
          <CardDescription>Manage your automated report schedules</CardDescription>
        </CardHeader>
        <CardContent>
          {reports.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No scheduled reports</h3>
              <p className="text-muted-foreground mb-4">Create a schedule to automate report delivery</p>
              <Button onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Schedule
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {reports.map((report, index) => (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${report.enabled ? 'bg-green-100 dark:bg-green-900' : 'bg-gray-100 dark:bg-gray-800'}`}>
                        <FileText className={`h-5 w-5 ${report.enabled ? 'text-green-600' : 'text-gray-500'}`} />
                      </div>
                      <div>
                        <p className="font-medium">{report.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{report.schedule.frequency}</Badge>
                          <Badge variant="secondary">{report.format.toUpperCase()}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {report.recipients.length} recipients
                          </span>
                        </div>
                        {report.nextRunAt && (
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Next run: {new Date(report.nextRunAt).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={report.enabled}
                        onCheckedChange={() => handleToggle(report)}
                      />
                      <Button variant="ghost" size="icon" onClick={() => viewHistory(report.id)} title="History">
                        <History className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleRunNow(report.id)} title="Run Now">
                        <Play className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(report)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(report.id)} className="text-red-500 hover:text-red-600" title="Delete">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Report Run History</DialogTitle>
            <DialogDescription>
              Previous report generations and their status
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            {selectedReportHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No runs yet</p>
            ) : (
              <div className="space-y-2">
                {selectedReportHistory.map((run) => (
                  <div key={run.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      {run.status === 'completed' ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : run.status === 'failed' ? (
                        <XCircle className="h-5 w-5 text-red-500" />
                      ) : (
                        <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />
                      )}
                      <div>
                        <p className="text-sm font-medium capitalize">{run.status}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(run.startedAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {run.error && (
                        <span className="text-xs text-red-500">{run.error}</span>
                      )}
                      {run.downloadUrl && (
                        <Button variant="ghost" size="sm" asChild>
                          <a href={run.downloadUrl} download>
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
