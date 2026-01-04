'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Database,
  Filter,
  GitMerge,
  Table2,
  Upload,
  Download,
  Play,
  Save,
  Plus,
  Trash2,
  Settings,
  ChevronRight,
  GripVertical,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ETLNode {
  id: string;
  type: 'source' | 'transform' | 'filter' | 'aggregate' | 'join' | 'destination';
  name: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface ETLEdge {
  id: string;
  source: string;
  target: string;
}

interface ETLPipeline {
  id?: string;
  name: string;
  description?: string;
  nodes: ETLNode[];
  edges: ETLEdge[];
  status: 'draft' | 'active' | 'paused' | 'error';
  schedule?: {
    cron: string;
    timezone: string;
    enabled: boolean;
  };
}

interface ETLPipelineBuilderProps {
  pipeline?: ETLPipeline;
  onSave?: (pipeline: ETLPipeline) => void;
  className?: string;
}

const nodeTypes = {
  source: {
    icon: Database,
    color: 'bg-green-500',
    borderColor: 'border-green-500',
    label: 'Source',
  },
  transform: {
    icon: Settings,
    color: 'bg-blue-500',
    borderColor: 'border-blue-500',
    label: 'Transform',
  },
  filter: {
    icon: Filter,
    color: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    label: 'Filter',
  },
  aggregate: {
    icon: Table2,
    color: 'bg-purple-500',
    borderColor: 'border-purple-500',
    label: 'Aggregate',
  },
  join: {
    icon: GitMerge,
    color: 'bg-orange-500',
    borderColor: 'border-orange-500',
    label: 'Join',
  },
  destination: {
    icon: Upload,
    color: 'bg-red-500',
    borderColor: 'border-red-500',
    label: 'Destination',
  },
};

const defaultPipeline: ETLPipeline = {
  name: 'New Pipeline',
  nodes: [],
  edges: [],
  status: 'draft',
};

export function ETLPipelineBuilder({
  pipeline: initialPipeline,
  onSave,
  className,
}: ETLPipelineBuilderProps) {
  const [pipeline, setPipeline] = useState<ETLPipeline>(initialPipeline || defaultPipeline);
  const [selectedNode, setSelectedNode] = useState<ETLNode | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [executionStatus, setExecutionStatus] = useState<Record<string, 'pending' | 'running' | 'completed' | 'error'>>({});
  const canvasRef = useRef<HTMLDivElement>(null);

  // Add a new node
  const addNode = useCallback((type: ETLNode['type']) => {
    const id = `node-${Date.now()}`;
    const newNode: ETLNode = {
      id,
      type,
      name: `${nodeTypes[type].label} ${pipeline.nodes.filter(n => n.type === type).length + 1}`,
      config: {},
      position: {
        x: 200 + Math.random() * 200,
        y: 100 + Math.random() * 200,
      },
    };
    setPipeline(p => ({
      ...p,
      nodes: [...p.nodes, newNode],
    }));
  }, [pipeline.nodes]);

  // Remove a node
  const removeNode = useCallback((nodeId: string) => {
    setPipeline(p => ({
      ...p,
      nodes: p.nodes.filter(n => n.id !== nodeId),
      edges: p.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
    }));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(null);
    }
  }, [selectedNode]);

  // Update node
  const updateNode = useCallback((nodeId: string, updates: Partial<ETLNode>) => {
    setPipeline(p => ({
      ...p,
      nodes: p.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n),
    }));
    if (selectedNode?.id === nodeId) {
      setSelectedNode(prev => prev ? { ...prev, ...updates } : null);
    }
  }, [selectedNode]);

  // Connect nodes
  const connectNodes = useCallback((sourceId: string, targetId: string) => {
    // Prevent self-connections and duplicates
    if (sourceId === targetId) return;
    const exists = pipeline.edges.some(e => e.source === sourceId && e.target === targetId);
    if (exists) return;

    const newEdge: ETLEdge = {
      id: `edge-${Date.now()}`,
      source: sourceId,
      target: targetId,
    };
    setPipeline(p => ({
      ...p,
      edges: [...p.edges, newEdge],
    }));
  }, [pipeline.edges]);

  // Remove edge
  const removeEdge = useCallback((edgeId: string) => {
    setPipeline(p => ({
      ...p,
      edges: p.edges.filter(e => e.id !== edgeId),
    }));
  }, []);

  // Handle node drag
  const handleNodeDrag = useCallback((nodeId: string, e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const startX = e.clientX;
    const startY = e.clientY;
    const node = pipeline.nodes.find(n => n.id === nodeId);
    if (!node) return;

    const startPos = { ...node.position };

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      updateNode(nodeId, {
        position: {
          x: Math.max(0, startPos.x + dx),
          y: Math.max(0, startPos.y + dy),
        },
      });
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      setDraggedNode(null);
    };

    setDraggedNode(nodeId);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [pipeline.nodes, updateNode]);

  // Run pipeline
  const runPipeline = useCallback(async () => {
    if (!pipeline.id) {
      alert('Please save the pipeline first');
      return;
    }

    setIsRunning(true);
    const status: Record<string, 'pending' | 'running' | 'completed' | 'error'> = {};
    pipeline.nodes.forEach(n => {
      status[n.id] = 'pending';
    });
    setExecutionStatus(status);

    try {
      const response = await fetch(`/api/etl/pipelines/${pipeline.id}/execute`, {
        method: 'POST',
      });
      const execution = await response.json();

      // Poll for status updates
      const pollStatus = async () => {
        const statusResponse = await fetch(`/api/etl/executions/${execution.id}`);
        const execStatus = await statusResponse.json();

        if (execStatus.nodeStats) {
          const newStatus = { ...status };
          Object.keys(execStatus.nodeStats).forEach(nodeId => {
            newStatus[nodeId] = execStatus.nodeStats[nodeId].errors > 0 ? 'error' : 'completed';
          });
          setExecutionStatus(newStatus);
        }

        if (execStatus.status === 'completed' || execStatus.status === 'failed') {
          setIsRunning(false);
        } else {
          setTimeout(pollStatus, 1000);
        }
      };

      pollStatus();
    } catch (error) {
      console.error('Failed to run pipeline:', error);
      setIsRunning(false);
    }
  }, [pipeline]);

  // Save pipeline
  const savePipeline = useCallback(async () => {
    try {
      const method = pipeline.id ? 'PUT' : 'POST';
      const url = pipeline.id 
        ? `/api/etl/pipelines/${pipeline.id}` 
        : '/api/etl/pipelines';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pipeline),
      });

      const saved = await response.json();
      setPipeline(saved);
      onSave?.(saved);
    } catch (error) {
      console.error('Failed to save pipeline:', error);
    }
  }, [pipeline, onSave]);

  // Draw edges as SVG paths
  const renderEdges = () => {
    return pipeline.edges.map(edge => {
      const source = pipeline.nodes.find(n => n.id === edge.source);
      const target = pipeline.nodes.find(n => n.id === edge.target);
      if (!source || !target) return null;

      const x1 = source.position.x + 140;
      const y1 = source.position.y + 40;
      const x2 = target.position.x;
      const y2 = target.position.y + 40;
      const midX = (x1 + x2) / 2;

      return (
        <g key={edge.id}>
          <path
            d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            className="cursor-pointer hover:stroke-red-500"
            onClick={() => removeEdge(edge.id)}
          />
          {/* Arrow marker */}
          <polygon
            points={`${x2},${y2} ${x2 - 8},${y2 - 5} ${x2 - 8},${y2 + 5}`}
            fill="#3b82f6"
          />
        </g>
      );
    });
  };

  return (
    <div className={cn('flex h-[calc(100vh-200px)] bg-slate-900 rounded-xl overflow-hidden', className)}>
      {/* Sidebar - Node Types */}
      <div className="w-64 bg-slate-800 border-r border-slate-700 p-4">
        <h3 className="text-sm font-semibold text-white mb-4">Add Nodes</h3>
        <div className="space-y-2">
          {Object.entries(nodeTypes).map(([type, config]) => {
            const Icon = config.icon;
            return (
              <button
                key={type}
                onClick={() => addNode(type as ETLNode['type'])}
                className="w-full flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
              >
                <div className={cn('p-2 rounded', config.color)}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-sm">{config.label}</span>
              </button>
            );
          })}
        </div>

        {/* Pipeline Info */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <h3 className="text-sm font-semibold text-white mb-3">Pipeline</h3>
          <input
            type="text"
            value={pipeline.name}
            onChange={e => setPipeline(p => ({ ...p, name: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm mb-3"
          />
          <div className="flex gap-2">
            <button
              onClick={savePipeline}
              className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors"
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={runPipeline}
              disabled={isRunning || pipeline.nodes.length === 0}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded text-sm transition-colors',
                isRunning || pipeline.nodes.length === 0
                  ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              )}
            >
              {isRunning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Run
            </button>
          </div>
        </div>

        {/* Status */}
        <div className="mt-6 pt-6 border-t border-slate-700">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Status:</span>
            <span className={cn(
              'px-2 py-0.5 rounded text-xs',
              pipeline.status === 'active' && 'bg-green-500/20 text-green-400',
              pipeline.status === 'draft' && 'bg-slate-500/20 text-slate-400',
              pipeline.status === 'paused' && 'bg-yellow-500/20 text-yellow-400',
              pipeline.status === 'error' && 'bg-red-500/20 text-red-400'
            )}>
              {pipeline.status}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Nodes:</span>
            <span className="text-white">{pipeline.nodes.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-400">Connections:</span>
            <span className="text-white">{pipeline.edges.length}</span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="flex-1 relative overflow-auto" ref={canvasRef}>
        {/* Grid Background */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'radial-gradient(circle, #334155 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        {/* SVG for edges */}
        <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {renderEdges()}
        </svg>

        {/* Nodes */}
        {pipeline.nodes.map(node => {
          const config = nodeTypes[node.type];
          const Icon = config.icon;
          const status = executionStatus[node.id];

          return (
            <div
              key={node.id}
              className={cn(
                'absolute w-[140px] bg-slate-800 rounded-lg border-2 cursor-move select-none',
                selectedNode?.id === node.id ? 'border-blue-500' : config.borderColor,
                draggedNode === node.id && 'opacity-75',
                'hover:shadow-lg transition-shadow'
              )}
              style={{
                left: node.position.x,
                top: node.position.y,
                zIndex: selectedNode?.id === node.id ? 10 : 2,
              }}
              onMouseDown={e => {
                e.preventDefault();
                handleNodeDrag(node.id, e);
              }}
              onClick={e => {
                e.stopPropagation();
                setSelectedNode(node);
              }}
            >
              {/* Node Header */}
              <div className={cn('flex items-center gap-2 px-3 py-2 rounded-t-lg', config.color)}>
                <Icon className="w-4 h-4 text-white" />
                <span className="text-xs text-white font-medium truncate">{node.name}</span>
              </div>

              {/* Node Body */}
              <div className="px-3 py-2">
                <span className="text-xs text-slate-400">{config.label}</span>
                {status && (
                  <div className="mt-2 flex items-center gap-1">
                    {status === 'pending' && <Clock className="w-3 h-3 text-slate-400" />}
                    {status === 'running' && <Loader2 className="w-3 h-3 text-blue-400 animate-spin" />}
                    {status === 'completed' && <CheckCircle className="w-3 h-3 text-green-400" />}
                    {status === 'error' && <XCircle className="w-3 h-3 text-red-400" />}
                    <span className="text-xs text-slate-400 capitalize">{status}</span>
                  </div>
                )}
              </div>

              {/* Connection Points */}
              {node.type !== 'source' && (
                <div
                  className="absolute left-0 top-1/2 w-3 h-3 -ml-1.5 -mt-1.5 bg-blue-500 rounded-full border-2 border-slate-900 cursor-pointer"
                  onClick={e => {
                    e.stopPropagation();
                    if (connectingFrom) {
                      connectNodes(connectingFrom, node.id);
                      setConnectingFrom(null);
                    }
                  }}
                />
              )}
              {node.type !== 'destination' && (
                <div
                  className="absolute right-0 top-1/2 w-3 h-3 -mr-1.5 -mt-1.5 bg-blue-500 rounded-full border-2 border-slate-900 cursor-pointer hover:bg-blue-400"
                  onClick={e => {
                    e.stopPropagation();
                    setConnectingFrom(node.id);
                  }}
                />
              )}

              {/* Delete button */}
              <button
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                onClick={e => {
                  e.stopPropagation();
                  removeNode(node.id);
                }}
              >
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>
          );
        })}

        {/* Empty State */}
        {pipeline.nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <Plus className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">Add nodes from the sidebar to build your pipeline</p>
            </div>
          </div>
        )}
      </div>

      {/* Node Config Panel */}
      {selectedNode && (
        <div className="w-80 bg-slate-800 border-l border-slate-700 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">Node Configuration</h3>
            <button
              onClick={() => setSelectedNode(null)}
              className="text-slate-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          {/* Node Name */}
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">Name</label>
            <input
              type="text"
              value={selectedNode.name}
              onChange={e => updateNode(selectedNode.id, { name: e.target.value })}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
            />
          </div>

          {/* Node Type Specific Config */}
          {selectedNode.type === 'source' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Source Type</label>
                <select
                  value={selectedNode.config.sourceType || ''}
                  onChange={e => updateNode(selectedNode.id, { 
                    config: { ...selectedNode.config, sourceType: e.target.value } 
                  })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="">Select source...</option>
                  <option value="database">Database</option>
                  <option value="api">REST API</option>
                  <option value="file">File</option>
                  <option value="integration">Integration</option>
                </select>
              </div>
            </div>
          )}

          {selectedNode.type === 'filter' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Field</label>
                <input
                  type="text"
                  value={selectedNode.config.field || ''}
                  onChange={e => updateNode(selectedNode.id, { 
                    config: { ...selectedNode.config, field: e.target.value } 
                  })}
                  placeholder="e.g., status"
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Operator</label>
                <select
                  value={selectedNode.config.operator || 'eq'}
                  onChange={e => updateNode(selectedNode.id, { 
                    config: { ...selectedNode.config, operator: e.target.value } 
                  })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="eq">Equals</option>
                  <option value="neq">Not Equals</option>
                  <option value="gt">Greater Than</option>
                  <option value="lt">Less Than</option>
                  <option value="contains">Contains</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Value</label>
                <input
                  type="text"
                  value={selectedNode.config.value || ''}
                  onChange={e => updateNode(selectedNode.id, { 
                    config: { ...selectedNode.config, value: e.target.value } 
                  })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                />
              </div>
            </div>
          )}

          {selectedNode.type === 'destination' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Destination Type</label>
                <select
                  value={selectedNode.config.destinationType || ''}
                  onChange={e => updateNode(selectedNode.id, { 
                    config: { ...selectedNode.config, destinationType: e.target.value } 
                  })}
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm"
                >
                  <option value="">Select destination...</option>
                  <option value="database">Database</option>
                  <option value="warehouse">Data Warehouse</option>
                  <option value="api">REST API</option>
                  <option value="file">File</option>
                </select>
              </div>
            </div>
          )}

          {/* Config JSON (fallback) */}
          <div className="mt-6">
            <label className="text-xs text-slate-400 block mb-1">Raw Configuration (JSON)</label>
            <textarea
              value={JSON.stringify(selectedNode.config, null, 2)}
              onChange={e => {
                try {
                  const config = JSON.parse(e.target.value);
                  updateNode(selectedNode.id, { config });
                } catch {
                  // Invalid JSON, ignore
                }
              }}
              rows={6}
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-white text-sm font-mono"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default ETLPipelineBuilder;
