'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Send, Calendar, Building } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface ClientReport {
  id: string;
  clientId: string;
  clientName: string;
  reportType: string;
  title: string;
  status: string;
  generatedAt: string;
  sentAt: string | null;
  fileUrl: string;
}

export default function ClientReports() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [clients, setClients] = useState<{id: string; name: string}[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    clientId: '',
    reportType: 'monthly',
    title: '',
    description: '',
    dateRange: '30d'
  });

  const fetchReports = useCallback(async () => {
    try {
      const response = await fetch('/api/client-report');
      const data = await response.json();
      setReports(data);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    }
  }, []);

  const _fetchClients = useCallback(async () => {
    try {
      const response = await fetch('/api/clients');
      const data = await response.json();
      setClients(data);
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const loadReports = async () => {
      try {
        const response = await fetch('/api/client-report');
        const data = await response.json();
        if (mounted) setReports(data);
      } catch (error) {
        console.error('Failed to fetch reports:', error);
      }
    };
    const loadClients = async () => {
      try {
        const response = await fetch('/api/clients');
        const data = await response.json();
        if (mounted) setClients(data);
      } catch (error) {
        console.error('Failed to fetch clients:', error);
      }
    };
    loadReports();
    loadClients();
    return () => { mounted = false; };
  }, []);

  const generateReport = async () => {
    try {
      await fetch('/api/client-report/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchReports();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const sendReport = async (reportId: string) => {
    try {
      await fetch(`/api/client-report/${reportId}/send`, { method: 'POST' });
      fetchReports();
    } catch (error) {
      console.error('Failed to send report:', error);
    }
  };

  const downloadReport = async (reportId: string) => {
    try {
      const response = await fetch(`/api/client-report/${reportId}/download`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `report-${reportId}.pdf`;
      a.click();
    } catch (error) {
      console.error('Failed to download report:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      clientId: '',
      reportType: 'monthly',
      title: '',
      description: '',
      dateRange: '30d'
    });
  };

  const reportTypes = ['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Client Reports
          </h1>
          <p className="text-muted-foreground">Generate and manage client reports</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <FileText className="h-4 w-4 mr-2" />
              Generate Report
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate Client Report</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Client</Label>
                <Select value={formData.clientId} onValueChange={(value) => setFormData({ ...formData, clientId: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map(client => (
                      <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Report Type</Label>
                <Select value={formData.reportType} onValueChange={(value) => setFormData({ ...formData, reportType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {reportTypes.map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Monthly Performance Report"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Report description..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Date Range</Label>
                <Select value={formData.dateRange} onValueChange={(value) => setFormData({ ...formData, dateRange: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 days</SelectItem>
                    <SelectItem value="30d">Last 30 days</SelectItem>
                    <SelectItem value="90d">Last 90 days</SelectItem>
                    <SelectItem value="1y">Last year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={generateReport}>Generate</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <Card key={report.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building className="h-4 w-4" />
                    {report.title}
                  </CardTitle>
                  <CardDescription className="mt-1">{report.clientName}</CardDescription>
                </div>
                <Badge variant={report.status === 'sent' ? 'default' : 'secondary'}>
                  {report.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    {report.reportType}
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Generated: {new Date(report.generatedAt).toLocaleDateString()}
                  </span>
                  {report.sentAt && (
                    <span className="flex items-center gap-1">
                      <Send className="h-3 w-3" />
                      Sent: {new Date(report.sentAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => downloadReport(report.id)}>
                    <Download className="h-3 w-3 mr-1" />
                    Download
                  </Button>
                  {report.status !== 'sent' && (
                    <Button size="sm" onClick={() => sendReport(report.id)}>
                      <Send className="h-3 w-3 mr-1" />
                      Send to Client
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {reports.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No reports generated yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
