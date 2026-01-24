'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Clock, Play, Calendar, FileText, Trash2, Edit } from 'lucide-react';

interface ScheduledJob {
  id: string;
  name: string;
  type: string;
  schedule: string;
  nextRun: string;
  lastRun: string | null;
  status: 'active' | 'paused' | 'failed';
  config: Record<string, unknown>;
  enabled: boolean;
}

export default function JobsScheduledReports() {
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'report',
    schedule: '0 9 * * *',
    config: {}
  });

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch('/api/jobs');
      const data = await response.json();
      setJobs(data);
    } catch (error) {
      console.error('Failed to fetch jobs:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/jobs');
        const data = await response.json();
        if (mounted) setJobs(data);
      } catch (error) {
        console.error('Failed to fetch jobs:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      type: 'report',
      schedule: '0 9 * * *',
      config: {}
    });
  }, []);

  const createJob = useCallback(async () => {
    try {
      await fetch('/api/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchJobs();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create job:', error);
    }
  }, [formData, fetchJobs, resetForm]);

  const toggleJob = useCallback(async (id: string, enabled: boolean) => {
    try {
      await fetch(`/api/jobs/${id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      fetchJobs();
    } catch (error) {
      console.error('Failed to toggle job:', error);
    }
  }, [fetchJobs]);

  const runJobNow = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}/run`, { method: 'POST' });
      fetchJobs();
    } catch (error) {
      console.error('Failed to run job:', error);
    }
  }, [fetchJobs]);

  const deleteJob = useCallback(async (id: string) => {
    try {
      await fetch(`/api/jobs/${id}`, { method: 'DELETE' });
      fetchJobs();
    } catch (error) {
      console.error('Failed to delete job:', error);
    }
  }, [fetchJobs]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'default';
      case 'paused': return 'secondary';
      case 'failed': return 'destructive';
      default: return 'outline';
    }
  };

  const jobTypes = ['report', 'export', 'backup', 'cleanup', 'notification'];
  const schedulePresets = [
    { label: 'Every hour', value: '0 * * * *' },
    { label: 'Daily at 9 AM', value: '0 9 * * *' },
    { label: 'Weekly on Monday', value: '0 9 * * 1' },
    { label: 'Monthly on 1st', value: '0 9 1 * *' }
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="h-8 w-8" />
            Scheduled Jobs & Reports
          </h1>
          <p className="text-muted-foreground">Automate report generation and tasks</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Calendar className="h-4 w-4 mr-2" />
              Schedule New Job
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schedule New Job</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Job Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Daily Sales Report"
                />
              </div>
              <div>
                <Label>Job Type</Label>
                <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {jobTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Schedule (Cron)</Label>
                <Select value={formData.schedule} onValueChange={(value) => setFormData({ ...formData, schedule: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {schedulePresets.map(preset => (
                      <SelectItem key={preset.value} value={preset.value}>{preset.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Custom Cron Expression</Label>
                <Input
                  value={formData.schedule}
                  onChange={(e) => setFormData({ ...formData, schedule: e.target.value })}
                  placeholder="0 9 * * *"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createJob}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jobs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {jobs.filter(j => j.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Paused</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {jobs.filter(j => j.status === 'paused').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Failed</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {jobs.filter(j => j.status === 'failed').length}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {jobs.map((job) => (
          <Card key={job.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    {job.name}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {job.type} • {job.schedule}
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusColor(job.status)}>
                    {job.status}
                  </Badge>
                  <Switch
                    checked={job.enabled}
                    onCheckedChange={(checked) => toggleJob(job.id, checked)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="grid md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Next Run:</span>
                    <span className="ml-2 font-semibold">
                      {new Date(job.nextRun).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Last Run:</span>
                    <span className="ml-2">
                      {job.lastRun ? new Date(job.lastRun).toLocaleString() : 'Never'}
                    </span>
                  </div>
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => runJobNow(job.id)}>
                    <Play className="h-3 w-3 mr-1" />
                    Run Now
                  </Button>
                  <Button size="sm" variant="outline">
                    <Edit className="h-3 w-3 mr-1" />
                    Edit
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteJob(job.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
