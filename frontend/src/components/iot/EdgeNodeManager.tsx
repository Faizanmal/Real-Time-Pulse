'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Server,
  Cpu,
  HardDrive,
  Activity,
  Settings,
  RefreshCw,
  Plus,
  Play,
  Pause,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EdgeNode {
  id: string;
  name: string;
  location: string;
  status: 'active' | 'inactive' | 'maintenance';
  processingRules: ProcessingRule[];
  devicesConnected: number;
  messagesProcessed: number;
  cpuUsage: number;
  memoryUsage: number;
  storageUsage: number;
  lastHeartbeat: string;
}

interface ProcessingRule {
  id: string;
  name: string;
  condition: string;
  action: 'forward' | 'aggregate' | 'alert' | 'transform' | 'discard';
  actionConfig?: {
    destination?: string;
    aggregationWindow?: number;
    alertThreshold?: number;
    transformation?: string;
  };
}

interface EdgeNodeManagerProps {
  workspaceId: string;
  className?: string;
}

const statusConfig = {
  active: {
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    label: 'Active',
  },
  inactive: {
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    border: 'border-slate-500/20',
    label: 'Inactive',
  },
  maintenance: {
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    label: 'Maintenance',
  },
};

export function EdgeNodeManager({ workspaceId: _workspaceId, className }: EdgeNodeManagerProps) {
  const [nodes, setNodes] = useState<EdgeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedNode, setSelectedNode] = useState<EdgeNode | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState<Omit<ProcessingRule, 'id'>>({
    name: '',
    condition: '',
    action: 'forward',
  });

  // Fetch edge nodes
  const fetchNodes = useCallback(async () => {
    try {
      const response = await fetch('/api/iot/edge/status');
      const data = await response.json();
      setNodes(data);
    } catch (error) {
      console.error('Failed to fetch edge nodes:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNodes();
    const interval = setInterval(fetchNodes, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, [fetchNodes]);

  // Set maintenance mode
  const setMaintenanceMode = async (nodeId: string, enabled: boolean) => {
    try {
      await fetch(`/api/iot/edge/nodes/${nodeId}/maintenance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      fetchNodes();
    } catch (error) {
      console.error('Failed to set maintenance mode:', error);
    }
  };

  // Deploy rules
  const deployRules = async (nodeId: string, rules: ProcessingRule[]) => {
    try {
      await fetch(`/api/iot/edge/nodes/${nodeId}/rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rules }),
      });
      fetchNodes();
    } catch (error) {
      console.error('Failed to deploy rules:', error);
    }
  };

  // Add a rule to selected node
  const addRule = () => {
    if (!selectedNode || !newRule.name || !newRule.condition) return;

    const rule: ProcessingRule = {
      id: `rule-${Date.now()}`,
      name: newRule.name,
      condition: newRule.condition,
      action: newRule.action,
    };

    const updatedRules = [...selectedNode.processingRules, rule];
    deployRules(selectedNode.id, updatedRules);
    
    setNewRule({ name: '', condition: '', action: 'forward' });
    setShowAddRule(false);
  };

  // Remove a rule
  const removeRule = (ruleId: string) => {
    if (!selectedNode) return;
    const updatedRules = selectedNode.processingRules.filter(r => r.id !== ruleId);
    deployRules(selectedNode.id, updatedRules);
  };

  // Get usage bar color
  const getUsageColor = (usage: number) => {
    if (usage < 50) return 'bg-green-500';
    if (usage < 80) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  if (isLoading) {
    return (
      <div className={cn('p-6 bg-slate-900 rounded-xl', className)}>
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-slate-900 rounded-xl', className)}>
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-white">Edge Computing Nodes</h2>
            <p className="text-sm text-slate-400 mt-1">
              Manage distributed edge processing infrastructure
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchNodes}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
              <Plus className="w-4 h-4" />
              Add Node
            </button>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-4 gap-4">
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-white">{nodes.length}</div>
            <div className="text-sm text-slate-400">Total Nodes</div>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-green-400">
              {nodes.filter(n => n.status === 'active').length}
            </div>
            <div className="text-sm text-slate-400">Active</div>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {nodes.reduce((sum, n) => sum + n.devicesConnected, 0)}
            </div>
            <div className="text-sm text-slate-400">Devices Connected</div>
          </div>
          <div className="p-4 bg-slate-800 rounded-lg">
            <div className="text-2xl font-bold text-white">
              {nodes.reduce((sum, n) => sum + n.messagesProcessed, 0).toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">Messages Processed</div>
          </div>
        </div>
      </div>

      {/* Nodes Grid */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        {nodes.length === 0 ? (
          <div className="col-span-2 p-8 text-center">
            <Server className="w-12 h-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No edge nodes configured</p>
          </div>
        ) : (
          nodes.map(node => {
            const status = statusConfig[node.status];

            return (
              <div
                key={node.id}
                className={cn(
                  'p-4 bg-slate-800 rounded-xl border cursor-pointer transition-all hover:border-blue-500/50',
                  selectedNode?.id === node.id ? 'border-blue-500' : 'border-slate-700'
                )}
                onClick={() => setSelectedNode(node)}
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', status.bg)}>
                      <Server className={cn('w-5 h-5', status.color)} />
                    </div>
                    <div>
                      <h3 className="font-medium text-white">{node.name}</h3>
                      <p className="text-sm text-slate-400">{node.location}</p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      'px-2 py-1 text-xs rounded-full',
                      status.bg,
                      status.color
                    )}
                  >
                    {status.label}
                  </span>
                </div>

                {/* Resource Usage */}
                <div className="space-y-3 mb-4">
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Cpu className="w-3 h-3" /> CPU
                      </span>
                      <span className="text-white">{node.cpuUsage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', getUsageColor(node.cpuUsage))}
                        style={{ width: `${node.cpuUsage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Memory
                      </span>
                      <span className="text-white">{node.memoryUsage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', getUsageColor(node.memoryUsage))}
                        style={{ width: `${node.memoryUsage}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-sm mb-1">
                      <span className="text-slate-400 flex items-center gap-1">
                        <HardDrive className="w-3 h-3" /> Storage
                      </span>
                      <span className="text-white">{node.storageUsage.toFixed(1)}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', getUsageColor(node.storageUsage))}
                        style={{ width: `${node.storageUsage}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <span className="text-white font-medium">{node.devicesConnected}</span>
                    <span className="text-slate-400 ml-1">devices</span>
                  </div>
                  <div>
                    <span className="text-white font-medium">{node.processingRules.length}</span>
                    <span className="text-slate-400 ml-1">rules</span>
                  </div>
                  <div className="text-slate-500 text-xs">
                    {new Date(node.lastHeartbeat).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Node Details Panel */}
      {selectedNode && (
        <div className="fixed inset-y-0 right-0 w-[450px] bg-slate-900 border-l border-slate-700 shadow-2xl z-50 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-white">{selectedNode.name}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
              >
                ✕
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-2 mb-6">
              {selectedNode.status === 'maintenance' ? (
                <button
                  onClick={() => setMaintenanceMode(selectedNode.id, false)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4" />
                  Activate
                </button>
              ) : (
                <button
                  onClick={() => setMaintenanceMode(selectedNode.id, true)}
                  className="flex-1 flex items-center justify-center gap-2 p-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors"
                >
                  <Pause className="w-4 h-4" />
                  Maintenance
                </button>
              )}
              <button className="flex-1 flex items-center justify-center gap-2 p-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
                <Settings className="w-4 h-4" />
                Configure
              </button>
            </div>

            {/* Processing Rules */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium text-white">Processing Rules</h4>
                <button
                  onClick={() => setShowAddRule(true)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  + Add Rule
                </button>
              </div>

              {showAddRule && (
                <div className="p-4 bg-slate-800 rounded-lg mb-3 space-y-3">
                  <input
                    type="text"
                    placeholder="Rule name"
                    value={newRule.name}
                    onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    placeholder="Condition (e.g., temperature > 30)"
                    value={newRule.condition}
                    onChange={e => setNewRule({ ...newRule, condition: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white placeholder:text-slate-500 font-mono text-sm"
                  />
                  <select
                    value={newRule.action}
                    onChange={(e) => setNewRule({ ...newRule, action: e.target.value as 'forward' | 'aggregate' | 'alert' | 'transform' | 'discard' })}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white"
                  >
                    <option value="forward">Forward to Cloud</option>
                    <option value="aggregate">Aggregate Locally</option>
                    <option value="alert">Trigger Alert</option>
                    <option value="transform">Transform Data</option>
                    <option value="discard">Discard</option>
                  </select>
                  <div className="flex gap-2">
                    <button
                      onClick={addRule}
                      className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => setShowAddRule(false)}
                      className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                {selectedNode.processingRules.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-4">No rules configured</p>
                ) : (
                  selectedNode.processingRules.map(rule => (
                    <div
                      key={rule.id}
                      className="p-3 bg-slate-800 rounded-lg flex items-start justify-between"
                    >
                      <div>
                        <div className="font-medium text-white text-sm">{rule.name}</div>
                        <div className="text-xs text-slate-400 font-mono mt-1">{rule.condition}</div>
                        <span className="inline-block mt-2 px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded">
                          {rule.action}
                        </span>
                      </div>
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Node Info */}
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-500 uppercase">Node ID</label>
                <p className="text-white font-mono text-sm">{selectedNode.id}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Location</label>
                <p className="text-white">{selectedNode.location}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Last Heartbeat</label>
                <p className="text-white">{new Date(selectedNode.lastHeartbeat).toLocaleString()}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase">Messages Processed</label>
                <p className="text-white">{selectedNode.messagesProcessed.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EdgeNodeManager;
