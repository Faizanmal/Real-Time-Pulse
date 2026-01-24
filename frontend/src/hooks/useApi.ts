import { useState, useEffect, useCallback } from 'react';

interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface ApiOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
}

export function useApi<T = unknown>(
  url: string | null,
  options?: ApiOptions
): ApiState<T> & { refetch: () => Promise<void> } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
        body: options?.body ? JSON.stringify(options.body) : undefined,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [url, options?.method, options?.body, options?.headers]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

export function useApiMutation<R = unknown>() {
  const [data, setData] = useState<R | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutate = useCallback(
    async (url: string, options?: ApiOptions): Promise<R | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          method: options?.method || 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...options?.headers,
          },
          body: options?.body ? JSON.stringify(options.body) : undefined,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
        return result;
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { data, loading, error, mutate };
}

// Advanced AI hooks
export const useAIModels = () => useApi('/api/advanced-ai/models');
export const useAIModelById = (id: string | null) => useApi(id ? `/api/advanced-ai/models/${id}` : null);
export const useTrainModel = () => useApiMutation();
export const usePredictModel = () => useApiMutation();

// AI Insights hooks
export const useAIInsights = () => useApi('/api/ai-insights');
export const useAcknowledgeInsight = () => useApiMutation();

// Alerts hooks
export const useAlerts = () => useApi('/api/alerts');
export const useCreateAlert = () => useApiMutation();
export const useUpdateAlert = () => useApiMutation();
export const useDeleteAlert = () => useApiMutation();
export const useTestAlert = () => useApiMutation();

// Annotations hooks
export const useAnnotations = () => useApi('/api/annotations');
export const useCreateAnnotation = () => useApiMutation();
export const useDeleteAnnotation = () => useApiMutation();

// API Keys hooks
export const useAPIKeys = () => useApi('/api/api-keys');
export const useCreateAPIKey = () => useApiMutation();
export const useUpdateAPIKey = () => useApiMutation();
export const useDeleteAPIKey = () => useApiMutation();

// Audit hooks
export const useAuditLogs = () => useApi('/api/audit');

// Billing hooks
export const useBilling = () => useApi('/api/billing');
export const useSubscription = () => useApi('/api/billing/subscription');
export const useInvoices = () => useApi('/api/billing/invoices');
export const useUpdateSubscription = () => useApiMutation();
export const useDownloadInvoice = () => useApiMutation();

// Blockchain hooks
export const useBlockchainRecords = () => useApi('/api/blockchain');
export const useCreateBlockchainRecord = () => useApiMutation();
export const useVerifyBlockchain = () => useApiMutation();

// Client Reports hooks
export const useClientReports = () => useApi('/api/client-reports');
export const useCreateClientReport = () => useApiMutation();
export const useDeleteClientReport = () => useApiMutation();
export const useSendClientReport = () => useApiMutation();

// Comments hooks
export const useComments = () => useApi('/api/comments');
export const useCreateComment = () => useApiMutation();
export const useReplyComment = () => useApiMutation();
export const useLikeComment = () => useApiMutation();
export const useDeleteComment = () => useApiMutation();

// Federated Search hooks
export const useFederatedSearch = (query: string | null) => 
  useApi(query ? `/api/federated-search?q=${encodeURIComponent(query)}` : null);

// Jobs hooks
export const useJobs = () => useApi('/api/jobs');
export const useCreateJob = () => useApiMutation();
export const useUpdateJob = () => useApiMutation();
export const useDeleteJob = () => useApiMutation();
export const useRunJob = () => useApiMutation();

// Portals hooks
export const usePortals = () => useApi('/api/portals');
export const usePortalById = (id: string | null) => useApi(id ? `/api/portals/${id}` : null);
export const useCreatePortal = () => useApiMutation();
export const useUpdatePortal = () => useApiMutation();
export const useDeletePortal = () => useApiMutation();

// Pipeline hooks
export const usePipelines = () => useApi('/api/pipeline');
export const usePipelineById = (id: string | null) => useApi(id ? `/api/pipeline/${id}` : null);
export const useStartPipeline = () => useApiMutation();
export const useStopPipeline = () => useApiMutation();

// Scripting hooks
export const useScripts = () => useApi('/api/scripting');
export const useExecuteScript = () => useApiMutation();
export const useSaveScript = () => useApiMutation();
export const useDeleteScript = () => useApiMutation();

// Share Links hooks
export const useShareLinks = () => useApi('/api/share-links');
export const useCreateShareLink = () => useApiMutation();
export const useDeleteShareLink = () => useApiMutation();
export const useRevokeShareLink = () => useApiMutation();

// Templates hooks
export const useTemplates = () => useApi('/api/templates');
export const useCreateTemplate = () => useApiMutation();
export const useUpdateTemplate = () => useApiMutation();
export const useDeleteTemplate = () => useApiMutation();
export const useApplyTemplate = () => useApiMutation();

// Webhooks hooks
export const useWebhooks = () => useApi('/api/webhooks');
export const useCreateWebhook = () => useApiMutation();
export const useUpdateWebhook = () => useApiMutation();
export const useDeleteWebhook = () => useApiMutation();
export const useTestWebhook = () => useApiMutation();

// Widgets hooks
export const useWidgets = () => useApi('/api/widgets');
export const useCreateWidget = () => useApiMutation();
export const useUpdateWidget = () => useApiMutation();
export const useDeleteWidget = () => useApiMutation();
export const useUpdateWidgetPosition = () => useApiMutation();

// Workflow hooks
export const useWorkflows = () => useApi('/api/workflow-automation');
export const useWorkflowById = (id: string | null) => useApi(id ? `/api/workflow-automation/${id}` : null);
export const useCreateWorkflow = () => useApiMutation();
export const useUpdateWorkflow = () => useApiMutation();
export const useDeleteWorkflow = () => useApiMutation();
export const useExecuteWorkflow = () => useApiMutation();

// Workspaces hooks
export const useWorkspaces = () => useApi('/api/workspaces');
export const useWorkspaceById = (id: string | null) => useApi(id ? `/api/workspaces/${id}` : null);
export const useCreateWorkspace = () => useApiMutation();
export const useUpdateWorkspace = () => useApiMutation();
export const useDeleteWorkspace = () => useApiMutation();
export const useSwitchWorkspace = () => useApiMutation();
export const useInviteMember = () => useApiMutation();
export const useRemoveMember = () => useApiMutation();
