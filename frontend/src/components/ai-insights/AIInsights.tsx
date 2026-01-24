'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, AlertTriangle, CheckCircle, Sparkles, RefreshCw } from 'lucide-react';

interface Insight {
  id: string;
  type: string;
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  impact: string;
  recommendation: string;
  createdAt: string;
  status: 'new' | 'acknowledged' | 'resolved';
}

export default function AIInsights() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/ai-insights?filter=${filter}`);
      const data = await response.json();
      setInsights(data);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  const generateInsights = async () => {
    try {
      await fetch('/api/ai-insights/generate', { method: 'POST' });
      fetchInsights();
    } catch (error) {
      console.error('Failed to generate insights:', error);
    }
  };

  const acknowledgeInsight = async (id: string) => {
    try {
      await fetch(`/api/ai-insights/${id}/acknowledge`, { method: 'POST' });
      fetchInsights();
    } catch (error) {
      console.error('Failed to acknowledge insight:', error);
    }
  };

  const resolveInsight = async (id: string) => {
    try {
      await fetch(`/api/ai-insights/${id}/resolve`, { method: 'POST' });
      fetchInsights();
    } catch (error) {
      console.error('Failed to resolve insight:', error);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-600 bg-red-50 dark:bg-red-950';
      case 'high': return 'text-orange-600 bg-orange-50 dark:bg-orange-950';
      case 'medium': return 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950';
      default: return 'text-blue-600 bg-blue-50 dark:bg-blue-950';
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'critical' || severity === 'high') {
      return <AlertTriangle className="h-5 w-5" />;
    }
    return <Lightbulb className="h-5 w-5" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Sparkles className="h-8 w-8" />
            AI Insights
          </h1>
          <p className="text-muted-foreground">Intelligent recommendations and anomaly detection</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchInsights}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={generateInsights}>
            <Sparkles className="h-4 w-4 mr-2" />
            Generate New Insights
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        {['all', 'new', 'acknowledged', 'resolved'].map((f) => (
          <Button
            key={f}
            variant={filter === f ? 'default' : 'outline'}
            size="sm"
            onClick={() => setFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Total Insights</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{insights.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">New</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {insights.filter(i => i.status === 'new').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Critical</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {insights.filter(i => i.severity === 'critical').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Avg Confidence</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {insights.length > 0 
                ? (insights.reduce((acc, i) => acc + i.confidence, 0) / insights.length * 100).toFixed(0)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {insights.map((insight) => (
          <Card key={insight.id} className={`${getSeverityColor(insight.severity)} border-l-4`}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-start gap-3 flex-1">
                  {getSeverityIcon(insight.severity)}
                  <div className="flex-1">
                    <CardTitle className="text-lg">{insight.title}</CardTitle>
                    <CardDescription className="mt-1">{insight.description}</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Badge variant="outline" className="ml-2">
                    {(insight.confidence * 100).toFixed(0)}% confidence
                  </Badge>
                  <Badge variant={insight.status === 'new' ? 'default' : 'secondary'}>
                    {insight.status}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <div className="text-sm font-semibold mb-1">Impact</div>
                    <div className="text-sm text-muted-foreground">{insight.impact}</div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-1">Recommendation</div>
                    <div className="text-sm text-muted-foreground">{insight.recommendation}</div>
                  </div>
                </div>
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="text-xs text-muted-foreground">
                    {new Date(insight.createdAt).toLocaleString()}
                  </div>
                  <div className="flex gap-2">
                    {insight.status === 'new' && (
                      <Button size="sm" variant="outline" onClick={() => acknowledgeInsight(insight.id)}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Acknowledge
                      </Button>
                    )}
                    {insight.status !== 'resolved' && (
                      <Button size="sm" onClick={() => resolveInsight(insight.id)}>
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Resolve
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {insights.length === 0 && !loading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Lightbulb className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No insights found. Generate new insights to get started.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
