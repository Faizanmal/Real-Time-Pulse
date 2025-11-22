'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, X, Check } from 'lucide-react';
import { aiInsightsApi, AIInsight } from '@/src/lib/enterprise-api';
import { Button } from '@/src/components/ui/button';
import { Card } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { toast } from 'sonner';
import { cn } from '@/src/lib/utils';

interface AIInsightsPanelProps {
  portalId: string;
  className?: string;
}

export function AIInsightsPanel({ portalId, className }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const loadInsights = useCallback(async () => {
    try {
      const data = await aiInsightsApi.getPortalInsights(portalId);
      setInsights(data);
    } catch {
      console.error('Failed to load insights');
    } finally {
      setLoading(false);
    }
  }, [portalId]);

  useEffect(() => {
    loadInsights();
  }, [loadInsights]);

  const generateInsights = async () => {
    setGenerating(true);
    try {
      const result = await aiInsightsApi.generateInsights(portalId);
      toast.success(`Generated ${result.generated} new insights`);
      await loadInsights();
    } catch {
      toast.error('Failed to generate insights');
    } finally {
      setGenerating(false);
    }
  };

  const dismissInsight = async (insightId: string) => {
    try {
      await aiInsightsApi.dismissInsight(insightId);
      setInsights(insights.filter(i => i.id !== insightId));
      toast.success('Insight dismissed');
    } catch {
      toast.error('Failed to dismiss insight');
    }
  };

  const actionInsight = async (insightId: string) => {
    try {
      await aiInsightsApi.actionInsight(insightId);
      setInsights(insights.map(i => 
        i.id === insightId ? { ...i, status: 'ACTIONED' as const } : i
      ));
      toast.success('Marked as actioned');
    } catch {
      toast.error('Failed to update insight');
    }
  };

  if (loading) {
    return (
      <Card className={cn('p-6', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-500" />
          <h3 className="text-lg font-semibold">AI Insights</h3>
          {insights.length > 0 && (
            <Badge variant="secondary">{insights.length}</Badge>
          )}
        </div>
        <Button
          onClick={generateInsights}
          disabled={generating}
          size="sm"
          variant="outline"
        >
          {generating ? 'Generating...' : 'Generate Insights'}
        </Button>
      </div>

      {insights.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Sparkles className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No insights yet. Click &quot;Generate Insights&quot; to analyze your data.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onDismiss={dismissInsight}
              onAction={actionInsight}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

interface InsightCardProps {
  insight: AIInsight;
  onDismiss: (id: string) => void;
  onAction: (id: string) => void;
}

function InsightCard({ insight, onDismiss, onAction }: InsightCardProps) {
  const getIcon = () => {
    switch (insight.type) {
      case 'ANOMALY':
        return <AlertTriangle className="h-5 w-5" />;
      case 'TREND':
        return <TrendingUp className="h-5 w-5" />;
      case 'RECOMMENDATION':
        return <Lightbulb className="h-5 w-5" />;
      default:
        return <Sparkles className="h-5 w-5" />;
    }
  };

  const getSeverityColor = () => {
    switch (insight.severity) {
      case 'CRITICAL':
        return 'border-red-500 bg-red-50';
      case 'HIGH':
        return 'border-orange-500 bg-orange-50';
      case 'MEDIUM':
        return 'border-yellow-500 bg-yellow-50';
      case 'LOW':
        return 'border-blue-500 bg-blue-50';
      default:
        return 'border-gray-500 bg-gray-50';
    }
  };

  const getIconColor = () => {
    switch (insight.severity) {
      case 'CRITICAL':
        return 'text-red-600';
      case 'HIGH':
        return 'text-orange-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-blue-600';
      default:
        return 'text-gray-600';
    }
  };

  return (
    <div className={cn('border-l-4 rounded-lg p-4 relative', getSeverityColor())}>
      <div className="flex items-start gap-3">
        <div className={cn('mt-0.5', getIconColor())}>
          {getIcon()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-gray-900">{insight.title}</h4>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-xs">
                  {insight.type}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {insight.severity}
                </Badge>
                <span className="text-xs text-gray-500">
                  {Math.round(insight.confidence * 100)}% confidence
                </span>
              </div>
            </div>
            <button
              onClick={() => onDismiss(insight.id)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <p className="text-sm text-gray-700 mb-3">{insight.description}</p>

          {insight.recommendations && insight.recommendations.actions.length > 0 && (
            <div className="space-y-2 mb-3">
              <p className="text-xs font-semibold text-gray-700">Recommended Actions:</p>
              <ul className="space-y-1">
                {insight.recommendations.actions.map((action, index) => (
                  <li key={index} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-gray-400">•</span>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {insight.status === 'NEW' && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onAction(insight.id)}
                className="text-xs h-7"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark as Actioned
              </Button>
            </div>
          )}

          {insight.status === 'ACTIONED' && (
            <Badge variant="secondary" className="text-xs">
              ✓ Actioned
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
