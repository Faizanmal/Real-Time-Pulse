'use client';

import { motion } from 'framer-motion';
import {
  Zap,
  Plus,
  ArrowLeft,
  Search,
  RefreshCw,
  Check,
  X,
  AlertCircle,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';

import { IntegrationCard } from '@/components/ui/feature-cards';
import { integrationApi } from '@/lib/api-client';
import { useAuthStore } from '@/store/auth';
import type { Integration } from '@/types';


export default function IntegrationsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isHydrated } = useAuthStore();
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [loadError, setLoadError] = useState('');
  const [creatingDemo, setCreatingDemo] = useState(false);
  const [freshness, setFreshness] = useState<Awaited<ReturnType<typeof integrationApi.getSyncFreshness>> | null>(null);
  const [freshnessError, setFreshnessError] = useState('');

  const loadIntegrations = useCallback(async () => {
    if (!user?.workspaceId) { setIsLoading(false); return; }

    try {
      setLoadError('');
      const data = await integrationApi.getAllByWorkspace(user.workspaceId);
      setIntegrations(data);
      try {
        setFreshness(await integrationApi.getSyncFreshness(user.workspaceId));
        setFreshnessError('');
      } catch {
        setFreshnessError('Sync metrics are temporarily unavailable.');
      }
    } catch (error) {
      console.error('Failed to load integrations:', error);
      setLoadError('Could not load connectors. Check your connection and retry.');
    } finally {
      setIsLoading(false);
    }
  }, [user?.workspaceId]);

  const handleIntegrationSync = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ integrationId?: string; integration?: { id?: string } }>;
    const integrationId = customEvent.detail?.integrationId || customEvent.detail?.integration?.id;
    if (integrationId) {
      loadIntegrations();
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(integrationId);
        return next;
      });
    }
  }, [loadIntegrations]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadIntegrations();

    // Listen for real-time sync updates
    window.addEventListener('integration:synced', handleIntegrationSync);
    window.addEventListener('integration:error', handleIntegrationSync);
    return () => {
      window.removeEventListener('integration:synced', handleIntegrationSync);
      window.removeEventListener('integration:error', handleIntegrationSync);
    };
  }, [isAuthenticated, isHydrated, router, handleIntegrationSync, loadIntegrations]);

  const handleSync = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      await integrationApi.triggerSync(id, 'incremental', false, crypto.randomUUID());
      await loadIntegrations();
      toast.success('Sync started successfully');
    } catch (error) {
      console.error('Failed to sync integration:', error);
      toast.error('Failed to start sync');
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleDryRun = async (id: string) => {
    try {
      const result = await integrationApi.triggerSync(id, 'incremental', true);
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Dry run could not be completed.');
    }
  };

  const handleReplay = async (id: string) => {
    setSyncingIds((prev) => new Set(prev).add(id));
    try {
      const result = await integrationApi.triggerSync(id, 'full', false, crypto.randomUUID());
      await loadIntegrations();
      toast.success(result.message);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Replay could not be queued.');
      setSyncingIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const handleTest = async (id: string) => {
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      const result = await integrationApi.testConnection(id);
      await loadIntegrations();
      if (result.success) {
        toast.success(result.message || 'Connection successful');
      } else {
        toast.error(result.message || 'Connection failed');
      }
    } catch (error) {
      console.error('Failed to test integration:', error);
      toast.error('Failed to test connection');
    } finally {
      setTestingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const handleRefresh = async (id: string) => {
    setRefreshingIds((current) => new Set(current).add(id));
    try {
      const result = await integrationApi.refresh(id);
      setIntegrations((current) => current.map((item) => item.id === id ? result : item));
      toast.success(result.statusMessage || 'Provider authorization refreshed.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Reconnect could not be completed.');
      await loadIntegrations();
    } finally {
      setRefreshingIds((current) => { const next = new Set(current); next.delete(id); return next; });
    }
  };

  const handleCreateDemo = async () => {
    setCreatingDemo(true);
    try {
      await integrationApi.createDemo();
      await loadIntegrations();
      toast.success('Fictional demo connector is ready. No provider account was contacted.');
    } catch {
      toast.error('Could not create the local demo connector. Retry after checking the API.');
    } finally {
      setCreatingDemo(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this integration?')) return;

    try {
      await integrationApi.delete(id);
      setIntegrations(integrations.filter((i) => i.id !== id));
      toast.success('Integration deleted');
    } catch (error) {
      console.error('Failed to delete integration:', error);
      toast.error('Failed to delete integration');
    }
  };

  const filteredIntegrations = integrations.filter(
    (integration) =>
      integration.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      integration.provider.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const availableProviders = [
    { id: 'google-analytics', name: 'Google Analytics', icon: '📊' },
    { id: 'stripe', name: 'Stripe', icon: '💳' },
    { id: 'slack', name: 'Slack', icon: '💬' },
    { id: 'github', name: 'GitHub', icon: '🐙' },
    { id: 'jira', name: 'Jira', icon: '📋' },
    { id: 'salesforce', name: 'Salesforce', icon: '☁️' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-green-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-300">Loading integrations...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/30 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <motion.button
                  whileHover={{ scale: 1.05, x: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-gray-300 transition-colors"
                >
                  <ArrowLeft className="h-5 w-5" />
                </motion.button>
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                  <Zap className="h-7 w-7 text-green-400" />
                  Integrations
                </h1>
                <p className="text-sm text-gray-400">
                  {integrations.length} connected services
                </p>
              </div>
            </div>

            <Link href="/dashboard/integrations/new">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-linear-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                Add Integration
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loadError && <div role="alert" className="mb-6 rounded-xl border border-red-500/40 bg-red-500/10 p-4 text-red-200">{loadError} <button className="ml-3 underline" onClick={() => { setIsLoading(true); void loadIntegrations(); }}>Retry</button></div>}
        <section aria-labelledby="sync-freshness-heading" className="mb-8 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-5">
          <h2 id="sync-freshness-heading" className="text-lg font-semibold text-white">Sync freshness and operations</h2>
          {freshnessError ? <p role="alert" className="mt-2 text-sm text-amber-200">{freshnessError}</p> : !freshness ? <p className="mt-2 text-sm text-gray-400">Loading sync metrics…</p> : <>
            <p className="mt-2 text-sm text-gray-300">Queue depth {freshness.queue.queueDepth} · active {freshness.queue.active} · failed {freshness.queue.failed} · attempts {freshness.queue.retries}</p>
            <p className="mt-1 text-xs text-gray-500">Metrics updated {new Date(freshness.queue.asOf).toLocaleString()} · oldest queued {freshness.queue.oldestQueuedAt ? new Date(freshness.queue.oldestQueuedAt).toLocaleString() : 'none'}{freshness.queue.oldestQueuedAgeMs !== null ? ` (${Math.floor(freshness.queue.oldestQueuedAgeMs / 60000)} min old)` : ''}</p>
            {freshness.integrations.length === 0 ? <p className="mt-3 text-sm text-gray-400">No connected feeds to monitor.</p> : <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{freshness.integrations.map((item) => <li key={item.id} className="rounded-lg bg-slate-800/60 p-3 text-sm"><span className="font-medium text-white">{item.provider}</span><span className="ml-2 text-gray-300">{item.health}</span><p className="mt-1 text-xs text-gray-400">Last updated: {item.lastUpdatedAt ? new Date(item.lastUpdatedAt).toLocaleString() : 'Never'}{item.lastErrorCode ? ` · Error: ${item.lastErrorCode}` : ''}</p>{item.latestRun && <p className="mt-1 text-xs text-gray-400">Latest run: {item.latestRun.status} · {item.latestRun.processedCount} records / {item.latestRun.pageCount} pages{item.latestRun.lastErrorCode ? ` · ${item.latestRun.lastErrorCode}` : ''}</p>}</li>)}</ul>}
          </>}
        </section>
        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search integrations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
            />
          </div>
        </motion.div>

        {/* Available Providers (if no integrations) */}
        {integrations.length === 0 && !searchQuery && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <h2 className="text-xl font-bold text-white mb-4">
              Available Integrations
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {availableProviders.map((provider) => (
                <motion.div
                  key={provider.id}
                  whileHover={{ scale: 1.05, y: -5 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/50 text-center"
                >
                  <div className="text-4xl mb-2">{provider.icon}</div>
                  <p className="text-sm font-medium text-white">{provider.name}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Integrations Grid */}
        {filteredIntegrations.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50"
          >
            <Zap className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery ? 'No integrations found' : 'No integrations yet'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery
                ? 'Try adjusting your search'
                : 'Connect your first integration to get started'}
            </p>
            {!searchQuery && (
              <div className="flex justify-center gap-3">
                <button disabled={creatingDemo} onClick={() => void handleCreateDemo()} className="rounded-xl border border-emerald-500/40 px-6 py-3 font-semibold text-emerald-200 disabled:opacity-50">{creatingDemo ? 'Creating demo…' : 'Create fictional demo connector'}</button>
                <Link href="/dashboard/integrations/new" className="rounded-xl bg-linear-to-r from-green-600 to-emerald-600 px-6 py-3 font-semibold text-white"><Plus className="inline-block h-5 w-5 mr-2" />Add Integration</Link>
              </div>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredIntegrations.map((integration, index) => (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div>
                <IntegrationCard
                  {...integration}
                  onTest={handleTest}
                  onSync={handleSync}
                  onEdit={(id) => router.push(`/dashboard/integrations/${id}/edit`)}
                  onDelete={handleDelete}
                  onRefresh={handleRefresh}
                  isRefreshing={refreshingIds.has(integration.id)}
                  isSyncing={syncingIds.has(integration.id)}
                />
                <div className="mt-2 flex gap-2"><button onClick={() => void handleDryRun(integration.id)} className="rounded border border-slate-600 px-3 py-1 text-xs text-gray-200">Dry run</button><button onClick={() => void handleReplay(integration.id)} disabled={syncingIds.has(integration.id)} className="rounded border border-amber-500/50 px-3 py-1 text-xs text-amber-200 disabled:opacity-50">Replay full sync</button></div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Stats */}
        {integrations.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4"
          >
            <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <Check className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Active</p>
                  <p className="text-2xl font-bold text-white">
                    {integrations.filter((i) => i.connectionState === 'CONNECTED').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-500/20 rounded-lg">
                  <AlertCircle className="h-6 w-6 text-gray-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Inactive</p>
                  <p className="text-2xl font-bold text-white">
                    {integrations.filter((i) => i.connectionState === 'DISCONNECTED').length}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-500/20 rounded-lg">
                  <X className="h-6 w-6 text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Errors</p>
                  <p className="text-2xl font-bold text-white">
                    {integrations.filter((i) => i.connectionState === 'DEGRADED' || i.connectionState === 'NEEDS_RECONNECT').length}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Sync/Test Status Indicator */}
        {(syncingIds.size > 0 || testingIds.size > 0) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
          >
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-blue-400 animate-spin" />
              <div>
                <p className="text-sm font-medium text-blue-400">
                  {syncingIds.size > 0 && `Syncing ${syncingIds.size} integration${syncingIds.size > 1 ? 's' : ''}...`}
                  {syncingIds.size > 0 && testingIds.size > 0 && ' | '}
                  {testingIds.size > 0 && `Testing ${testingIds.size} connection${testingIds.size > 1 ? 's' : ''}...`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  );
}
