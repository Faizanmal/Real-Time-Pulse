'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GitBranch, Play, Pause, Settings, AlertCircle, CheckCircle } from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  status: 'success' | 'running' | 'failed' | 'pending';
  duration: number;
  startedAt: string | null;
  completedAt: string | null;
}

interface Pipeline {
  id: string;
  name: string;
  type: string;
  status: 'running' | 'success' | 'failed' | 'idle';
  stages: PipelineStage[];
  lastRun: string | null;
  nextRun: string | null;
  totalRuns: number;
  successRate: number;
}

export default function PipelineVisualization() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(null);

  const fetchPipelines = useCallback(async () => {
    try {
      const response = await fetch('/api/pipeline');
      const data = await response.json();
      setPipelines(data);
      if (data.length > 0) {
        setSelectedPipeline(data[0]);
      }
    } catch (error) {
      console.error('Failed to fetch pipelines:', error);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await fetch('/api/pipeline');
        const data = await response.json();
        if (mounted) {
          setPipelines(data);
          if (data.length > 0) setSelectedPipeline(data[0]);
        }
      } catch (error) {
        console.error('Failed to fetch pipelines:', error);
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const runPipeline = useCallback(async (id: string) => {
    try {
      await fetch(`/api/pipeline/${id}/run`, { method: 'POST' });
      fetchPipelines();
    } catch (error) {
      console.error('Failed to run pipeline:', error);
    }
  }, [fetchPipelines]);

  const stopPipeline = useCallback(async (id: string) => {
    try {
      await fetch(`/api/pipeline/${id}/stop`, { method: 'POST' });
      fetchPipelines();
    } catch (error) {
      console.error('Failed to stop pipeline:', error);
    }
  }, [fetchPipelines]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-500';
      case 'running': return 'bg-blue-500 animate-pulse';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'running': return <Play className="h-4 w-4 text-blue-600 animate-pulse" />;
      case 'failed': return <AlertCircle className="h-4 w-4 text-red-600" />;
      default: return <Pause className="h-4 w-4 text-gray-600" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <GitBranch className="h-8 w-8" />
            Pipeline Visualization
          </h1>
          <p className="text-muted-foreground">Monitor and manage data pipelines</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Pipelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pipelines.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Running</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {pipelines.filter(p => p.status === 'running').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {pipelines.length > 0
                ? ((pipelines.reduce((acc, p) => acc + p.successRate, 0) / pipelines.length) * 100).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Runs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {pipelines.reduce((acc, p) => acc + p.totalRuns, 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Pipelines</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pipelines.map((pipeline) => (
                <div
                  key={pipeline.id}
                  className={`p-3 border rounded cursor-pointer hover:bg-secondary transition-colors ${
                    selectedPipeline?.id === pipeline.id ? 'bg-secondary' : ''
                  }`}
                  onClick={() => setSelectedPipeline(pipeline)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(pipeline.status)}
                      <span className="font-semibold text-sm">{pipeline.name}</span>
                    </div>
                    <Badge variant="outline">{pipeline.type}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="md:col-span-2">
          {selectedPipeline && (
            <Card>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{selectedPipeline.name}</CardTitle>
                    <CardDescription className="mt-1">{selectedPipeline.type} pipeline</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {selectedPipeline.status === 'running' ? (
                      <Button size="sm" variant="destructive" onClick={() => stopPipeline(selectedPipeline.id)}>
                        <Pause className="h-3 w-3 mr-1" />
                        Stop
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => runPipeline(selectedPipeline.id)}>
                        <Play className="h-3 w-3 mr-1" />
                        Run
                      </Button>
                    )}
                    <Button size="sm" variant="outline">
                      <Settings className="h-3 w-3 mr-1" />
                      Settings
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground mb-1">Last Run</div>
                      <div className="font-semibold">
                        {selectedPipeline.lastRun
                          ? new Date(selectedPipeline.lastRun).toLocaleString()
                          : 'Never'}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Success Rate</div>
                      <div className="font-semibold text-green-600">
                        {(selectedPipeline.successRate * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">Total Runs</div>
                      <div className="font-semibold">{selectedPipeline.totalRuns}</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="font-semibold text-sm">Pipeline Stages</div>
                    {selectedPipeline.stages.map((stage, index) => (
                      <div key={stage.id} className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full ${getStatusColor(stage.status)} flex items-center justify-center text-white font-semibold text-sm`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 p-3 border rounded">
                          <div className="flex justify-between items-center">
                            <div>
                              <div className="font-semibold text-sm">{stage.name}</div>
                              {stage.startedAt && (
                                <div className="text-xs text-muted-foreground">
                                  {stage.duration ? `${stage.duration}s` : 'Running...'}
                                </div>
                              )}
                            </div>
                            {getStatusIcon(stage.status)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
