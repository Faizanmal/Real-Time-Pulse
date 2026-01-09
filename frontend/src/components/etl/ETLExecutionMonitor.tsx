'use client';

import React, { useState, useEffect } from 'react';
import {
  Pause,
  RotateCcw,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  AlertTriangle,
  BarChart3,
  FileText,
  Download,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ETLExecution {
  id: string;
  pipelineId: string;
  pipelineName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  rowsProcessed: number;
  errors: string[];
  nodeStats: Record<string, {
    rowsIn: number;
    rowsOut: number;
    duration: number;
    errors: number;
  }>;
}

interface ETLExecutionMonitorProps {
  pipelineId?: string;
  className?: string;
}

export function ETLExecutionMonitor({ pipelineId, className }: ETLExecutionMonitorProps) {
  const [executions, setExecutions] = useState<ETLExecution[]>([]);
  const [selectedExecution, setSelectedExecution] = useState<ETLExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch executions
  useEffect(() => {
    const fetchExecutions = async () => {
      try {
        const url = pipelineId 
          ? `/api/etl/pipelines/${pipelineId}/executions`
          : '/api/etl/executions';
        const response = await fetch(url);
        const data = await response.json();
        setExecutions(data);
      } catch (error) {
        console.error('Failed to fetch executions:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
    const interval = setInterval(fetchExecutions, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [pipelineId]);

  // Cancel execution
  const cancelExecution = async (executionId: string) => {
    try {
      await fetch(`/api/etl/executions/${executionId}/cancel`, { method: 'POST' });
      setExecutions(execs => execs.map(e => 
        e.id === executionId ? { ...e, status: 'cancelled' } : e
      ));
    } catch (error) {
      console.error('Failed to cancel execution:', error);
    }
  };

  // Retry execution
  const retryExecution = async (executionId: string) => {
    try {
      const exec = executions.find(e => e.id === executionId);
      if (!exec) return;
      await fetch(`/api/etl/pipelines/${exec.pipelineId}/execute`, { method: 'POST' });
    } catch (error) {
      console.error('Failed to retry execution:', error);
    }
  };

  const getStatusIcon = (status: ETLExecution['status']) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-slate-400" />;
      case 'running':
        return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'cancelled':
        return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const formatDuration = (start: string, end?: string) => {
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const seconds = Math.floor((endTime - startTime) / 1000);
    
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const filteredExecutions = statusFilter === 'all' 
    ? executions 
    : executions.filter(e => e.status === statusFilter);

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-64', className)}>
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={cn('bg-slate-900 rounded-xl p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-white">Execution History</h2>
        <div className="flex items-center gap-4">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {filteredExecutions.length === 0 ? (
        <div className="text-center py-12">
          <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
          <p className="text-slate-400">No executions found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExecutions.map(execution => (
            <div
              key={execution.id}
              className={cn(
                'bg-slate-800 rounded-lg border transition-colors',
                selectedExecution?.id === execution.id 
                  ? 'border-blue-500' 
                  : 'border-slate-700 hover:border-slate-600'
              )}
            >
              {/* Execution Header */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setSelectedExecution(
                  selectedExecution?.id === execution.id ? null : execution
                )}
              >
                <div className="flex items-center gap-4">
                  {getStatusIcon(execution.status)}
                  <div>
                    <p className="text-white font-medium">{execution.pipelineName}</p>
                    <p className="text-sm text-slate-400">
                      Started {new Date(execution.startedAt).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-white">{execution.rowsProcessed.toLocaleString()} rows</p>
                    <p className="text-sm text-slate-400">
                      {formatDuration(execution.startedAt, execution.completedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {execution.status === 'running' && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          cancelExecution(execution.id);
                        }}
                        className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                        title="Cancel"
                      >
                        <Pause className="w-4 h-4" />
                      </button>
                    )}
                    {execution.status === 'failed' && (
                      <button
                        onClick={e => {
                          e.stopPropagation();
                          retryExecution(execution.id);
                        }}
                        className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors"
                        title="Retry"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    )}
                    {selectedExecution?.id === execution.id ? (
                      <ChevronDown className="w-5 h-5 text-slate-400" />
                    ) : (
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    )}
                  </div>
                </div>
              </div>

              {/* Execution Details */}
              {selectedExecution?.id === execution.id && (
                <div className="border-t border-slate-700 p-4">
                  {/* Node Stats */}
                  <h4 className="text-sm font-medium text-white mb-3">Node Statistics</h4>
                  <div className="overflow-x-auto mb-4">
                    <table className="w-full">
                      <thead>
                        <tr className="text-left text-xs text-slate-400">
                          <th className="pb-2">Node</th>
                          <th className="pb-2">Rows In</th>
                          <th className="pb-2">Rows Out</th>
                          <th className="pb-2">Duration</th>
                          <th className="pb-2">Errors</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(execution.nodeStats).map(([nodeId, stats]) => (
                          <tr key={nodeId} className="text-sm">
                            <td className="py-2 text-white">{nodeId}</td>
                            <td className="py-2 text-slate-300">{stats.rowsIn.toLocaleString()}</td>
                            <td className="py-2 text-slate-300">{stats.rowsOut.toLocaleString()}</td>
                            <td className="py-2 text-slate-300">{stats.duration}ms</td>
                            <td className="py-2">
                              {stats.errors > 0 ? (
                                <span className="text-red-400">{stats.errors}</span>
                              ) : (
                                <span className="text-green-400">0</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Errors */}
                  {execution.errors.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-red-400 mb-2">
                        Errors ({execution.errors.length})
                      </h4>
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 max-h-40 overflow-y-auto">
                        {execution.errors.map((error, i) => (
                          <p key={i} className="text-sm text-red-300 font-mono">
                            {error}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 mt-4">
                    <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                      <FileText className="w-4 h-4" />
                      View Logs
                    </button>
                    <button className="flex items-center gap-2 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm transition-colors">
                      <Download className="w-4 h-4" />
                      Export Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ETLExecutionMonitor;
