'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, Clock, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ComplianceRecommendation {
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  action: string;
  impact: string;
}

interface ComplianceDashboard {
  overallScore: number;
  complianceScore: number;
  consentStats: Record<string, number>;
  requestStats: Record<string, number>;
  categories: Array<{
    name: string;
    score: number;
    status: string;
    issues: string[];
  }>;
  recommendations?: ComplianceRecommendation[];
}

export default function GDPRComplianceDashboard() {
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchComplianceData();
  }, []);

  const fetchComplianceData = async () => {
    try {
      const workspaceId = 'your-workspace-id';
      const res = await fetch(`/api/gdpr/compliance/dashboard/${workspaceId}`);
      setDashboard(await res.json());
    } catch (error) {
      console.error('Failed to fetch compliance data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-96">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
    </div>;
  }

  const consents = dashboard?.consentStats || {};
  const requests = dashboard?.requestStats || {};
  const score = dashboard?.complianceScore || 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">GDPR Compliance</h1>
          <p className="text-muted-foreground mt-1">Automated compliance management and reporting</p>
        </div>
        <Button>
          <FileText className="h-4 w-4 mr-2" />
          Generate Report
        </Button>
      </div>

      {/* Compliance Score */}
      <Card>
        <CardHeader>
          <CardTitle>Overall Compliance Score</CardTitle>
          <CardDescription>Your GDPR compliance health score</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-5xl font-bold ${getScoreColor(score)}">{score}/100</span>
                <Badge variant={score >= 90 ? 'default' : score >= 75 ? 'secondary' : 'destructive'}>
                  {score >= 90 ? 'Excellent' : score >= 75 ? 'Good' : 'Needs Improvement'}
                </Badge>
              </div>
              <Progress value={score} className="h-3" />
              <p className="text-sm text-muted-foreground mt-2">
                {score >= 90 ? 'Your GDPR compliance is excellent!' : score >= 75 ? 'Good compliance with minor improvements needed' : 'Action required to improve compliance'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Active Consents</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{consents.active || 0}</div>
            <p className="text-xs text-muted-foreground">{consents.total || 0} total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Data Requests</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.total || 0}</div>
            <p className="text-xs text-muted-foreground">{requests.PENDING || 0} pending</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{requests.avgResponseTimeHours?.toFixed(0)}h</div>
            <p className="text-xs text-muted-foreground">Target: &lt;24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Expired Consents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{consents.expired || 0}</div>
            <p className="text-xs text-muted-foreground">Require renewal</p>
          </CardContent>
        </Card>
      </div>

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle>Recommendations</CardTitle>
          <CardDescription>Actions to improve compliance</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {dashboard?.recommendations?.map((rec: ComplianceRecommendation, idx: number) => (
              <div key={idx} className="flex items-start gap-4 p-4 border rounded-lg">
                <div className={`p-2 rounded-full ${rec.priority === 'high' ? 'bg-red-100' : rec.priority === 'medium' ? 'bg-yellow-100' : 'bg-blue-100'}`}>
                  <Shield className={`h-5 w-5 ${rec.priority === 'high' ? 'text-red-600' : rec.priority === 'medium' ? 'text-yellow-600' : 'text-blue-600'}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{rec.title}</h3>
                    <Badge variant={rec.priority === 'high' ? 'destructive' : rec.priority === 'medium' ? 'secondary' : 'default'}>
                      {rec.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{rec.action}</p>
                  <p className="text-xs text-green-600">Expected Impact: {rec.impact}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Consent Management */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Consent Status</CardTitle>
            <CardDescription>User consent tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Active</span>
                <span className="text-2xl font-bold text-green-600">{consents.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Revoked</span>
                <span className="text-2xl font-bold text-gray-600">{consents.revoked}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Expired</span>
                <span className="text-2xl font-bold text-red-600">{consents.expired}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Request Status</CardTitle>
            <CardDescription>GDPR data requests</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {Object.entries(requests.byStatus || {}).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-sm font-medium">{status}</span>
                  <span className="text-2xl font-bold">{count as number}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
