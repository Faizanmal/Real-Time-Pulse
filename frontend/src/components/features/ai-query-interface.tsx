'use client';

import { useState, useEffect } from 'react';
import { advancedAiApi } from '@/lib/advanced-api';
import type { AIQuery } from '@/types/advanced-features';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send, Sparkles, Database, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function AIQueryInterface() {
  const [query, setQuery] = useState('');
  const [queries, setQueries] = useState<AIQuery[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);

  useEffect(() => {
    loadQueryHistory();
  }, []);

  const loadQueryHistory = async () => {
    try {
      const response = await advancedAiApi.getQueries();
      setQueries(response.data);
    } catch (error: any) {
      console.error('Failed to load query history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    try {
      setLoading(true);
      const response = await advancedAiApi.processQuery(query);
      setQueries([response.data, ...queries]);
      setQuery('');
      toast.success('Query processed successfully');
    } catch (error: any) {
      toast.error('Failed to process query', {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateSQL = async () => {
    if (!query.trim()) return;

    try {
      setLoading(true);
      const response = await advancedAiApi.generateSQL(query);
      setQueries([response.data, ...queries]);
      setQuery('');
      toast.success('SQL generated successfully');
    } catch (error: any) {
      toast.error('Failed to generate SQL', {
        description: error.response?.data?.message || error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Query Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            AI Query Assistant
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Ask anything about your data... (e.g., 'Show me top performing portals')"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
                className="flex-1"
              />
              <Button type="submit" disabled={loading || !query.trim()}>
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={handleGenerateSQL}
                disabled={loading || !query.trim()}
                className="flex items-center gap-2"
              >
                <Database className="h-4 w-4" />
                Generate SQL
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Query History */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Query History</h3>
        {loadingHistory ? (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="pt-6">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : queries.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No queries yet. Try asking something!</p>
            </CardContent>
          </Card>
        ) : (
          queries.map((q) => (
            <Card key={q.id}>
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium">{q.query}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {new Date(q.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <Badge>{q.queryType.replace(/_/g, ' ')}</Badge>
                </div>

                {q.response && (
                  <div className="bg-muted p-4 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(q.response, null, 2)}
                    </pre>
                  </div>
                )}

                {q.sqlGenerated && (
                  <div className="bg-slate-900 text-slate-50 p-4 rounded-lg">
                    <code className="text-sm">{q.sqlGenerated}</code>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
