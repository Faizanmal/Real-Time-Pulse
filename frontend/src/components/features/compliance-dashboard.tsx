'use client';

import { useState, useEffect } from 'react';
import { complianceApi } from '@/lib/advanced-api';
import type { ComplianceDashboard, SecurityIncident } from '@/types/advanced-features';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Shield, AlertTriangle, Database, FileCheck, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function ComplianceDashboard() {
  const [dashboard, setDashboard] = useState<ComplianceDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      const response = await complianceApi.getDashboard();
      const data = response.data;

      // Validate structure matches ComplianceDashboard interface
      if (data && data.overview && data.incidents && data.dataInventory && data.frameworks) {
        setDashboard(data);
      } else {
        console.warn('Invalid compliance dashboard data:', data);
        // Fallback to null or default if needed, but for now just don't set invalid data
        // forcing the Loading... or handling it otherwise. 
        // Actually best to set a default "empty" state if possible or keep loading false and dashboard null
        // But dashboard null triggers "if (!dashboard) return null" which renders nothing.
        // Let's keep dashboard null to avoid crashes and maybe show error toast.
        setDashboard(null); // Keep or set to null
        if (!data || Object.keys(data).length === 0) {
          // If completely empty, maybe it's a 404 or backend issue, handled by catch usually but here we got 200 OK with bad data?
        }
      }
    } catch (error: any) {
      console.error('Failed to load compliance dashboard:', error);
      toast.error('Failed to load compliance dashboard');
      setDashboard(null);
    } finally {
      setLoading(false);
    }
  };

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'text-green-600';
    if (score >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getSeverityColor = (severity: string) => {
    const colors = {
      CRITICAL: 'bg-red-100 text-red-800',
      HIGH: 'bg-orange-100 text-orange-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      LOW: 'bg-blue-100 text-blue-800',
    };
    return colors[severity as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-16 bg-gray-200 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center space-y-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <h3 className="text-lg font-semibold">Unable to load dashboard</h3>
        <p className="text-muted-foreground max-w-sm">
          There was a problem loading the compliance data. Please try again later.
        </p>
        <Button onClick={loadDashboard}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Compliance Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor your security and compliance posture
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/compliance/assessments/new">
            <Button>Run Assessment</Button>
          </Link>
          <Link href="/compliance/incidents/new">
            <Button variant="outline">Report Incident</Button>
          </Link>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Compliance Score</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getComplianceColor(dashboard.overview.complianceScore)}`}>
              {dashboard.overview.complianceScore}%
            </div>
            <Progress value={dashboard.overview.complianceScore} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {dashboard.overview.complianceStatus.replace(/_/g, ' ')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Incidents</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.incidents.open}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {dashboard.incidents.critical} critical
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Data Assets</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.dataInventory.total}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {dashboard.dataInventory.sensitive} sensitive
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Frameworks</CardTitle>
            <FileCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dashboard.frameworks.length}</div>
            <p className="text-xs text-muted-foreground mt-2">
              {dashboard.overview.nextAssessment
                ? `Next: ${new Date(dashboard.overview.nextAssessment).toLocaleDateString()}`
                : 'No assessments scheduled'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Security Incidents</CardTitle>
            <Link href="/compliance/incidents">
              <Button variant="outline" size="sm">
                View All
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {dashboard.incidents.recent.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No recent incidents</p>
          ) : (
            <div className="space-y-4">
              {dashboard.incidents.recent.map((incident) => (
                <div
                  key={incident.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{incident.title}</h4>
                      <Badge className={getSeverityColor(incident.severity)} variant="secondary">
                        {incident.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{incident.description}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(incident.detectedAt).toLocaleString()}
                    </p>
                  </div>
                  <Link href={`/compliance/incidents/${incident.id}`}>
                    <Button variant="outline" size="sm">
                      Details
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Data Inventory */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Data by Sensitivity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(dashboard.dataInventory.bySensitivity).map(([sensitivity, count]) => (
                <div key={sensitivity} className="flex items-center justify-between">
                  <span className="text-sm">{sensitivity}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary"
                        style={{
                          width: `${(count / dashboard.dataInventory.total) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium w-8 text-right">{count}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Object.entries(dashboard.dataInventory.byCategory)
                .slice(0, 5)
                .map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <span className="text-sm">{category}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{
                            width: `${(count / dashboard.dataInventory.total) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Compliance Frameworks */}
      <Card>
        <CardHeader>
          <CardTitle>Compliance Frameworks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {dashboard.frameworks.map((framework) => (
              <Card key={framework.id}>
                <CardHeader>
                  <CardTitle className="text-base">{framework.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">{framework.description}</p>
                  <Link href={`/compliance/frameworks/${framework.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Details
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
