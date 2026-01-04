'use client';

import React, { useState, useEffect } from 'react';
import {
  Globe,
  Server,
  Activity,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  MapPin,
  Zap,
  Clock,
  Users,
  TrendingUp,
  Settings,
  Play,
  Pause,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Region {
  id: string;
  name: string;
  endpoint: string;
  isPrimary: boolean;
  healthStatus: 'healthy' | 'degraded' | 'unhealthy';
  latency: number;
  capacity: number;
  currentLoad: number;
  replicas: number;
}

interface RoutingRule {
  id: string;
  name: string;
  conditions: any[];
  targetRegion: string;
  priority: number;
  enabled: boolean;
}

interface ClusterStats {
  totalReplicas: number;
  healthyReplicas: number;
  totalRegions: number;
  healthyRegions: number;
  totalCapacity: number;
  currentLoad: number;
  avgLatency: number;
}

interface MultiRegionDashboardProps {
  className?: string;
}

export function MultiRegionDashboard({ className }: MultiRegionDashboardProps) {
  const [regions, setRegions] = useState<Region[]>([]);
  const [routingRules, setRoutingRules] = useState<RoutingRule[]>([]);
  const [stats, setStats] = useState<ClusterStats | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'routing' | 'failover'>('overview');

  // Fetch data
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [regionsRes, rulesRes, statsRes] = await Promise.all([
          fetch('/api/scaling/regions'),
          fetch('/api/scaling/routing-rules'),
          fetch('/api/scaling/cluster/stats'),
        ]);

        setRegions(await regionsRes.json());
        setRoutingRules(await rulesRes.json());
        setStats(await statsRes.json());
      } catch (error) {
        console.error('Failed to fetch data:', error);
        // Mock data
        setRegions([
          {
            id: 'us-east-1',
            name: 'US East (N. Virginia)',
            endpoint: 'https://us-east-1.api.example.com',
            isPrimary: true,
            healthStatus: 'healthy',
            latency: 12,
            capacity: 1000,
            currentLoad: 450,
            replicas: 5,
          },
          {
            id: 'us-west-2',
            name: 'US West (Oregon)',
            endpoint: 'https://us-west-2.api.example.com',
            isPrimary: false,
            healthStatus: 'healthy',
            latency: 45,
            capacity: 800,
            currentLoad: 280,
            replicas: 3,
          },
          {
            id: 'eu-west-1',
            name: 'EU (Ireland)',
            endpoint: 'https://eu-west-1.api.example.com',
            isPrimary: false,
            healthStatus: 'degraded',
            latency: 85,
            capacity: 600,
            currentLoad: 520,
            replicas: 4,
          },
          {
            id: 'ap-southeast-1',
            name: 'Asia Pacific (Singapore)',
            endpoint: 'https://ap-southeast-1.api.example.com',
            isPrimary: false,
            healthStatus: 'healthy',
            latency: 150,
            capacity: 400,
            currentLoad: 180,
            replicas: 2,
          },
        ]);
        setRoutingRules([
          {
            id: 'rule-1',
            name: 'EU Traffic',
            conditions: [{ type: 'geo', field: 'country', operator: 'in', value: ['DE', 'FR', 'GB'] }],
            targetRegion: 'eu-west-1',
            priority: 1,
            enabled: true,
          },
          {
            id: 'rule-2',
            name: 'APAC Traffic',
            conditions: [{ type: 'geo', field: 'country', operator: 'in', value: ['SG', 'JP', 'AU'] }],
            targetRegion: 'ap-southeast-1',
            priority: 2,
            enabled: true,
          },
        ]);
        setStats({
          totalReplicas: 14,
          healthyReplicas: 13,
          totalRegions: 4,
          healthyRegions: 3,
          totalCapacity: 2800,
          currentLoad: 1430,
          avgLatency: 73,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, []);

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
      case 'unhealthy':
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return null;
    }
  };

  const getLoadPercentage = (region: Region) => {
    return Math.round((region.currentLoad / region.capacity) * 100);
  };

  const triggerFailover = async (fromRegion: string, toRegion: string) => {
    if (!confirm(`Trigger failover from ${fromRegion} to ${toRegion}?`)) return;

    try {
      await fetch('/api/scaling/failover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromRegion, toRegion }),
      });
    } catch (error) {
      console.error('Failover failed:', error);
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
            <h2 className="text-xl font-semibold text-white">Multi-Region Infrastructure</h2>
            <p className="text-sm text-slate-400">Global deployment and traffic routing</p>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            <Settings className="w-4 h-4" />
            Configure
          </button>
        </div>

        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Server className="w-4 h-4" />
                <span className="text-sm">Total Replicas</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {stats.healthyReplicas}/{stats.totalReplicas}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Globe className="w-4 h-4" />
                <span className="text-sm">Regions</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {stats.healthyRegions}/{stats.totalRegions}
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Activity className="w-4 h-4" />
                <span className="text-sm">Load</span>
              </div>
              <p className="text-2xl font-semibold text-white">
                {Math.round((stats.currentLoad / stats.totalCapacity) * 100)}%
              </p>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-sm">Avg Latency</span>
              </div>
              <p className="text-2xl font-semibold text-white">{stats.avgLatency}ms</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-700">
        {(['overview', 'routing', 'failover'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'px-6 py-3 text-sm font-medium capitalize transition-colors',
              activeTab === tab
                ? 'text-blue-400 border-b-2 border-blue-400'
                : 'text-slate-400 hover:text-white'
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {activeTab === 'overview' && (
          <div className="grid grid-cols-2 gap-6">
            {regions.map(region => (
              <div
                key={region.id}
                onClick={() => setSelectedRegion(region)}
                className={cn(
                  'bg-slate-800 rounded-lg p-6 border-2 cursor-pointer transition-colors',
                  selectedRegion?.id === region.id
                    ? 'border-blue-500'
                    : 'border-transparent hover:border-slate-600'
                )}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {getHealthIcon(region.healthStatus)}
                    <div>
                      <h3 className="text-white font-medium">{region.name}</h3>
                      <p className="text-xs text-slate-400">{region.id}</p>
                    </div>
                  </div>
                  {region.isPrimary && (
                    <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                      Primary
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div>
                    <p className="text-xs text-slate-400">Replicas</p>
                    <p className="text-lg font-semibold text-white">{region.replicas}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Latency</p>
                    <p className="text-lg font-semibold text-white">{region.latency}ms</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Load</p>
                    <p className="text-lg font-semibold text-white">{getLoadPercentage(region)}%</p>
                  </div>
                </div>

                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div
                    className={cn(
                      'h-2 rounded-full transition-all',
                      getLoadPercentage(region) > 80 ? 'bg-red-500' :
                      getLoadPercentage(region) > 60 ? 'bg-yellow-500' : 'bg-green-500'
                    )}
                    style={{ width: `${getLoadPercentage(region)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'routing' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-white">Routing Rules</h3>
              <button className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors">
                <Zap className="w-4 h-4" />
                Add Rule
              </button>
            </div>

            {routingRules.map(rule => (
              <div
                key={rule.id}
                className="bg-slate-800 rounded-lg p-4 border border-slate-700"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <button
                      className={cn(
                        'w-10 h-6 rounded-full transition-colors relative',
                        rule.enabled ? 'bg-green-500' : 'bg-slate-600'
                      )}
                    >
                      <div className={cn(
                        'absolute top-1 w-4 h-4 rounded-full bg-white transition-transform',
                        rule.enabled ? 'left-5' : 'left-1'
                      )} />
                    </button>
                    <div>
                      <p className="text-white font-medium">{rule.name}</p>
                      <p className="text-sm text-slate-400">Priority: {rule.priority}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-slate-400">
                      <span>Conditions</span>
                      <ArrowRight className="w-4 h-4" />
                      <span className="text-blue-400">{rule.targetRegion}</span>
                    </div>
                    <button className="p-2 hover:bg-slate-700 rounded transition-colors">
                      <Settings className="w-4 h-4 text-slate-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'failover' && (
          <div>
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-2 text-yellow-400 mb-2">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">Failover Actions</span>
              </div>
              <p className="text-sm text-slate-400">
                Manual failover should only be triggered in case of regional outage or maintenance.
                Automatic failover is handled by the system.
              </p>
            </div>

            <h3 className="text-lg font-medium text-white mb-4">Quick Failover</h3>
            <div className="grid grid-cols-2 gap-4">
              {regions.filter(r => r.isPrimary || r.healthStatus === 'healthy').map(from => (
                regions.filter(to => to.id !== from.id && to.healthStatus === 'healthy').slice(0, 1).map(to => (
                  <button
                    key={`${from.id}-${to.id}`}
                    onClick={() => triggerFailover(from.id, to.id)}
                    className="flex items-center justify-between p-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <MapPin className="w-5 h-5 text-slate-400" />
                      <span className="text-white">{from.name}</span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                    <div className="flex items-center gap-3">
                      <span className="text-white">{to.name}</span>
                      <MapPin className="w-5 h-5 text-green-400" />
                    </div>
                  </button>
                ))
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default MultiRegionDashboard;
