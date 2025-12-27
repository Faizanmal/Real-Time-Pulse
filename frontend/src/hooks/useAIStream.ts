/**
 * =============================================================================
 * REAL-TIME PULSE - AI STREAMING HOOK
 * =============================================================================
 * 
 * React hooks for streaming AI responses with:
 * - Real-time text streaming
 * - Error handling with fallbacks
 * - Provider health monitoring
 * - Feedback submission
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface StreamState {
  isStreaming: boolean;
  content: string;
  error: string | null;
  provider: string | null;
  isComplete: boolean;
}

export interface AIInsight {
  id: string;
  type: 'ANOMALY' | 'TREND' | 'PREDICTION' | 'RECOMMENDATION' | 'SUMMARY';
  title: string;
  description: string;
  severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  recommendations?: { actions: string[] };
  qualityScore?: number;
  feedbackCount?: number;
}

export interface FeedbackPayload {
  insightId: string;
  rating: 'helpful' | 'not_helpful' | 'neutral';
  comment?: string;
  actionTaken?: string;
}

// ============================================================================
// STREAMING AI HOOK
// ============================================================================

export function useAIStream(apiUrl: string = '/api/ai-insights/stream') {
  const [state, setState] = useState<StreamState>({
    isStreaming: false,
    content: '',
    error: null,
    provider: null,
    isComplete: false,
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Start streaming AI response
   */
  const startStream = useCallback(async (prompt: string, options: {
    workspaceId?: string;
    portalId?: string;
    context?: Record<string, unknown>;
  } = {}) => {
    // Abort any existing stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();

    setState({
      isStreaming: true,
      content: '',
      error: null,
      provider: null,
      isComplete: false,
    });

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          ...options,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          setState(prev => ({ ...prev, isStreaming: false, isComplete: true }));
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'text') {
                setState(prev => ({
                  ...prev,
                  content: prev.content + data.content,
                  provider: data.provider || prev.provider,
                }));
              } else if (data.type === 'error') {
                setState(prev => ({
                  ...prev,
                  error: data.content,
                }));
              } else if (data.type === 'complete') {
                setState(prev => ({
                  ...prev,
                  isStreaming: false,
                  isComplete: true,
                }));
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        // Stream was cancelled
        setState(prev => ({ ...prev, isStreaming: false }));
      } else {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    }
  }, [apiUrl]);

  /**
   * Stop streaming
   */
  const stopStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  /**
   * Reset state
   */
  const reset = useCallback(() => {
    stopStream();
    setState({
      isStreaming: false,
      content: '',
      error: null,
      provider: null,
      isComplete: false,
    });
  }, [stopStream]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    ...state,
    startStream,
    stopStream,
    reset,
  };
}

// ============================================================================
// AI INSIGHTS HOOK
// ============================================================================

export function useAIInsights(workspaceId: string, portalId?: string) {
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  /**
   * Fetch insights from server
   */
  const fetchInsights = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ workspaceId });
      if (portalId) params.append('portalId', portalId);

      const response = await fetch(`/api/ai-insights?${params}`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch insights: ${response.status}`);
      }

      const data = await response.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch insights');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceId, portalId]);

  /**
   * Generate new insights using AI
   */
  const generateInsights = useCallback(async () => {
    if (!portalId) {
      setError('Portal ID required to generate insights');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-insights/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId, portalId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to generate insights: ${response.status}`);
      }

      const result = await response.json();
      
      // Refresh insights list
      await fetchInsights();
      
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setIsGenerating(false);
    }
  }, [workspaceId, portalId, fetchInsights]);

  /**
   * Dismiss an insight
   */
  const dismissInsight = useCallback(async (insightId: string) => {
    try {
      const response = await fetch(`/api/ai-insights/${insightId}/dismiss`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to dismiss insight');
      }

      setInsights(prev => prev.filter(i => i.id !== insightId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss insight');
    }
  }, []);

  /**
   * Action an insight
   */
  const actionInsight = useCallback(async (insightId: string) => {
    try {
      const response = await fetch(`/api/ai-insights/${insightId}/action`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to action insight');
      }

      setInsights(prev => prev.map(i => 
        i.id === insightId ? { ...i, status: 'ACTIONED' as const } : i
      ) as AIInsight[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to action insight');
    }
  }, []);

  // Fetch on mount and when params change
  useEffect(() => {
    fetchInsights();
  }, [fetchInsights]);

  return {
    insights,
    isLoading,
    error,
    isGenerating,
    fetchInsights,
    generateInsights,
    dismissInsight,
    actionInsight,
  };
}

// ============================================================================
// FEEDBACK HOOK
// ============================================================================

export function useInsightFeedback() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState<Set<string>>(new Set());

  /**
   * Submit feedback for an insight
   */
  const submitFeedback = useCallback(async (feedback: FeedbackPayload) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-insights/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      setSubmitted(prev => new Set(prev).add(feedback.insightId));
      
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit feedback');
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  /**
   * Check if feedback was already submitted for an insight
   */
  const hasFeedback = useCallback((insightId: string) => {
    return submitted.has(insightId);
  }, [submitted]);

  return {
    isSubmitting,
    error,
    submitFeedback,
    hasFeedback,
  };
}

// ============================================================================
// PROVIDER HEALTH HOOK
// ============================================================================

export function useAIProviderHealth() {
  const [providers, setProviders] = useState<{
    name: string;
    available: boolean;
    priority: number;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchHealth = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/ai-insights/providers');
      if (response.ok) {
        const data = await response.json();
        setProviders(data);
      }
    } catch {
      // Silent fail for health check
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const isHealthy = providers.some(p => p.available);
  const activeProvider = providers.find(p => p.available);

  return {
    providers,
    isLoading,
    isHealthy,
    activeProvider,
    refetch: fetchHealth,
  };
}

// ============================================================================
// NATURAL LANGUAGE QUERY HOOK
// ============================================================================

export function useNaturalLanguageQuery() {
  const [isQuerying, setIsQuerying] = useState(false);
  const [result, setResult] = useState<{
    query: string;
    response: string;
    source: string;
    timestamp: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const query = useCallback(async (
    queryText: string,
    options: { workspaceId: string; portalId?: string }
  ) => {
    setIsQuerying(true);
    setError(null);

    try {
      const response = await fetch('/api/ai-insights/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          workspaceId: options.workspaceId,
          portalId: options.portalId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Query failed: ${response.status}`);
      }

      const data = await response.json();
      setResult(data);
      
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Query failed');
      return null;
    } finally {
      setIsQuerying(false);
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return {
    isQuerying,
    result,
    error,
    query,
    reset,
  };
}
