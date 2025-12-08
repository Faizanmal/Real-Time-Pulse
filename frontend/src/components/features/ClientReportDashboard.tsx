'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  FileText, Sparkles, Calendar, Send, Clock,
  Plus, RefreshCw, Download, Eye
} from 'lucide-react';
import { clientReportApi } from '@/lib/api-client';

export default function ClientReportDashboard({ workspaceId }: { workspaceId: string }) {
  const [reports, setReports] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [reportsRes, statsRes] = await Promise.all([
        clientReportApi.getReports(workspaceId),
        clientReportApi.getStats(workspaceId),
      ]);
      setReports(reportsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportId: string) => {
    try {
      await clientReportApi.generateReport(reportId);
      await loadData();
    } catch (error) {
      console.error('Failed to generate report:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SENT':
        return 'bg-green-100 text-green-800';
      case 'SCHEDULED':
        return 'bg-blue-100 text-blue-800';
      case 'GENERATING':
        return 'bg-purple-100 text-purple-800';
      case 'DRAFT':
        return 'bg-gray-100 text-gray-800';
      case 'FAILED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Client Reports</h2>
          <p className="text-gray-600 mt-1">AI-powered automated client reporting</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Report
          </Button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <FileText className="h-8 w-8 text-gray-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Sent</p>
                <p className="text-2xl font-bold mt-1">{stats.sent}</p>
              </div>
              <Send className="h-8 w-8 text-green-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Scheduled</p>
                <p className="text-2xl font-bold mt-1">{stats.scheduled}</p>
              </div>
              <Calendar className="h-8 w-8 text-blue-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">AI Generated</p>
                <p className="text-2xl font-bold mt-1">{stats.aiGenerated}</p>
              </div>
              <Sparkles className="h-8 w-8 text-purple-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Drafts</p>
                <p className="text-2xl font-bold mt-1">{stats.draft}</p>
              </div>
              <FileText className="h-8 w-8 text-orange-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Reports List */}
      <Card className="p-6">
        <div className="space-y-4">
          {reports.map((report) => (
            <div key={report.id} className="p-4 border rounded-lg hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-lg font-semibold">{report.title}</h3>
                    <Badge className={getStatusColor(report.status)}>
                      {report.status}
                    </Badge>
                    {report.aiGenerated && (
                      <Badge className="bg-purple-100 text-purple-800">
                        <Sparkles className="h-3 w-3 mr-1" />
                        AI Generated
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mt-1">Client: {report.clientName}</p>
                  <p className="text-sm text-gray-600">Type: {report.reportType}</p>
                  
                  {report.executiveSummary && (
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {report.executiveSummary}
                      </p>
                    </div>
                  )}
                  
                  <div className="flex items-center space-x-4 mt-3 text-sm text-gray-600">
                    {report.scheduledFor && (
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Scheduled: {new Date(report.scheduledFor).toLocaleString()}
                      </span>
                    )}
                    {report.sentAt && (
                      <span className="flex items-center">
                        <Send className="h-4 w-4 mr-1" />
                        Sent: {new Date(report.sentAt).toLocaleString()}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2 ml-4">
                  {report.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      onClick={() => generateReport(report.id)}
                    >
                      <Sparkles className="h-4 w-4 mr-1" />
                      Generate
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Eye className="h-4 w-4" />
                  </Button>
                  {report.pdfUrl && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {reports.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">No Reports Yet</h3>
              <p className="text-gray-600 mt-2">Create your first automated client report</p>
              <Button className="mt-4">
                <Plus className="h-4 w-4 mr-2" />
                Create Report
              </Button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
