'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { workflowApi } from '@/lib/advanced-api';
import type { Workflow, WorkflowTrigger, WorkflowAction, WorkflowCondition } from '@/types/advanced-features';
import { Plus, Save, Play, Trash2, GitBranch, Zap, Filter, ArrowRight } from 'lucide-react';

interface WorkflowNode {
  id: string;
  type: 'trigger' | 'action' | 'condition';
  data: WorkflowTrigger | WorkflowAction | WorkflowCondition;
  position: { x: number; y: number };
}

export default function WorkflowBuilder({ workflow }: { workflow?: Workflow }) {
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<WorkflowNode | null>(null);
  const [workflowName, setWorkflowName] = useState(workflow?.name || '');
  const [workflowDescription, setWorkflowDescription] = useState(workflow?.description || '');
  const [isConfigDialogOpen, setIsConfigDialogOpen] = useState(false);
  const { toast } = useToast();

  const addNode = useCallback((type: 'trigger' | 'action' | 'condition') => {
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      data: {
        type: type === 'trigger' ? 'webhook' : type === 'action' ? 'http_request' : 'compare',
        config: {},
      },
      position: {
        x: 100 + nodes.length * 200,
        y: 200,
      },
    };
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode);
    setIsConfigDialogOpen(true);
  }, [nodes]);

  const updateNode = (nodeId: string, data: Partial<WorkflowNode>) => {
    setNodes(nodes.map(node => node.id === nodeId ? { ...node, ...data } : node));
  };

  const deleteNode = (nodeId: string) => {
    setNodes(nodes.filter(node => node.id !== nodeId));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  };

  const saveWorkflow = async () => {
    try {
      const trigger = nodes.find(n => n.type === 'trigger')?.data as WorkflowTrigger;
      const actions = nodes.filter(n => n.type === 'action').map(n => n.data as WorkflowAction);
      const conditions = nodes.filter(n => n.type === 'condition').map(n => n.data as WorkflowCondition);

      if (!trigger) {
        toast({
          title: 'Error',
          description: 'Workflow must have at least one trigger',
          variant: 'destructive',
        });
        return;
      }

      if (actions.length === 0) {
        toast({
          title: 'Error',
          description: 'Workflow must have at least one action',
          variant: 'destructive',
        });
        return;
      }

      const workflowData: Partial<Workflow> = {
        name: workflowName,
        description: workflowDescription,
        trigger,
        actions,
        conditions: conditions.length > 0 ? conditions : undefined,
        isActive: true,
      };

      if (workflow) {
        await workflowApi.updateWorkflow(workflow.id, workflowData);
        toast({
          title: 'Success',
          description: 'Workflow updated successfully',
        });
      } else {
        await workflowApi.createWorkflow(workflowData);
        toast({
          title: 'Success',
          description: 'Workflow created successfully',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save workflow',
        variant: 'destructive',
      });
    }
  };

  const testWorkflow = async () => {
    if (!workflow) {
      toast({
        title: 'Error',
        description: 'Please save the workflow first',
        variant: 'destructive',
      });
      return;
    }

    try {
      await workflowApi.executeWorkflow(workflow.id, {});
      toast({
        title: 'Success',
        description: 'Workflow executed successfully',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Workflow execution failed',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <Input
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow Name"
            className="text-2xl font-bold border-0 px-0 focus-visible:ring-0"
          />
          <Input
            value={workflowDescription}
            onChange={(e) => setWorkflowDescription(e.target.value)}
            placeholder="Describe what this workflow does..."
            className="text-muted-foreground border-0 px-0 focus-visible:ring-0"
          />
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testWorkflow} disabled={!workflow}>
            <Play className="mr-2 h-4 w-4" />
            Test
          </Button>
          <Button onClick={saveWorkflow}>
            <Save className="mr-2 h-4 w-4" />
            Save
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Builder</CardTitle>
          <CardDescription>Build your automation workflow by adding triggers, conditions, and actions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => addNode('trigger')}>
                <Zap className="mr-2 h-4 w-4" />
                Add Trigger
              </Button>
              <Button variant="outline" size="sm" onClick={() => addNode('condition')}>
                <Filter className="mr-2 h-4 w-4" />
                Add Condition
              </Button>
              <Button variant="outline" size="sm" onClick={() => addNode('action')}>
                <GitBranch className="mr-2 h-4 w-4" />
                Add Action
              </Button>
            </div>

            <div className="border rounded-lg p-8 bg-slate-50 dark:bg-slate-900 min-h-[400px]">
              {nodes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <GitBranch className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground mb-4">Start building your workflow</p>
                    <Button onClick={() => addNode('trigger')}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Trigger
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {nodes.map((node, index) => (
                    <div key={node.id}>
                      {index > 0 && (
                        <div className="flex justify-center py-2">
                          <ArrowRight className="h-6 w-6 text-muted-foreground rotate-90" />
                        </div>
                      )}
                      <Card
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => {
                          setSelectedNode(node);
                          setIsConfigDialogOpen(true);
                        }}
                      >
                        <CardContent className="pt-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {node.type === 'trigger' && <Zap className="h-5 w-5 text-yellow-500" />}
                              {node.type === 'condition' && <Filter className="h-5 w-5 text-blue-500" />}
                              {node.type === 'action' && <GitBranch className="h-5 w-5 text-green-500" />}
                              <div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="capitalize">
                                    {node.type}
                                  </Badge>
                                  <span className="font-medium capitalize">
                                    {node.data.type?.replace('_', ' ')}
                                  </span>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {getNodeDescription(node)}
                                </p>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteNode(node.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isConfigDialogOpen} onOpenChange={setIsConfigDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configure {selectedNode?.type}</DialogTitle>
            <DialogDescription>
              Set up the configuration for this {selectedNode?.type}
            </DialogDescription>
          </DialogHeader>
          {selectedNode && <NodeConfig node={selectedNode} onUpdate={updateNode} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NodeConfig({ node, onUpdate }: { node: WorkflowNode; onUpdate: (id: string, data: Partial<WorkflowNode>) => void }) {
  const [config, setConfig] = useState(node.data.config || {});
  const [type, setType] = useState(node.data.type || '');

  const handleSave = () => {
    onUpdate(node.id, {
      data: {
        ...node.data,
        type,
        config,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>Type</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {node.type === 'trigger' && (
              <>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="schedule">Schedule</SelectItem>
                <SelectItem value="data_change">Data Change</SelectItem>
              </>
            )}
            {node.type === 'action' && (
              <>
                <SelectItem value="http_request">HTTP Request</SelectItem>
                <SelectItem value="email">Send Email</SelectItem>
                <SelectItem value="slack">Slack Message</SelectItem>
                <SelectItem value="database">Database Operation</SelectItem>
              </>
            )}
            {node.type === 'condition' && (
              <>
                <SelectItem value="compare">Compare Values</SelectItem>
                <SelectItem value="contains">Contains Text</SelectItem>
                <SelectItem value="regex">Regex Match</SelectItem>
              </>
            )}
          </SelectContent>
        </Select>
      </div>

      {type === 'webhook' && (
        <div>
          <Label>Webhook URL</Label>
          <Input
            value={config.url || ''}
            onChange={(e) => setConfig({ ...config, url: e.target.value })}
            placeholder="https://api.example.com/webhook"
          />
        </div>
      )}

      {type === 'schedule' && (
        <div>
          <Label>Cron Expression</Label>
          <Input
            value={config.cron || ''}
            onChange={(e) => setConfig({ ...config, cron: e.target.value })}
            placeholder="0 9 * * *"
          />
        </div>
      )}

      {type === 'http_request' && (
        <>
          <div>
            <Label>URL</Label>
            <Input
              value={config.url || ''}
              onChange={(e) => setConfig({ ...config, url: e.target.value })}
              placeholder="https://api.example.com/endpoint"
            />
          </div>
          <div>
            <Label>Method</Label>
            <Select
              value={config.method || 'GET'}
              onValueChange={(v) => setConfig({ ...config, method: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="GET">GET</SelectItem>
                <SelectItem value="POST">POST</SelectItem>
                <SelectItem value="PUT">PUT</SelectItem>
                <SelectItem value="DELETE">DELETE</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}

      {type === 'email' && (
        <>
          <div>
            <Label>To</Label>
            <Input
              value={config.to || ''}
              onChange={(e) => setConfig({ ...config, to: e.target.value })}
              placeholder="user@example.com"
            />
          </div>
          <div>
            <Label>Subject</Label>
            <Input
              value={config.subject || ''}
              onChange={(e) => setConfig({ ...config, subject: e.target.value })}
              placeholder="Alert: Workflow triggered"
            />
          </div>
        </>
      )}

      <Button onClick={handleSave} className="w-full">
        Save Configuration
      </Button>
    </div>
  );
}

function getNodeDescription(node: WorkflowNode): string {
  const config = node.data.config || {};

  if (node.type === 'trigger') {
    if (node.data.type === 'webhook') return `Webhook: ${config.url || 'Not configured'}`;
    if (node.data.type === 'schedule') return `Schedule: ${config.cron || 'Not configured'}`;
    if (node.data.type === 'data_change') return `When data changes in ${config.table || 'table'}`;
  }

  if (node.type === 'action') {
    if (node.data.type === 'http_request') return `Request to ${config.url || 'endpoint'}`;
    if (node.data.type === 'email') return `Email to ${config.to || 'recipient'}`;
    if (node.data.type === 'slack') return `Slack message to ${config.channel || 'channel'}`;
  }

  if (node.type === 'condition') {
    if (node.data.type === 'compare') return `If ${config.field || 'field'} ${config.operator || '='} ${config.value || 'value'}`;
  }

  return 'Click to configure';
}
