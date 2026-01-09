'use client';

import React, { useState, useEffect } from 'react';
import {
  Server,
  TrendingUp,
  TrendingDown,
  Activity,
  Clock,
  Cpu,
  HardDrive,
  RefreshCw,
  Plus,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScalingPolicy {
  id: string;
  name: string;
  metric: string;
  threshold: {
    scaleUp: number;
    scaleDown: number;
    cooldownPeriod: number;
  };
  minReplicas: number;
  maxReplicas: number;
  scalingStep: number;
  enabled: boolean;
}

interface ScalingEvent {
  id: string;
  timestamp: Date;
  type: 'scale_up' | 'scale_down';
  policyId: string;
  fromReplicas: number;
  toReplicas: number;
  reason: string;
}

interface ScalingStats {
  currentReplicas: number;
  policies: { id: string; name: string; enabled: boolean; lastScaled?: Date }[];
  recentEvents: ScalingEvent[];
  instances: Record<string, { total: number; healthy: number }>;
}

interface AutoScalingDashboardProps {
  className?: string;
}

export function AutoScalingDashboard({ className }: AutoScalingDashboardProps) {
  const [policies, setPolicies] = useState<ScalingPolicy[]>([]);
  const [stats, setStats] = useState<ScalingStats | null>(null);
  const [history, setHistory] = useState<ScalingEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPolicy, setSelectedPolicy] = useState<ScalingPolicy | null>(null);

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [policiesRes, statsRes, historyRes] = await Promise.all([
          fetch('/api/scaling/policies'),
          fetch('/api/scaling/stats'),
          fetch('/api/scaling/history?limit=20'),
        ]);

        setPolicies(await policiesRes.json());
        setStats(await statsRes.json());
        setHistory(await historyRes.json());
      } catch (error) {
        console.error('Failed to fetch scaling data:', error);
        // Mock data
        setPolicies([
          {
            id: 'policy-1',
            name: 'CPU Utilization',
            metric: 'cpu',
            threshold: { scaleUp: 80, scaleDown: 30, cooldownPeriod: 300 },
            minReplicas: 2,
            maxReplicas: 20,
            scalingStep: 2,
            enabled: true,
          },
          {
            id: 'policy-2',
            name: 'Memory Utilization',
            metric: 'memory',
            threshold: { scaleUp: 85, scaleDown: 40, cooldownPeriod: 300 },
            minReplicas: 2,
            maxReplicas: 20,
            scalingStep: 1,
            enabled: true,
          },
          {
            id: 'policy-3',
            name: 'Response Latency',
            metric: 'latency',
            threshold: { scaleUp: 500, scaleDown: 100, cooldownPeriod: 120 },
            minReplicas: 2,
            maxReplicas: 50,
            scalingStep: 3,
            enabled: false,
          },
        ]);
        setStats({
          currentReplicas: 5,
          policies: [
            { id: 'policy-1', name: 'CPU Utilization', enabled: true, lastScaled: new Date(Date.now() - 600000) },
            { id: 'policy-2', name: 'Memory Utilization', enabled: true },
          ],
          recentEvents: [],
          instances: {
            backend: { total: 5, healthy: 5 },
            frontend: { total: 3, healthy: 3 },
            worker: { total: 2, healthy: 2 },
          },
        });
        setHistory([
          {
            id: 'evt-1',
            timestamp: new Date(Date.now() - 600000),
            type: 'scale_up',
            policyId: 'policy-1',
            fromReplicas: 3,
            toReplicas: 5,
            reason: 'CPU exceeded threshold (85% > 80%)',
          },
          {
            id: 'evt-2',
            timestamp: new Date(Date.now() - 3600000),
            type: 'scale_down',
            policyId: 'policy-1',
            fromReplicas: 5,
            toReplicas: 3,
            reason: 'CPU below threshold (25% < 30%)',
          },
        ]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const togglePolicy = async (policyId: string) => {
    const policy = policies.find(p => p.id === policyId);
    if (!policy) return;

    try {
      await fetch(`/api/scaling/policies/${policyId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !policy.enabled }),
      });
    } catch (error) {
      console.error('Failed to toggle policy:', error);
    }

    setPolicies(ps => ps.map(p =>
      p.id === policyId ? { ...p, enabled: !p.enabled } : p
    ));
  };

  const getMetricIcon = (metric: string) => {
    switch (metric) {
      case 'cpu': return Cpu;
      case 'memory': return HardDrive;
      case 'latency': return Clock;
      case 'requests': return Activity;
      default: return Activity;
    }
  };

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-96', className)}>
        <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className={cn('bg-slate-900 rounded-xl overflow-hidden', className)}>
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-white">Auto Scaling</h2>
            <p className="text-sm text-slate-400">Horizontal pod autoscaling policies</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
            Add Policy
          </button>
        </div>

        {/* Current State */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Server className="w-4 h-4" />
                <span className="text-sm">Current Replicas</span>
              </div>
              <p className="text-2xl font-semibold text-white">{stats.currentReplicas}</p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Active Policies</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {policies.filter(p => p.enabled).length}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <TrendingUp className="w-4 h-4" />
                <span className="text-sm">Scale Up Events (24h)</span>
              </div>
              <p className="text-2xl font-semibold text-green-400">
                {history.filter(e => e.type === 'scale_up').length}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <TrendingDown className="w-4 h-4" />
                <span className="text-sm">Scale Down Events (24h)</span>
              </div>
              <p className="text-2xl font-semibold text-blue-400">
                {history.filter(e => e.type === 'scale_down').length}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex">
        {/* Policies */}
        <div className="w-1/2 border-r border-slate-700 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Scaling Policies</h3>
          <div className="space-y-4">
            {policies.map(policy => {
              const MetricIcon = getMetricIcon(policy.metric);

              return (
                <div
                  key={policy.id}
                  onClick={() => setSelectedPolicy(policy)}
                  className={cn(
                    'bg-slate-800 rounded-lg p-4 border cursor-pointer transition-colors',
                    selectedPolicy?.id === policy.id
                      ? 'border-blue-500'
                      : 'border-slate-700 hover:border-slate-600'
                  )}
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'p-2 rounded',
                        policy.enabled ? 'bg-green-500/20' : 'bg-slate-700'
                      )}>
                        <MetricIcon className={cn(
                          'w-4 h-4',
                          policy.enabled ? 'text-green-400' : 'text-slate-400'
                        )} />
                      </div>
                      <div>
                        <p className="text-white font-medium">{policy.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{policy.metric} metric</p>
                      </div>
                    </div>
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        togglePolicy(policy.id);
                      }}
                      className={cn(
                        'w-10 h-6 rounded-full transition-colors relative',
                        policy.enabled ? 'bg-green-500' : 'bg-slate-600'
                      )}
                    >
                      <div className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        policy.enabled ? 'left-5' : 'left-1'
                      )} />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-400">Scale Up</p>
                      <p className="text-white">&gt; {policy.threshold.scaleUp}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Scale Down</p>
                      <p className="text-white">&lt; {policy.threshold.scaleDown}</p>
                    </div>
                    <div>
                      <p className="text-slate-400">Replicas</p>
                      <p className="text-white">{policy.minReplicas} - {policy.maxReplicas}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* History */}
        <div className="w-1/2 p-6">
          <h3 className="text-lg font-medium text-white mb-4">Scaling History</h3>
          {history.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No scaling events yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(event => (
                <div
                  key={event.id}
                  className="bg-slate-800 rounded-lg p-4 border border-slate-700"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {event.type === 'scale_up' ? (
                        <TrendingUp className="w-4 h-4 text-green-400" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-blue-400" />
                      )}
                      <span className={cn(
                        'text-sm font-medium',
                        event.type === 'scale_up' ? 'text-green-400' : 'text-blue-400'
                      )}>
                        {event.fromReplicas} → {event.toReplicas} replicas
                      </span>
                    </div>
                    <span className="text-xs text-slate-400">
                      {new Date(event.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm text-slate-300">{event.reason}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AutoScalingDashboard;
