'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Workflow, Plus, Play, Pause, Settings, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface WorkflowStep {
  id: string;
  type: string;
  name: string;
  config: Record<string, unknown>;
  order: number;
}

interface WorkflowExecution {
  id: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  completedAt: string | null;
  error: string | null;
}

interface WorkflowData {
  id: string;
  name: string;
  description: string;
  trigger: string;
  status: 'active' | 'paused' | 'draft';
  steps: WorkflowStep[];
  executions: WorkflowExecution[];
  lastRun: string | null;
  successRate: number;
  createdAt: string;
}

export default function WorkflowAutomation() {
  const [workflows, setWorkflows] = useState<WorkflowData[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [_selectedWorkflow, setSelectedWorkflow] = useState<WorkflowData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    trigger: 'manual'
  });

  const fetchWorkflows = useCallback(async () => {
    try {
      const response = await fetch('/api/workflow-automation');
      const data = await response.json();
      setWorkflows(data);
    } catch (error) {
      console.error('Failed to fetch workflows:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/workflow-automation');
        const data = await response.json();
        if (mounted) setWorkflows(data);
      } catch (error) {
        console.error('Failed to fetch workflows:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const resetForm = useCallback(() => {
    setFormData({
      name: '',
      description: '',
      trigger: 'manual'
    });
  }, []);

  const createWorkflow = useCallback(async () => {
    try {
      await fetch('/api/workflow-automation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      fetchWorkflows();
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      console.error('Failed to create workflow:', error);
    }
  }, [formData, fetchWorkflows, resetForm]);

  const runWorkflow = useCallback(async (id: string) => {
    try {
      await fetch(`/api/workflow-automation/${id}/run`, { method: 'POST' });
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to run workflow:', error);
    }
  }, [fetchWorkflows]);

  const toggleWorkflow = useCallback(async (id: string, status: 'active' | 'paused') => {
    try {
      await fetch(`/api/workflow-automation/${id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to toggle workflow:', error);
    }
  }, [fetchWorkflows]);

  const deleteWorkflow = useCallback(async (id: string) => {
    try {
      await fetch(`/api/workflow-automation/${id}`, { method: 'DELETE' });
      fetchWorkflows();
    } catch (error) {
      console.error('Failed to delete workflow:', error);
    }
  }, [fetchWorkflows]);


  const triggerTypes = [
    'manual',
    'schedule',
    'webhook',
    'data_change',
    'alert',
    'api_call'
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Workflow className="h-8 w-8" />
            Workflow Automation
          </h1>
          <p className="text-muted-foreground">Automate tasks and processes</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Create Workflow
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Workflow</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Workflow Name</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Data Processing Workflow"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Describe what this workflow does..."
                  rows={3}
                />
              </div>
              <div>
                <Label>Trigger Type</Label>
                <Select value={formData.trigger} onValueChange={(value) => setFormData({ ...formData, trigger: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerTypes.map(trigger => (
                      <SelectItem key={trigger} value={trigger}>{trigger.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={createWorkflow}>Create</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workflows.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {workflows.filter(w => w.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {workflows.length > 0
                ? ((workflows.reduce((acc, w) => acc + w.successRate, 0) / workflows.length) * 100).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Executions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workflows.reduce((acc, w) => acc + w.executions.length, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {workflows.map((workflow) => (
          <Card key={workflow.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Workflow className="h-4 w-4" />
                    {workflow.name}
                  </CardTitle>
                  <CardDescription className="mt-1">{workflow.description}</CardDescription>
                </div>
                <Badge variant={
                  workflow.status === 'active' ? 'default' :
                  workflow.status === 'paused' ? 'secondary' :
                  'outline'
                }>
                  {workflow.status}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Badge variant="outline">{workflow.trigger.replace('_', ' ')}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {workflow.steps.length} steps
                  </span>
                  <span className="text-sm text-muted-foreground">
                    Success rate: {(workflow.successRate * 100).toFixed(0)}%
                  </span>
                </div>

                {workflow.steps.length > 0 && (
                  <div className="flex gap-2 items-center">
                    {workflow.steps.slice(0, 5).map((step, index) => (
                      <React.Fragment key={step.id}>
                        <div className="px-3 py-1 bg-secondary rounded text-sm">
                          {step.name}
                        </div>
                        {index < Math.min(workflow.steps.length - 1, 4) && (
                          <div className="text-muted-foreground">→</div>
                        )}
                      </React.Fragment>
                    ))}
                    {workflow.steps.length > 5 && (
                      <div className="text-sm text-muted-foreground">
                        +{workflow.steps.length - 5} more
                      </div>
                    )}
                  </div>
                )}

                {workflow.executions.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold">Recent Executions</div>
                    <div className="flex gap-2">
                      {workflow.executions.slice(0, 10).map((execution) => (
                        <div
                          key={execution.id}
                          className={`w-3 h-3 rounded-full ${
                            execution.status === 'success' ? 'bg-green-500' :
                            execution.status === 'failed' ? 'bg-red-500' :
                            'bg-blue-500 animate-pulse'
                          }`}
                          title={`${execution.status} - ${new Date(execution.startedAt).toLocaleString()}`}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {workflow.lastRun && (
                  <div className="text-xs text-muted-foreground">
                    Last run: {new Date(workflow.lastRun).toLocaleString()}
                  </div>
                )}

                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="outline" onClick={() => runWorkflow(workflow.id)}>
                    <Play className="h-3 w-3 mr-1" />
                    Run Now
                  </Button>
                  {workflow.status === 'active' ? (
                    <Button size="sm" variant="outline" onClick={() => toggleWorkflow(workflow.id, 'paused')}>
                      <Pause className="h-3 w-3 mr-1" />
                      Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => toggleWorkflow(workflow.id, 'active')}>
                      <Play className="h-3 w-3 mr-1" />
                      Activate
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => setSelectedWorkflow(workflow)}>
                    <Settings className="h-3 w-3 mr-1" />
                    Configure
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => deleteWorkflow(workflow.id)}>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {workflows.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Workflow className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No workflows created yet</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
