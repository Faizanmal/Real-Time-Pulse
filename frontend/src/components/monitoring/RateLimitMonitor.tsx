'use client';

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, AlertTriangle, CheckCircle } from 'lucide-react';

interface RateLimitMonitorProps {
  integrationId?: string;
}

export function RateLimitMonitor({ integrationId }: RateLimitMonitorProps) {
  const [metrics, setMetrics] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<any>(null);

  const loadMetrics = async () => {
    try {
      const url = integrationId
        ? `/api/rate-limit/monitoring?integrationId=${integrationId}`
        : '/api/rate-limit/monitoring';
      
      const response = await fetch(url);
      const data = await response.json();
      setMetrics(data);
    } catch (error) {
      console.error('Failed to load metrics', error);
    }
  };

  const loadQueueStats = async () => {
    try {
      const response = await fetch('/api/rate-limit/queue/stats');
      const data = await response.json();
      setQueueStats(data);
    } catch (error) {
      console.error('Failed to load queue stats', error);
    }
  };

  useEffect(() => {
    loadMetrics();
    loadQueueStats();
    
    const interval = setInterval(() => {
      loadMetrics();
      loadQueueStats();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [integrationId]);

  const getStatusColor = (remaining: number, total: number) => {
    const percentage = (remaining / total) * 100;
    if (percentage > 50) return 'text-green-500';
    if (percentage > 20) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2 mb-6">
        <Activity className="w-5 h-5" />
        Rate Limit Monitoring
      </h2>

      {/* Queue Statistics */}
      {queueStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Waiting</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{queueStats.waiting}</p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Active</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{queueStats.active}</p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{queueStats.completed}</p>
          </div>
          <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Failed</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{queueStats.failed}</p>
          </div>
          <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Delayed</p>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{queueStats.delayed}</p>
          </div>
        </div>
      )}

      {/* Rate Limit Metrics */}
      <div className="space-y-3">
        {metrics.length === 0 ? (
          <div className="text-center py-8 text-gray-500">No active rate limits</div>
        ) : (
          metrics.map((metric) => {
            const total = metric.requestCount + metric.remainingQuota;
            const usagePercent = (metric.requestCount / total) * 100;
            
            return (
              <div
                key={metric.integrationId}
                className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {metric.integrationId}
                    </span>
                    {usagePercent > 80 ? (
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                    ) : (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    )}
                  </div>
                  <span className={`text-sm font-medium ${getStatusColor(metric.remainingQuota, total)}`}>
                    {metric.remainingQuota} / {total} remaining
                  </span>
                </div>
                
                {/* Progress Bar */}
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      usagePercent > 80 ? 'bg-red-500' : 
                      usagePercent > 50 ? 'bg-yellow-500' : 
                      'bg-green-500'
                    }`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Resets at {new Date(metric.resetAt).toLocaleTimeString()}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
        <div className="flex items-start gap-2">
          <TrendingUp className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
          <div className="text-sm text-gray-600 dark:text-gray-400">
            <p className="font-medium mb-1">Smart Rate Limiting</p>
            <p>Requests are automatically queued and batched to optimize API usage and prevent rate limit errors.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
