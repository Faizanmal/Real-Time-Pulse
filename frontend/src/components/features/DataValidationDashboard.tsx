'use client';

import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Shield, AlertCircle, CheckCircle, Info, XCircle,
  Plus, RefreshCw, Filter, TrendingDown
} from 'lucide-react';
import { dataValidationApi } from '@/lib/api-client';

export default function DataValidationDashboard({ workspaceId }: { workspaceId: string }) {
  const [rules, setRules] = useState<any[]>([]);
  const [violations, setViolations] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showNewRule, setShowNewRule] = useState(false);

  useEffect(() => {
    loadData();
  }, [workspaceId]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [rulesRes, violationsRes, statsRes] = await Promise.all([
        dataValidationApi.getRules(workspaceId),
        dataValidationApi.getViolations(workspaceId, { resolved: false }),
        dataValidationApi.getStats(workspaceId, 7),
      ]);
      setRules(rulesRes.data);
      setViolations(violationsRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Failed to load validation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const resolveViolation = async (violationId: string) => {
    try {
      await dataValidationApi.resolveViolation(violationId, 'user-id', 'Resolved manually');
      await loadData();
    } catch (error) {
      console.error('Failed to resolve violation:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'ERROR':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'WARNING':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'INFO':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
      case 'ERROR':
        return <XCircle className="h-5 w-5" />;
      case 'WARNING':
        return <AlertCircle className="h-5 w-5" />;
      case 'INFO':
        return <Info className="h-5 w-5" />;
      default:
        return <Shield className="h-5 w-5" />;
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
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Data Validation</h2>
          <p className="text-gray-600 mt-1">Automated quality checks and violation tracking</p>
        </div>
        <div className="flex space-x-2">
          <Button onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowNewRule(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New Rule
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Issues</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-gray-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unresolved</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{stats.unresolved}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Critical</p>
                <p className="text-2xl font-bold mt-1">{stats.bySeverity.CRITICAL}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Warnings</p>
                <p className="text-2xl font-bold mt-1">{stats.bySeverity.WARNING}</p>
              </div>
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            </div>
          </Card>
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Resolved</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{stats.resolved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </Card>
        </div>
      )}

      {/* Active Rules */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Active Validation Rules</h3>
        <div className="space-y-3">
          {rules.filter(r => r.enabled).map((rule) => (
            <div key={rule.id} className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-4">
                <Shield className="h-5 w-5 text-blue-500" />
                <div>
                  <h4 className="font-medium">{rule.name}</h4>
                  <p className="text-sm text-gray-600">{rule.description}</p>
                  <div className="flex items-center space-x-2 mt-1">
                    <Badge variant="outline">{rule.ruleType}</Badge>
                    <Badge className={getSeverityColor(rule.severity)}>
                      {rule.severity}
                    </Badge>
                    {rule.violations?.length > 0 && (
                      <Badge variant="destructive">
                        {rule.violations.length} violations
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Edit
              </Button>
            </div>
          ))}
          {rules.filter(r => r.enabled).length === 0 && (
            <p className="text-center text-gray-500 py-8">No active rules</p>
          )}
        </div>
      </Card>

      {/* Recent Violations */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Violations</h3>
        <div className="space-y-3">
          {violations.slice(0, 10).map((violation) => (
            <div key={violation.id} className="flex items-start justify-between p-4 border rounded-lg">
              <div className="flex items-start space-x-3">
                <div className={getSeverityColor(violation.severity) + ' p-2 rounded'}>
                  {getSeverityIcon(violation.severity)}
                </div>
                <div>
                  <h4 className="font-medium">{violation.rule.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Field: <code className="px-1 py-0.5 bg-gray-100 rounded">{violation.fieldPath}</code>
                  </p>
                  <p className="text-sm text-gray-600 mt-1">
                    Type: {violation.violationType}
                  </p>
                  {violation.actualValue && (
                    <p className="text-sm text-gray-600 mt-1">
                      Value: {violation.actualValue}
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(violation.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveViolation(violation.id)}
              >
                Resolve
              </Button>
            </div>
          ))}
          {violations.length === 0 && (
            <div className="text-center py-12">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-700">All Clear!</h3>
              <p className="text-gray-600 mt-2">No validation violations detected</p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
