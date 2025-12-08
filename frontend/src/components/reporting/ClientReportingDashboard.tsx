'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileText, Send, Calendar, Sparkles, Download, Eye } from 'lucide-react';

interface ClientReport {
  id: string;
  title: string;
  clientName: string;
  reportType: string;
  status: string;
  aiGenerated: boolean;
  scheduledFor: string;
  sentAt: string;
  executiveSummary: string;
  keyInsights: any[];
  metrics: any;
  recommendations: any[];
}

export default function ClientReportingDashboard() {
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const workspaceId = 'your-workspace-id';
      
      const [reportsRes, statsRes] = await Promise.all([
        fetch(`/api/client-reports/workspace/${workspaceId}`),
        fetch(`/api/client-reports/workspace/${workspaceId}/stats`)
      ]);

      setReports(await reportsRes.json());
      setStats(await statsRes.json());
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportId: string) => {
    try {
      await fetch(`/api/client-reports/${reportId}/generate`, { method: 'POST' });
      fetchReports();
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT': return 'bg-green-100 text-green-800';
      case 'SCHEDULED': return 'bg-blue-100 text-blue-800';
      case 'GENERATING': return 'bg-yellow-100 text-yellow-800';
      case 'DRAFT': return 'bg-gray-100 text-gray-800';
      case 'FAILED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>;
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Client Reporting</h1>
          <p className="text-muted-foreground mt-1">AI-powered automated client reports</p>
        </div>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          New Report
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Reports</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.total || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.sent || 0} sent</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.scheduled || 0}</div>
            <p className="text-xs text-muted-foreground">Upcoming delivery</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">AI Generated</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.aiGenerated || 0}</div>
            <p className="text-xs text-muted-foreground">{stats?.aiGeneratedPercent?.toFixed(0)}% automation</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Time Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{((stats?.aiGenerated || 0) * 6).toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">Estimated savings</p>
          </CardContent>
        </Card>
      </div>

      {/* Reports List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Generated and scheduled client reports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {reports.map((report) => (
              <div key={report.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent">
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-100">
                    {report.aiGenerated ? <Sparkles className="h-5 w-5 text-blue-600" /> : <FileText className="h-5 w-5 text-blue-600" />}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{report.title}</h3>
                      <Badge className={getStatusColor(report.status)}>{report.status}</Badge>
                      {report.aiGenerated && <Badge variant="outline">AI</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {report.clientName} • {report.reportType}
                    </p>
                    {report.executiveSummary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {report.executiveSummary}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {report.status === 'DRAFT' && (
                    <Button size="sm" variant="outline" onClick={() => generateReport(report.id)}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Generate
                    </Button>
                  )}
                  {report.status === 'SENT' && (
                    <Button size="sm" variant="outline">
                      <Eye className="h-4 w-4 mr-2" />
                      View
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
