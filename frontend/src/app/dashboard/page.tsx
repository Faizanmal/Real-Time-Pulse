'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/src/store/auth';
import { portalApi, workspaceApi, integrationApi } from '@/src/lib/api-client';
import { useNotifications } from '@/src/hooks/useNotifications';
import { StatsCard, PortalCard } from '@/src/components/ui/feature-cards';
import type { Portal, Workspace, WorkspaceStats } from '@/src/types';
import {
  LayoutDashboard,
  Plus,
  Settings,
  LogOut,
  Bell,
  Users,
  Puzzle,
  Zap,
  Activity,
  TrendingUp,
  Search,
  Filter,
} from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearAuth } = useAuthStore();
  const { notifications, isConnected, unreadCount } = useNotifications();
  
  const [portals, setPortals] = useState<Portal[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [integrationCount, setIntegrationCount] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadData();

    // Listen for real-time updates
    window.addEventListener('portal:updated', handlePortalUpdate);
    return () => {
      window.removeEventListener('portal:updated', handlePortalUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, router]);

  const loadData = async () => {
    try {
      const [portalsData, workspaceData, integrationsData] = await Promise.all([
        portalApi.getAll(),
        workspaceApi.getMyWorkspace(),
        user?.workspaceId ? integrationApi.getAllByWorkspace(user.workspaceId).catch(() => []) : Promise.resolve([]),
      ]);
      
      setPortals(portalsData.portals);
      setWorkspace(workspaceData);
      setIntegrationCount(Array.isArray(integrationsData) ? integrationsData.length : 0);

      // Load stats if available
      if (user?.workspaceId) {
        try {
          const statsData = await workspaceApi.getStats(user.workspaceId);
          setStats(statsData);
        } catch (err) {
          console.log('Stats not available:', err);
        }
      }
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePortalUpdate = () => {
    loadData();
  };

  const handleLogout = () => {
    clearAuth();
    router.push('/auth/login');
  };

  const handleDeletePortal = async (portalId: string) => {
    if (!confirm('Are you sure you want to delete this portal?')) return;

    try {
      await portalApi.delete(portalId);
      setPortals(portals.filter((p) => p.id !== portalId));
    } catch (error) {
      console.error('Failed to delete portal:', error);
      alert('Failed to delete portal');
    }
  };

  const filteredPortals = portals.filter((portal) =>
    portal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    portal.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-300">Loading your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950 to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-slate-900/30 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl"
              >
                <LayoutDashboard className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {workspace?.name || 'Dashboard'}
                </h1>
                <p className="text-sm text-gray-400">
                  {user?.firstName} {user?.lastName} • {user?.role}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* WebSocket Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700/50">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
                <span className="text-xs text-gray-400">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* Notifications */}
              <Link href="/dashboard/notifications">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-gray-300 transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </motion.button>
              </Link>

              {/* Settings */}
              <Link href="/dashboard/settings">
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-gray-300 transition-colors"
                >
                  <Settings className="h-5 w-5" />
                </motion.button>
              </Link>

              {/* Logout */}
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleLogout}
                className="px-4 py-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 font-medium transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
          >
            <StatsCard
              title="Total Portals"
              value={stats.totalPortals}
              description={`${stats.activePortals} active`}
              icon={<LayoutDashboard className="h-6 w-6" />}
              color="blue"
              trend={stats.totalPortals > 0 ? { value: 12, isPositive: true } : undefined}
            />
            <StatsCard
              title="Total Widgets"
              value={stats.totalWidgets}
              description="Across all portals"
              icon={<Puzzle className="h-6 w-6" />}
              color="purple"
            />
            <StatsCard
              title="Integrations"
              value={stats.totalIntegrations || integrationCount}
              description={`${integrationCount} active connection${integrationCount !== 1 ? 's' : ''}`}
              icon={<Zap className="h-6 w-6" />}
              color="green"
            />
            <StatsCard
              title="Team Members"
              value={stats.totalMembers}
              description="Workspace users"
              icon={<Users className="h-6 w-6" />}
              color="orange"
            />
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
        >
          <Link href="/dashboard/portals/new">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 backdrop-blur-sm hover:border-blue-500/50 transition-all cursor-pointer"
            >
              <Plus className="h-6 w-6 text-blue-400 mb-2" />
              <h3 className="font-semibold text-white">New Portal</h3>
              <p className="text-xs text-gray-400 mt-1">Create portal</p>
            </motion.div>
          </Link>

          <Link href="/dashboard/portals">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 backdrop-blur-sm hover:border-purple-500/50 transition-all cursor-pointer"
            >
              <LayoutDashboard className="h-6 w-6 text-purple-400 mb-2" />
              <h3 className="font-semibold text-white">Portals</h3>
              <p className="text-xs text-gray-400 mt-1">Manage all</p>
            </motion.div>
          </Link>

          <Link href="/dashboard/integrations">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 backdrop-blur-sm hover:border-green-500/50 transition-all cursor-pointer"
            >
              <Zap className="h-6 w-6 text-green-400 mb-2" />
              <h3 className="font-semibold text-white">Integrations</h3>
              <p className="text-xs text-gray-400 mt-1">Connect services</p>
            </motion.div>
          </Link>

          <Link href="/dashboard/settings">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 backdrop-blur-sm hover:border-orange-500/50 transition-all cursor-pointer"
            >
              <Settings className="h-6 w-6 text-orange-400 mb-2" />
              <h3 className="font-semibold text-white">Settings</h3>
              <p className="text-xs text-gray-400 mt-1">Workspace config</p>
            </motion.div>
          </Link>
        </motion.div>

        {/* Recent Notifications Preview */}
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-8 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-400" />
                Recent Notifications
              </h3>
              <Link href="/dashboard/notifications" className="text-sm text-blue-400 hover:text-blue-300">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="text-sm text-gray-300 flex items-start gap-2">
                  <span className="text-blue-400">•</span>
                  <span>{notification.title}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Portals Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-3xl font-bold text-white flex items-center gap-2">
              <Activity className="h-8 w-8 text-purple-400" />
              Your Portals
            </h2>

            {/* Search and Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search portals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="p-2 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-gray-300 transition-colors"
                title="Filter options (coming soon)"
              >
                <Filter className="h-5 w-5" />
              </motion.button>
            </div>
          </div>

          {filteredPortals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-slate-900/30 rounded-2xl border border-slate-800/50"
            >
              <LayoutDashboard className="h-16 w-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">
                {searchQuery ? 'No portals found' : 'No portals yet'}
              </h3>
              <p className="text-gray-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Create your first portal to get started'}
              </p>
              {!searchQuery && (
                <Link href="/dashboard/portals/new">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all"
                  >
                    <Plus className="inline-block h-5 w-5 mr-2" />
                    Create Portal
                  </motion.button>
                </Link>
              )}
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredPortals.map((portal, index) => (
                <motion.div
                  key={portal.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.05 }}
                >
                  <PortalCard
                    {...portal}
                    onView={(id) => router.push(`/dashboard/portals/${id}`)}
                    onEdit={(id) => router.push(`/dashboard/portals/${id}/edit`)}
                    onDelete={handleDeletePortal}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Recent Activity */}
        {stats && stats.recentActivity > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-8 p-6 bg-slate-900/30 rounded-2xl border border-slate-800/50"
          >
            <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-400" />
              Recent Activity
            </h3>
            <p className="text-gray-400">
              {stats.recentActivity} actions in the last 24 hours
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
