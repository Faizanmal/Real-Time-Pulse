'use client';

import { useState, useEffect } from 'react';
import { workflowApi } from '@/lib/advanced-api';
import type { Workflow, WorkflowExecution } from '@/types/advanced-features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Play, Pause, Trash2, Plus, TrendingUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function WorkflowAutomation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkflows();
  }, []);

  const loadWorkflows = async () => {
    try {
      const response = await workflowApi.getWorkflows();
      const data = response.data;
      if (Array.isArray(data)) {
        setWorkflows(data);
      } else if (data && typeof data === 'object' && 'data' in data && Array.isArray((data as any).data)) {
        setWorkflows((data as any).data);
      } else {
        console.warn('Unexpected API response format for workflows:', data);
        setWorkflows([]);
      }
    } catch (error: any) {
      toast.error('Failed to load workflows');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    try {
      await workflowApi.toggleWorkflow(id, !isActive);
      toast.success(`Workflow ${!isActive ? 'activated' : 'deactivated'}`);
      loadWorkflows();
    } catch (error: any) {
      toast.error('Failed to toggle workflow');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this workflow?')) return;

    try {
      await workflowApi.deleteWorkflow(id);
      toast.success('Workflow deleted');
      loadWorkflows();
    } catch (error: any) {
      toast.error('Failed to delete workflow');
    }
  };

  const handleExecute = async (id: string) => {
    try {
      await workflowApi.executeWorkflow(id, { manual: true });
      toast.success('Workflow execution started');
    } catch (error: any) {
      toast.error('Failed to execute workflow');
    }
  };

  const getStatusColor = (workflow: Workflow) => {
    if (!workflow.isActive) return 'bg-gray-100 text-gray-800';
    if (workflow.failureCount > workflow.successCount) return 'bg-red-100 text-red-800';
    if (workflow.successCount > 0) return 'bg-green-100 text-green-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const getSuccessRate = (workflow: Workflow) => {
    if (workflow.executionCount === 0) return 0;
    return Math.round((workflow.successCount / workflow.executionCount) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Workflow Automation</h2>
          <p className="text-muted-foreground">
            Automate tasks with trigger-based workflows
          </p>
        </div>
        <Link href="/workflows/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Workflows
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflows.filter((w) => w.isActive).length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Executions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflows.reduce((sum, w) => sum + w.executionCount, 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Avg Success Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflows.length > 0
                ? Math.round(
                  workflows.reduce((sum, w) => sum + getSuccessRate(w), 0) / workflows.length
                )
                : 0}
              %
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workflows List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workflows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">No workflows yet</p>
            <Link href="/workflows/templates">
              <Button variant="outline">Browse Templates</Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {workflows.map((workflow) => (
            <Card key={workflow.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CardTitle>{workflow.name}</CardTitle>
                      <Badge className={getStatusColor(workflow)} variant="secondary">
                        {workflow.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <CardDescription>{workflow.description}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats */}
                <div className="grid grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Executions</p>
                    <p className="font-semibold">{workflow.executionCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Success Rate</p>
                    <p className="font-semibold flex items-center gap-1">
                      {getSuccessRate(workflow)}%
                      {getSuccessRate(workflow) >= 80 ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-yellow-600" />
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Actions</p>
                    <p className="font-semibold">{workflow.actions?.length || 0}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Run</p>
                    <p className="font-semibold">
                      {workflow.lastExecutedAt
                        ? new Date(workflow.lastExecutedAt).toLocaleDateString()
                        : 'Never'}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleToggle(workflow.id, workflow.isActive)}
                  >
                    {workflow.isActive ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Pause
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Activate
                      </>
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExecute(workflow.id)}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Run Now
                  </Button>
                  <Link href={`/workflows/${workflow.id}`}>
                    <Button variant="outline" size="sm">
                      View Details
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(workflow.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
