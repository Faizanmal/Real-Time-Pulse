'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, Info, XCircle, Plus, TrendingUp, Shield } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  ruleType: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  enabled: boolean;
  integration: {
    provider: string;
  };
  violations: Violation[];
}

interface Violation {
  id: string;
  timestamp: string;
  fieldPath: string;
  actualValue: string;
  expectedValue: string;
  violationType: string;
  severity: string;
  resolved: boolean;
}

interface ValidationStats {
  total: number;
  resolved: number;
  unresolved: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  period: string;
}

export default function DataValidationDashboard() {
  const [rules, setRules] = useState<ValidationRule[]>([]);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [stats, setStats] = useState<ValidationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRuleDialog, setShowRuleDialog] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    description: '',
    fieldPath: '',
    ruleType: 'NO_NEGATIVE_VALUES',
    severity: 'WARNING',
    config: {}
  });

  useEffect(() => {
    fetchValidationData();
  }, []);

  const fetchValidationData = async () => {
    try {
      const workspaceId = 'your-workspace-id';
      
      const [rulesRes, violationsRes, statsRes] = await Promise.all([
        fetch(`/api/data-validation/rules/workspace/${workspaceId}`),
        fetch(`/api/data-validation/violations/workspace/${workspaceId}?resolved=false`),
        fetch(`/api/data-validation/violations/workspace/${workspaceId}/stats?days=7`)
      ]);

      const rulesData = await rulesRes.json();
      const violationsData = await violationsRes.json();
      const statsData = await statsRes.json();

      setRules(rulesData);
      setViolations(violationsData);
      setStats(statsData);
    } catch (error) {
      console.error('Failed to fetch validation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRule = async () => {
    try {
      await fetch('/api/data-validation/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceId: 'your-workspace-id',
          ...newRule
        })
      });
      
      setShowRuleDialog(false);
      fetchValidationData();
      
      // Reset form
      setNewRule({
        name: '',
        description: '',
        fieldPath: '',
        ruleType: 'NO_NEGATIVE_VALUES',
        severity: 'WARNING',
        config: {}
      });
    } catch (error) {
      console.error('Failed to create rule:', error);
    }
  };

  const toggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      await fetch(`/api/data-validation/rules/${ruleId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled })
      });
      fetchValidationData();
    } catch (error) {
      console.error('Failed to toggle rule:', error);
    }
  };

  const resolveViolation = async (violationId: string, notes?: string) => {
    try {
      await fetch(`/api/data-validation/violations/${violationId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resolvedBy: 'current-user-id',
          notes
        })
      });
      fetchValidationData();
    } catch (error) {
      console.error('Failed to resolve violation:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'ERROR': return 'text-orange-600 bg-orange-100';
      case 'WARNING': return 'text-yellow-600 bg-yellow-100';
      case 'INFO': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return <XCircle className="h-5 w-5 text-red-600" />;
      case 'ERROR': return <AlertCircle className="h-5 w-5 text-orange-600" />;
      case 'WARNING': return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'INFO': return <Info className="h-5 w-5 text-blue-600" />;
      default: return <Info className="h-5 w-5 text-gray-600" />;
    }
  };

  const SEVERITY_COLORS = {
    CRITICAL: '#dc2626',
    ERROR: '#ea580c',
    WARNING: '#ca8a04',
    INFO: '#2563eb'
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Data Validation</h1>
          <p className="text-muted-foreground mt-1">
            Automated data quality checks and violation tracking
          </p>
        </div>
        <Dialog open={showRuleDialog} onOpenChange={setShowRuleDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Rule
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[525px]">
            <DialogHeader>
              <DialogTitle>Create Validation Rule</DialogTitle>
              <DialogDescription>
                Define a new data validation rule to automatically check data quality
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Rule Name</Label>
                <Input
                  id="name"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  placeholder="e.g., Revenue cannot be negative"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newRule.description}
                  onChange={(e) => setNewRule({ ...newRule, description: e.target.value })}
                  placeholder="Describe what this rule validates..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fieldPath">Field Path</Label>
                <Input
                  id="fieldPath"
                  value={newRule.fieldPath}
                  onChange={(e) => setNewRule({ ...newRule, fieldPath: e.target.value })}
                  placeholder="e.g., revenue.total"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ruleType">Rule Type</Label>
                <Select value={newRule.ruleType} onValueChange={(value) => setNewRule({ ...newRule, ruleType: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NO_NEGATIVE_VALUES">No Negative Values</SelectItem>
                    <SelectItem value="RANGE_CHECK">Range Check</SelectItem>
                    <SelectItem value="SPIKE_DETECTION">Spike Detection</SelectItem>
                    <SelectItem value="MISSING_FIELD">Missing Field</SelectItem>
                    <SelectItem value="REQUIRED_FIELD">Required Field</SelectItem>
                    <SelectItem value="CROSS_SOURCE_CONSISTENCY">Cross-Source Consistency</SelectItem>
                    <SelectItem value="CUSTOM_REGEX">Custom Regex</SelectItem>
                    <SelectItem value="DATA_TYPE_CHECK">Data Type Check</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={newRule.severity} onValueChange={(value) => setNewRule({ ...newRule, severity: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INFO">Info</SelectItem>
                    <SelectItem value="WARNING">Warning</SelectItem>
                    <SelectItem value="ERROR">Error</SelectItem>
                    <SelectItem value="CRITICAL">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowRuleDialog(false)}>
                Cancel
              </Button>
              <Button onClick={createRule}>Create Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Rules</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{rules.filter(r => r.enabled).length}</div>
            <p className="text-xs text-muted-foreground">
              {rules.length} total rules
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Open Violations</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.unresolved || 0}</div>
            <p className="text-xs text-muted-foreground">
              {stats?.total || 0} total this week
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Resolution Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.total ? ((stats.resolved / stats.total) * 100).toFixed(0) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.resolved || 0} resolved
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Issues</CardTitle>
            <XCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats?.bySeverity?.CRITICAL || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              Requires immediate action
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Violations by Severity</CardTitle>
            <CardDescription>Distribution of validation issues</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={Object.entries(stats?.bySeverity || {}).map(([severity, count]) => ({
                severity,
                count
              }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="severity" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Violations by Type</CardTitle>
            <CardDescription>Most common data quality issues</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={Object.entries(stats?.byType || {}).map(([type, count]) => ({
                    name: type,
                    value: count
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : '0'}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {Object.keys(stats?.byType || {}).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={`hsl(${index * 45}, 70%, 50%)`} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Validation Rules */}
      <Card>
        <CardHeader>
          <CardTitle>Validation Rules</CardTitle>
          <CardDescription>Active and inactive data quality rules</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent">
                    {getSeverityIcon(rule.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{rule.name}</h3>
                      <Badge className={getSeverityColor(rule.severity)}>
                        {rule.severity}
                      </Badge>
                      <Badge variant="outline">{rule.ruleType}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{rule.description}</p>
                    {rule.violations.length > 0 && (
                      <p className="text-xs text-red-500 mt-1">
                        {rule.violations.length} open violation(s)
                      </p>
                    )}
                  </div>
                </div>

                <Switch
                  checked={rule.enabled}
                  onCheckedChange={(checked) => toggleRule(rule.id, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Violations */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Violations</CardTitle>
          <CardDescription>Latest data quality issues detected</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {violations.slice(0, 10).map((violation) => (
              <div
                key={violation.id}
                className="flex items-start justify-between p-4 border rounded-lg"
              >
                <div className="flex items-start space-x-4 flex-1">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent mt-1">
                    {getSeverityIcon(violation.severity)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{violation.violationType}</h3>
                      <Badge className={getSeverityColor(violation.severity)}>
                        {violation.severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Field: <span className="font-mono">{violation.fieldPath}</span>
                    </p>
                    <div className="text-xs mt-2 space-y-1">
                      <p>Actual: <span className="font-mono text-red-600">{violation.actualValue}</span></p>
                      <p>Expected: <span className="font-mono text-green-600">{violation.expectedValue}</span></p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(violation.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>

                {!violation.resolved && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => resolveViolation(violation.id)}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Resolve
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
