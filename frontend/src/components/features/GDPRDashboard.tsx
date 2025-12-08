'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Shield, CheckCircle, XCircle, FileText, Users,
  Plus, RefreshCw, Download, AlertTriangle, Clock
} from 'lucide-react';
import { gdprApi } from '@/lib/api-client';

export default function GDPRDashboard({ workspaceId }: { workspaceId: string }) {
  const [dashboard, setDashboard] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, requestsRes, consentsRes] = await Promise.all([
        gdprApi.getDashboard(workspaceId),
        gdprApi.getDataRequests(workspaceId),
        gdprApi.getConsents(workspaceId),
      ]);
      setDashboard(dashboardRes.data);
      setRequests(requestsRes.data);
      setConsents(consentsRes.data);
    } catch (error) {
      console.error('Failed to load GDPR data:', error);
    } finally {
      setLoading(false);
    }
  };

  const processRequest = async (requestId: string) => {
    try {
      await gdprApi.processDataRequest(requestId, 'current-user');
      await loadData();
    } catch (error) {
      console.error('Failed to process request:', error);
    }
  };

  const getRequestStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800';
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800';
      case 'PENDING':
        return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getComplianceScoreColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
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
          <h2 className="text-3xl font-bold">GDPR Compliance</h2>
          <p className="text-gray-600 mt-1">Manage consent, data requests, and compliance</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Button>
        </div>
      </div>

      {/* Compliance Score */}
      {dashboard && (
        <>
          <Card className="p-8 bg-gradient-to-br from-blue-50 to-purple-50">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-gray-600 uppercase">Compliance Score</h3>
                <p className={`text-5xl font-bold mt-2 ${getComplianceScoreColor(dashboard.complianceScore)}`}>
                  {dashboard.complianceScore}/100
                </p>
                <p className="text-gray-600 mt-2">
                  {dashboard.complianceScore >= 90
                    ? 'Excellent compliance posture'
                    : dashboard.complianceScore >= 70
                    ? 'Good compliance with room for improvement'
                    : 'Requires immediate attention'}
                </p>
              </div>
              <div className="w-32 h-32">
                <svg className="w-full h-full transform -rotate-90">
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke="#e5e7eb"
                    strokeWidth="12"
                    fill="none"
                  />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    stroke={dashboard.complianceScore >= 90 ? '#22c55e' : dashboard.complianceScore >= 70 ? '#eab308' : '#ef4444'}
                    strokeWidth="12"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - dashboard.complianceScore / 100)}`}
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Active Consents</p>
                  <p className="text-2xl font-bold mt-1">{dashboard.consentStats.active}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-500" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Pending Requests</p>
                  <p className="text-2xl font-bold mt-1">{dashboard.requestStats.pending}</p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Completed</p>
                  <p className="text-2xl font-bold mt-1">{dashboard.requestStats.completed}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-500" />
              </div>
            </Card>
            <Card className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Avg Response</p>
                  <p className="text-2xl font-bold mt-1">{dashboard.requestStats.avgResponseTimeHours.toFixed(0)}h</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </Card>
          </div>
        </>
      )}

      {/* Data Requests */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Data Subject Requests</h3>
        <div className="space-y-3">
          {requests.slice(0, 10).map((request) => (
            <div key={request.id} className="p-4 border rounded-lg">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <h4 className="font-semibold">{request.requesterEmail}</h4>
                    <Badge className={getRequestStatusColor(request.status)}>
                      {request.status}
                    </Badge>
                    <Badge variant="outline">{request.requestType}</Badge>
                  </div>
                  {request.requesterName && (
                    <p className="text-sm text-gray-600 mt-1">{request.requesterName}</p>
                  )}
                  <p className="text-sm text-gray-600 mt-1">
                    Submitted: {new Date(request.submittedAt).toLocaleString()}
                  </p>
                  {request.processedAt && (
                    <p className="text-sm text-gray-600">
                      Processed: {new Date(request.processedAt).toLocaleString()}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2">
                  {request.status === 'PENDING' && (
                    <Button
                      size="sm"
                      onClick={() => processRequest(request.id)}
                    >
                      Process
                    </Button>
                  )}
                  {request.dataExportUrl && (
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {requests.length === 0 && (
            <div className="text-center py-12">
              <Shield className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">No Data Requests</h3>
              <p className="text-gray-600 mt-2">All data subject requests will appear here</p>
            </div>
          )}
        </div>
      </Card>

      {/* Recent Consents */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Consents</h3>
        <div className="space-y-2">
          {consents.slice(0, 5).map((consent) => (
            <div key={consent.id} className="flex items-center justify-between p-3 border rounded">
              <div>
                <p className="font-medium">{consent.subjectEmail}</p>
                <p className="text-sm text-gray-600">{consent.purpose}</p>
                <p className="text-xs text-gray-500 mt-1">
                  {consent.consentType} - {new Date(consent.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {consent.consented ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-red-500" />
                )}
                <Badge variant={consent.consented ? 'default' : 'secondary'}>
                  {consent.consented ? 'Granted' : 'Revoked'}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
