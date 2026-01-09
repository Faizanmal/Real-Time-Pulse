'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { widgetApi, portalApi } from '@/lib/api-client';
import { WidgetCard } from '@/components/ui/feature-cards';
import type { Widget, Portal } from '@/types';
import {
  Puzzle,
  Plus,
  ArrowLeft,
  Search,
  Filter,
  LayoutGrid,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

export default function WidgetsPage() {
  return (
    <Suspense fallback={<WidgetsPageLoading />}>
      <WidgetsPageContent />
    </Suspense>
  );
}

function WidgetsPageLoading() {
  return (
    <div className="container py-8">
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <div className="h-12 bg-gray-200 rounded"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    </div>
  );
}

function WidgetsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const portalId = searchParams.get('portalId');
  const { isAuthenticated, isHydrated } = useAuthStore();

  const [widgets, setWidgets] = useState<Widget[]>([]);
  const [portals, setPortals] = useState<Portal[]>([]);
  const [selectedPortalId, setSelectedPortalId] = useState<string>(portalId || '');
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');

  const loadData = useCallback(async () => {
    try {
      const portalsData = await portalApi.getAll();
      setPortals(portalsData.portals);

      if (portalsData.portals.length > 0 && !selectedPortalId) {
        setSelectedPortalId(portalsData.portals[0].id);
      }
    } catch (error) {
      console.error('Failed to load portals:', error);
      toast.error('Failed to load portals');
    } finally {
      setIsLoading(false);
    }
  }, [selectedPortalId]);

  const loadWidgets = async (portalId: string) => {
    try {
      const widgetsData = await widgetApi.getAllByPortal(portalId);
      setWidgets(widgetsData);
    } catch (error) {
      console.error('Failed to load widgets:', error);
      toast.error('Failed to load widgets');
    }
  };

  const handleWidgetRefresh = useCallback((event: Event) => {
    const customEvent = event as CustomEvent<{ widgetId?: string }>;
    const { widgetId } = customEvent.detail || {};
    if (widgetId) {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
      // Reload widgets to get updated data
      if (selectedPortalId) {
        loadWidgets(selectedPortalId);
      }
    }
  }, [selectedPortalId]);

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadData();

    // Listen for real-time widget updates
    window.addEventListener('widget:refreshed', handleWidgetRefresh);
    return () => {
      window.removeEventListener('widget:refreshed', handleWidgetRefresh);
    };
  }, [isAuthenticated, isHydrated, router, loadData, handleWidgetRefresh]);

  const handleRefresh = async (widgetId: string) => {
    setRefreshingIds((prev) => new Set(prev).add(widgetId));
    try {
      await widgetApi.refreshData(widgetId);
      toast.success('Widget refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh widget:', error);
      toast.error('Failed to refresh widget');
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(widgetId);
        return next;
      });
    }
  };

  const handleDelete = async (widgetId: string) => {
    if (!confirm('Are you sure you want to delete this widget?')) return;

    try {
      await widgetApi.delete(widgetId);
      setWidgets(widgets.filter((w) => w.id !== widgetId));
      toast.success('Widget deleted successfully');
    } catch (error) {
      console.error('Failed to delete widget:', error);
      toast.error('Failed to delete widget');
    }
  };

  const widgetTypes = Array.from(new Set(widgets.map((w) => w.type)));

  const filteredWidgets = widgets
    .filter((widget) => {
      const matchesSearch =
        widget.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        widget.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || widget.type === filterType;
      return matchesSearch && matchesType;
    });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-300">Loading widgets...</p>
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
                  <Puzzle className="h-7 w-7 text-blue-400" />
                  Widgets
                </h1>
                <p className="text-sm text-gray-400">
                  {widgets.length} widget{widgets.length !== 1 ? 's' : ''}
                  {selectedPortalId && portals.find(p => p.id === selectedPortalId) &&
                    ` in ${portals.find(p => p.id === selectedPortalId)?.name}`}
                </p>
              </div>
            </div>

            <Link href={`/dashboard/widgets/new${selectedPortalId ? `?portalId=${selectedPortalId}` : ''}`}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                New Widget
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Portal Selector & Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row gap-4"
        >
          {/* Portal Selector */}
          <select
            value={selectedPortalId}
            onChange={(e) => setSelectedPortalId(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          >
            <option value="">Select a portal</option>
            {portals.map((portal) => (
              <option key={portal.id} value={portal.id}>
                {portal.name} ({portal.widgetCount || 0} widgets)
              </option>
            ))}
          </select>

          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search widgets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          {/* Type Filter with Icon */}
          <div className="flex gap-2">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="all">All Types</option>
              {widgetTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>

            {/* Filter Icon Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-blue-400 hover:bg-slate-700/50 transition-all"
              title="Additional filters"
            >
              <Filter className="h-5 w-5" />
            </motion.button>
          </div>
        </motion.div>

        {/* Widget Stats */}
        {widgets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 grid grid-cols-1 md:grid-cols-4 gap-4"
          >
            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/20 rounded-lg">
                  <Puzzle className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-white">{widgets.length}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/20 rounded-lg">
                  <LayoutGrid className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Types</p>
                  <p className="text-2xl font-bold text-white">{widgetTypes.length}</p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <RefreshCw className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">With Integration</p>
                  <p className="text-2xl font-bold text-white">
                    {widgets.filter((w) => w.integrationId).length}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-slate-900/30 rounded-xl border border-slate-800/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Needs Refresh</p>
                  <p className="text-2xl font-bold text-white">
                    {widgets.filter((w) => !w.lastRefreshedAt).length}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Widgets Grid */}
        {!selectedPortalId ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50"
          >
            <Puzzle className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">Select a Portal</h3>
            <p className="text-gray-400 mb-6">
              Choose a portal from the dropdown to view its widgets
            </p>
          </motion.div>
        ) : filteredWidgets.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50"
          >
            <Puzzle className="h-16 w-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {searchQuery || filterType !== 'all' ? 'No widgets found' : 'No widgets yet'}
            </h3>
            <p className="text-gray-400 mb-6">
              {searchQuery || filterType !== 'all'
                ? 'Try adjusting your filters'
                : 'Create your first widget to get started'}
            </p>
            {!searchQuery && filterType === 'all' && (
              <Link href={`/dashboard/widgets/new?portalId=${selectedPortalId}`}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="px-6 py-3 bg-linear-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl transition-all"
                >
                  <Plus className="inline-block h-5 w-5 mr-2" />
                  Create Widget
                </motion.button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredWidgets.map((widget, index) => (
              <motion.div
                key={widget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
              >
                <WidgetCard
                  {...widget}
                  onRefresh={handleRefresh}
                  onEdit={(id) => router.push(`/dashboard/widgets/${id}/edit`)}
                  onDelete={handleDelete}
                  isRefreshing={refreshingIds.has(widget.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
