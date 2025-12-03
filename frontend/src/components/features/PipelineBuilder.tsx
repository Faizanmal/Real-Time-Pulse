'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { usePipelines } from '@/hooks/useAdvancedFeatures';
import { pipelineAPI } from '@/lib/advanced-features-api';

interface PipelineNode {
  id: string;
  type: string;
  config: Record<string, any>;
  position: { x: number; y: number };
}

interface PipelineEdge {
  id: string;
  source: string;
  target: string;
}

const NODE_TYPES = [
  { type: 'source_database', label: 'Database Source', icon: '🗄️', category: 'Sources' },
  { type: 'source_api', label: 'API Source', icon: '🌐', category: 'Sources' },
  { type: 'source_file', label: 'File Source', icon: '📁', category: 'Sources' },
  { type: 'transform_filter', label: 'Filter', icon: '🔍', category: 'Transforms' },
  { type: 'transform_map', label: 'Map', icon: '🔄', category: 'Transforms' },
  { type: 'transform_aggregate', label: 'Aggregate', icon: '📊', category: 'Transforms' },
  { type: 'transform_join', label: 'Join', icon: '🔗', category: 'Transforms' },
  { type: 'transform_sort', label: 'Sort', icon: '↕️', category: 'Transforms' },
  { type: 'destination_database', label: 'Database Output', icon: '💾', category: 'Destinations' },
  { type: 'destination_api', label: 'API Output', icon: '📤', category: 'Destinations' },
  { type: 'destination_widget', label: 'Widget Output', icon: '📈', category: 'Destinations' },
];

interface PipelineBuilderProps {
  pipeline?: any;
  onSave?: (pipeline: any) => void;
}

export function PipelineBuilder({ pipeline, onSave }: PipelineBuilderProps) {
  const [nodes, setNodes] = useState<PipelineNode[]>(pipeline?.nodes || []);
  const [edges, setEdges] = useState<PipelineEdge[]>(pipeline?.edges || []);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [name, setName] = useState(pipeline?.name || 'New Pipeline');
  const [dragging, setDragging] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const handleDragStart = useCallback((type: string) => {
    setDragging(type);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!dragging || !canvasRef.current) return;

      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newNode: PipelineNode = {
        id: `node_${Date.now()}`,
        type: dragging,
        config: {},
        position: { x, y },
      };

      setNodes((prev) => [...prev, newNode]);
      setDragging(null);
    },
    [dragging]
  );

  const handleNodeClick = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (connecting) {
      // Create edge
      if (connecting !== nodeId) {
        setEdges((prev) => [
          ...prev,
          { id: `edge_${Date.now()}`, source: connecting, target: nodeId },
        ]);
      }
      setConnecting(null);
    } else {
      setSelectedNode(nodeId);
    }
  }, [connecting]);

  const handleStartConnect = useCallback((nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConnecting(nodeId);
  }, []);

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    setSelectedNode(null);
  }, []);

  const handleSave = useCallback(() => {
    if (onSave) {
      onSave({ name, nodes, edges });
    }
  }, [name, nodes, edges, onSave]);

  const getNodeInfo = (type: string) => NODE_TYPES.find((n) => n.type === type);

  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-900">
      {/* Sidebar - Node Types */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r p-4 overflow-auto">
        <h3 className="font-medium mb-4">Components</h3>
        {['Sources', 'Transforms', 'Destinations'].map((category) => (
          <div key={category} className="mb-4">
            <div className="text-xs font-medium text-gray-500 uppercase mb-2">{category}</div>
            <div className="space-y-1">
              {NODE_TYPES.filter((n) => n.category === category).map((nodeType) => (
                <div
                  key={nodeType.type}
                  draggable
                  onDragStart={() => handleDragStart(nodeType.type)}
                  className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-700 rounded cursor-move hover:bg-gray-100 dark:hover:bg-gray-600"
                >
                  <span>{nodeType.icon}</span>
                  <span className="text-sm">{nodeType.label}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 border-b">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="text-lg font-medium bg-transparent border-none outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setNodes([]);
                setEdges([]);
              }}
              className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Clear
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Save Pipeline
            </button>
          </div>
        </div>

        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          onClick={() => setSelectedNode(null)}
        >
          {/* Grid Background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: 'radial-gradient(circle, #ddd 1px, transparent 1px)',
              backgroundSize: '20px 20px',
            }}
          />

          {/* Edges */}
          <svg className="absolute inset-0 pointer-events-none">
            {edges.map((edge) => {
              const sourceNode = nodes.find((n) => n.id === edge.source);
              const targetNode = nodes.find((n) => n.id === edge.target);
              if (!sourceNode || !targetNode) return null;

              return (
                <line
                  key={edge.id}
                  x1={sourceNode.position.x + 80}
                  y1={sourceNode.position.y + 30}
                  x2={targetNode.position.x}
                  y2={targetNode.position.y + 30}
                  stroke="#6366f1"
                  strokeWidth="2"
                  markerEnd="url(#arrowhead)"
                />
              );
            })}
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
              </marker>
            </defs>
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const info = getNodeInfo(node.type);
            const isSelected = selectedNode === node.id;
            const isConnecting = connecting === node.id;

            return (
              <div
                key={node.id}
                className={`absolute w-40 p-3 bg-white dark:bg-gray-800 rounded-lg border-2 shadow-sm cursor-pointer transition-all ${
                  isSelected
                    ? 'border-blue-500 shadow-lg'
                    : isConnecting
                    ? 'border-green-500'
                    : 'border-gray-200 dark:border-gray-700'
                }`}
                style={{ left: node.position.x, top: node.position.y }}
                onClick={(e) => handleNodeClick(node.id, e)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">{info?.icon}</span>
                  <span className="text-sm font-medium truncate">{info?.label}</span>
                </div>
                
                {/* Connect Handle */}
                <div
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-crosshair hover:scale-125 transition-transform"
                  onClick={(e) => handleStartConnect(node.id, e)}
                />
              </div>
            );
          })}

          {/* Empty State */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-lg">Drag components here to build your pipeline</p>
                <p className="text-sm mt-1">Connect nodes by clicking the blue handles</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Properties Panel */}
      {selectedNode && (
        <div className="w-72 bg-white dark:bg-gray-800 border-l p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium">Properties</h3>
            <button
              onClick={() => handleDeleteNode(selectedNode)}
              className="text-red-500 hover:text-red-600 text-sm"
            >
              Delete
            </button>
          </div>
          {(() => {
            const node = nodes.find((n) => n.id === selectedNode);
            const info = node ? getNodeInfo(node.type) : null;
            return (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Type</label>
                  <div className="flex items-center gap-2">
                    <span>{info?.icon}</span>
                    <span>{info?.label}</span>
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 mb-1">Configuration</label>
                  <textarea
                    value={JSON.stringify(node?.config || {}, null, 2)}
                    onChange={(e) => {
                      try {
                        const config = JSON.parse(e.target.value);
                        setNodes((prev) =>
                          prev.map((n) => (n.id === selectedNode ? { ...n, config } : n))
                        );
                      } catch {}
                    }}
                    className="w-full h-32 p-2 text-sm font-mono bg-gray-50 dark:bg-gray-700 rounded border"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

export function PipelinesList() {
  const { pipelines, loading, createPipeline, executePipeline } = usePipelines();
  const [showBuilder, setShowBuilder] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState<any>(null);
  const [executing, setExecuting] = useState<string | null>(null);

  const handleSave = async (pipelineData: any) => {
    await createPipeline(pipelineData);
    setShowBuilder(false);
  };

  const handleExecute = async (pipelineId: string) => {
    setExecuting(pipelineId);
    try {
      await executePipeline(pipelineId);
    } finally {
      setExecuting(null);
    }
  };

  if (showBuilder) {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={() => setShowBuilder(false)}
          className="mb-2 text-sm text-blue-600 hover:underline"
        >
          ← Back to Pipelines
        </button>
        <div className="flex-1">
          <PipelineBuilder pipeline={selectedPipeline} onSave={handleSave} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Data Pipelines</h2>
        <button
          onClick={() => {
            setSelectedPipeline(null);
            setShowBuilder(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          + New Pipeline
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading pipelines...</div>
      ) : pipelines.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No pipelines yet. Create your first data pipeline!
        </div>
      ) : (
        <div className="grid gap-4">
          {pipelines.map((pipeline) => (
            <div
              key={pipeline.id}
              className="p-4 bg-white dark:bg-gray-800 rounded-lg border"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">{pipeline.name}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {pipeline.nodes?.length || 0} nodes • {pipeline.edges?.length || 0} connections
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs rounded ${
                      pipeline.status === 'active'
                        ? 'bg-green-100 text-green-700'
                        : pipeline.status === 'error'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {pipeline.status}
                  </span>
                  <button
                    onClick={() => handleExecute(pipeline.id)}
                    disabled={executing === pipeline.id}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    {executing === pipeline.id ? 'Running...' : 'Run'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedPipeline(pipeline);
                      setShowBuilder(true);
                    }}
                    className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
                  >
                    Edit
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
