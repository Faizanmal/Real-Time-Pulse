'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Lightbulb, TrendingUp, AlertTriangle, Target, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ProactiveInsight {
  type: 'anomaly' | 'trend' | 'opportunity' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  actionable: boolean;
  suggestedAction?: string;
}

interface AIProactiveInsightsProps {
  className?: string;
  maxInsights?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

const insightIcons = {
  anomaly: AlertTriangle,
  trend: TrendingUp,
  opportunity: Target,
  warning: Lightbulb,
};

const severityColors = {
  low: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  medium: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
  high: 'text-red-400 bg-red-500/10 border-red-500/20',
};

const typeColors = {
  anomaly: 'text-red-400',
  trend: 'text-green-400',
  opportunity: 'text-blue-400',
  warning: 'text-yellow-400',
};

export function AIProactiveInsights({
  className,
  maxInsights = 5,
  autoRefresh = true,
  refreshInterval = 300, // 5 minutes
}: AIProactiveInsightsProps) {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Fetch insights
  const fetchInsights = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/conversation/insights');
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchInsights();

    if (autoRefresh) {
      const interval = setInterval(fetchInsights, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [fetchInsights, autoRefresh, refreshInterval]);

  // Dismiss insight
  const dismissInsight = useCallback((index: number) => {
    setDismissedIds(prev => new Set([...prev, index.toString()]));
  }, []);

  // Filter out dismissed insights
  const visibleInsights = insights
    .filter((_, i) => !dismissedIds.has(i.toString()))
    .slice(0, maxInsights);

  if (isLoading) {
    return (
      <div className={cn('p-4 bg-slate-900 rounded-xl border border-slate-700', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-white">AI Insights</span>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-700 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visibleInsights.length === 0) {
    return (
      <div className={cn('p-4 bg-slate-900 rounded-xl border border-slate-700', className)}>
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-white">AI Insights</span>
        </div>
        <p className="text-slate-400 text-sm text-center py-4">
          No insights available at the moment. Check back later for AI-generated recommendations.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('p-4 bg-slate-900 rounded-xl border border-slate-700', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-yellow-400" />
          <span className="font-semibold text-white">AI Insights</span>
        </div>
        <span className="text-xs text-slate-500">{visibleInsights.length} active</span>
      </div>

      <div className="space-y-3">
        {visibleInsights.map((insight, index) => {
          const Icon = insightIcons[insight.type];
          const isExpanded = expandedId === index.toString();

          return (
            <div
              key={index}
              className={cn(
                'p-3 rounded-lg border transition-all cursor-pointer',
                severityColors[insight.severity],
                isExpanded && 'ring-1 ring-white/20'
              )}
              onClick={() => setExpandedId(isExpanded ? null : index.toString())}
            >
              <div className="flex items-start gap-3">
                <Icon className={cn('w-5 h-5 mt-0.5 flex-shrink-0', typeColors[insight.type])} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white text-sm truncate">{insight.title}</h4>
                    <span
                      className={cn(
                        'text-xs px-1.5 py-0.5 rounded capitalize',
                        severityColors[insight.severity]
                      )}
                    >
                      {insight.severity}
                    </span>
                  </div>

                  {isExpanded ? (
                    <div className="mt-2 space-y-2">
                      <p className="text-sm text-slate-300">{insight.description}</p>
                      
                      {insight.actionable && insight.suggestedAction && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                          <ChevronRight className="w-4 h-4 text-blue-400" />
                          <span className="text-sm text-blue-400">{insight.suggestedAction}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 mt-1 truncate">{insight.description}</p>
                  )}
                </div>

                <button
                  onClick={e => {
                    e.stopPropagation();
                    dismissInsight(index);
                  }}
                  className="p-1 hover:bg-white/10 rounded transition-colors"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default AIProactiveInsights;
