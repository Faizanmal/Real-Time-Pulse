'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { portalApi, workspaceApi, integrationApi } from '@/lib/api-client';
import { useNotifications } from '@/hooks/useNotifications';
import { toast } from 'sonner';
import { StatsCard, PortalCard } from '@/components/ui/feature-cards';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import type { Portal, Workspace, WorkspaceStats } from '@/types';
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
  Sparkles,
  Building2,
  Shield,
  Plug,
  Box,
  GitBranch,
  ArrowRight,
  Moon,
  Sun,
  X,
} from 'lucide-react';

interface PortalFilters {
  showPublic: boolean;
  showPrivate: boolean;
  sortBy: 'name' | 'created' | 'updated' | 'accessed';
  sortOrder: 'asc' | 'desc';
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated, clearAuth, isHydrated } = useAuthStore();
  const { notifications, isConnected, unreadCount } = useNotifications();
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const [portals, setPortals] = useState<Portal[]>([]);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [stats, setStats] = useState<WorkspaceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [integrationCount, setIntegrationCount] = useState(0);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<PortalFilters>({
    showPublic: true,
    showPrivate: true,
    sortBy: 'updated',
    sortOrder: 'desc',
  });

  // Handle mounting for theme
  useEffect(() => {
    setMounted(true);
  }, []);

  const loadData = useCallback(async () => {
    try {
      const [portalsData, workspaceData, integrationsData] = await Promise.all([
        portalApi.getAll(),
        workspaceApi.getMyWorkspace(),
        user?.workspaceId ? integrationApi.getAllByWorkspace(user.workspaceId).catch(() => []) : Promise.resolve([]),
      ]);

      setPortals(portalsData?.portals || []);
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
  }, [user?.workspaceId]);

  const handlePortalUpdate = useCallback(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!isHydrated) return;

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
  }, [isAuthenticated, isHydrated, router, handlePortalUpdate, loadData]);

  const handleLogout = () => {
    clearAuth();
    router.push('/auth/login');
  };

  const handleDeletePortal = async (portalId: string) => {
    if (!confirm('Are you sure you want to delete this portal?')) return;

    try {
      await portalApi.delete(portalId);
      setPortals(portals.filter((p) => p.id !== portalId));
      toast.success('Portal deleted successfully');
    } catch (error) {
      console.error('Failed to delete portal:', error);
      toast.error('Failed to delete portal');
    }
  };

  const filteredPortals = useMemo(() => {
    let result = (portals || []).filter((portal) => {
      // Text search
      const matchesSearch = portal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        portal.description?.toLowerCase().includes(searchQuery.toLowerCase());
      
      // Visibility filter
      const matchesVisibility = (filters.showPublic && portal.isPublic) || 
        (filters.showPrivate && !portal.isPublic);
      
      return matchesSearch && matchesVisibility;
    });

    // Sorting
    result = result.sort((a, b) => {
      let comparison = 0;
      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updated':
          comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
        case 'accessed':
          const aAccess = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
          const bAccess = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
          comparison = aAccess - bAccess;
          break;
      }
      return filters.sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [portals, searchQuery, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!filters.showPublic || !filters.showPrivate) count++;
    if (filters.sortBy !== 'updated' || filters.sortOrder !== 'desc') count++;
    return count;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      showPublic: true,
      showPrivate: true,
      sortBy: 'updated',
      sortOrder: 'desc',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-100 via-purple-50 to-slate-100 dark:from-slate-950 dark:via-purple-950 dark:to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-600 dark:text-gray-300">Loading your dashboard...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-slate-100 via-purple-50 to-slate-100 dark:from-slate-950 dark:via-purple-950 dark:to-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-white/70 dark:bg-slate-900/30 border-b border-slate-200 dark:border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="p-2 bg-linear-to-br from-purple-500 to-pink-500 rounded-xl"
              >
                <LayoutDashboard className="h-6 w-6 text-white" />
              </motion.div>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                  {workspace?.name || 'Dashboard'}
                </h1>
                <p className="text-sm text-slate-600 dark:text-gray-400">
                  {user?.firstName} {user?.lastName} • {user?.role}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* WebSocket Status */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
                <span className="text-xs text-slate-600 dark:text-gray-400">
                  {isConnected ? 'Live' : 'Offline'}
                </span>
              </div>

              {/* Notifications */}
              <Link href="/dashboard/notifications">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-gray-300 transition-colors"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </motion.button>
              </Link>

              {/* Theme Toggle */}
              {mounted && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-gray-300 transition-colors"
                  title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
                >
                  {resolvedTheme === 'dark' ? (
                    <Sun className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-slate-600" />
                  )}
                </motion.button>
              )}

              {/* Settings */}
              <Link href="/dashboard/settings">
                <motion.button
                  whileHover={{ scale: 1.05, rotate: 90 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-gray-300 transition-colors"
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
              className="p-4 rounded-xl bg-linear-to-br from-blue-100 to-blue-200 dark:from-blue-500/20 dark:to-blue-600/20 border border-blue-300 dark:border-blue-500/30 backdrop-blur-sm hover:border-blue-400 dark:hover:border-blue-500/50 transition-all cursor-pointer"
            >
              <Plus className="h-6 w-6 text-blue-600 dark:text-blue-400 mb-2" />
              <h3 className="font-semibold text-slate-900 dark:text-white">New Portal</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Create portal</p>
            </motion.div>
          </Link>

          <Link href="/dashboard/portals">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-linear-to-br from-purple-100 to-purple-200 dark:from-purple-500/20 dark:to-purple-600/20 border border-purple-300 dark:border-purple-500/30 backdrop-blur-sm hover:border-purple-400 dark:hover:border-purple-500/50 transition-all cursor-pointer"
            >
              <LayoutDashboard className="h-6 w-6 text-purple-600 dark:text-purple-400 mb-2" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Portals</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Manage all</p>
            </motion.div>
          </Link>

          <Link href="/dashboard/integrations">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-linear-to-br from-green-100 to-green-200 dark:from-green-500/20 dark:to-green-600/20 border border-green-300 dark:border-green-500/30 backdrop-blur-sm hover:border-green-400 dark:hover:border-green-500/50 transition-all cursor-pointer"
            >
              <Zap className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Integrations</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Connect services</p>
            </motion.div>
          </Link>

          <Link href="/dashboard/settings">
            <motion.div
              whileHover={{ scale: 1.05, y: -5 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 rounded-xl bg-linear-to-br from-orange-100 to-orange-200 dark:from-orange-500/20 dark:to-orange-600/20 border border-orange-300 dark:border-orange-500/30 backdrop-blur-sm hover:border-orange-400 dark:hover:border-orange-500/50 transition-all cursor-pointer"
            >
              <Settings className="h-6 w-6 text-orange-600 dark:text-orange-400 mb-2" />
              <h3 className="font-semibold text-slate-900 dark:text-white">Settings</h3>
              <p className="text-xs text-slate-600 dark:text-gray-400 mt-1">Workspace config</p>
            </motion.div>
          </Link>
        </motion.div>

        {/* Advanced Features Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-7 w-7 text-yellow-400" />
              Enterprise Features
            </h2>
            <Link href="/enterprise/advanced-features">
              <Button variant="outline" className="gap-2">
                View All
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Link href="/enterprise/advanced-features?tab=industry">
              <Card className="hover:shadow-xl transition-all cursor-pointer border-2 hover:border-purple-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-500/20 rounded-lg">
                      <Building2 className="h-6 w-6 text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Industry Solutions</CardTitle>
                      <CardDescription>Pre-built templates</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Healthcare, Finance, Retail dashboards with compliance built-in
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/enterprise/advanced-features?tab=ai">
              <Card className="hover:shadow-xl transition-all cursor-pointer border-2 hover:border-blue-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/20 rounded-lg">
                      <Sparkles className="h-6 w-6 text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">AI Assistant</CardTitle>
                      <CardDescription>Natural language queries</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Ask questions, get predictions, detect anomalies with ML
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/enterprise/advanced-features?tab=workflows">
              <Card className="hover:shadow-xl transition-all cursor-pointer border-2 hover:border-green-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-500/20 rounded-lg">
                      <GitBranch className="h-6 w-6 text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Workflow Automation</CardTitle>
                      <CardDescription>Zapier-like automation</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Build automated workflows with triggers and actions
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/enterprise/advanced-features?tab=compliance">
              <Card className="hover:shadow-xl transition-all cursor-pointer border-2 hover:border-red-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-500/20 rounded-lg">
                      <Shield className="h-6 w-6 text-red-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">Compliance Center</CardTitle>
                      <CardDescription>HIPAA, SOC2, PCI-DSS</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Monitor compliance, track incidents, manage data inventory
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Link href="/enterprise/advanced-features?tab=marketplace">
              <Card className="hover:shadow-xl transition-all cursor-pointer border-2 hover:border-orange-500/50">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <Plug className="h-6 w-6 text-orange-400" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">API Marketplace</CardTitle>
                      <CardDescription>100+ integrations</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-600 dark:text-slate-300">
                    Connect to Salesforce, Stripe, Google Analytics and more
                  </p>
                </CardContent>
              </Card>
            </Link>

            <Card className="hover:shadow-xl transition-all cursor-pointer border-2 hover:border-pink-500/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-pink-500/20 rounded-lg">
                    <Box className="h-6 w-6 text-pink-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">AR Visualization</CardTitle>
                    <CardDescription>3D data visualization</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Visualize your dashboards in augmented reality
                </p>
              </CardContent>
            </Card>
          </div>
        </motion.div>

        {/* Recent Notifications Preview */}
        {notifications.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-4 bg-blue-100 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/30 rounded-xl"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Recent Notifications
              </h3>
              <Link href="/dashboard/notifications" className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300">
                View All
              </Link>
            </div>
            <div className="space-y-2">
              {notifications.slice(0, 3).map((notification) => (
                <div key={notification.id} className="text-sm text-slate-600 dark:text-gray-300 flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400">•</span>
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
          transition={{ delay: 0.25 }}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <h2 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Activity className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              Your Portals
            </h2>

            {/* Search and Filter */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-slate-400 dark:text-gray-400" />
                <input
                  type="text"
                  placeholder="Search portals..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
                />
              </div>
              <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                <PopoverTrigger asChild>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="relative p-2 rounded-lg bg-slate-100 dark:bg-slate-800/50 hover:bg-slate-200 dark:hover:bg-slate-700/50 border border-slate-200 dark:border-slate-700/50 text-slate-600 dark:text-gray-300 transition-colors"
                    title="Filter options"
                  >
                    <Filter className="h-5 w-5" />
                    {activeFilterCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-600 text-white text-[10px] rounded-full flex items-center justify-center">
                        {activeFilterCount}
                      </span>
                    )}
                  </motion.button>
                </PopoverTrigger>
                <PopoverContent className="w-72 p-4" align="end">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-sm">Filter Portals</h4>
                      {activeFilterCount > 0 && (
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="h-7 px-2 text-xs">
                          <X className="h-3 w-3 mr-1" />
                          Reset
                        </Button>
                      )}
                    </div>
                    
                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Visibility</Label>
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showPublic"
                            checked={filters.showPublic}
                            onCheckedChange={(checked) => 
                              setFilters(f => ({ ...f, showPublic: checked as boolean }))
                            }
                          />
                          <Label htmlFor="showPublic" className="text-sm font-normal cursor-pointer">
                            Public portals
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="showPrivate"
                            checked={filters.showPrivate}
                            onCheckedChange={(checked) => 
                              setFilters(f => ({ ...f, showPrivate: checked as boolean }))
                            }
                          />
                          <Label htmlFor="showPrivate" className="text-sm font-normal cursor-pointer">
                            Private portals
                          </Label>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sort By</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { value: 'name', label: 'Name' },
                          { value: 'created', label: 'Created' },
                          { value: 'updated', label: 'Updated' },
                          { value: 'accessed', label: 'Accessed' },
                        ].map((option) => (
                          <Button
                            key={option.value}
                            variant={filters.sortBy === option.value ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => setFilters(f => ({ ...f, sortBy: option.value as PortalFilters['sortBy'] }))}
                          >
                            {option.label}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wide">Order</Label>
                      <div className="flex gap-2">
                        <Button
                          variant={filters.sortOrder === 'asc' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setFilters(f => ({ ...f, sortOrder: 'asc' }))}
                        >
                          Ascending
                        </Button>
                        <Button
                          variant={filters.sortOrder === 'desc' ? 'default' : 'outline'}
                          size="sm"
                          className="flex-1 h-8 text-xs"
                          onClick={() => setFilters(f => ({ ...f, sortOrder: 'desc' }))}
                        >
                          Descending
                        </Button>
                      </div>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {filteredPortals.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-20 bg-slate-100 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800/50"
            >
              <LayoutDashboard className="h-16 w-16 text-slate-400 dark:text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">
                {searchQuery ? 'No portals found' : 'No portals yet'}
              </h3>
              <p className="text-slate-600 dark:text-gray-400 mb-6">
                {searchQuery
                  ? 'Try adjusting your search'
                  : 'Create your first portal to get started'}
              </p>
              {!searchQuery && (
                <Link href="/dashboard/portals/new">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className="px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all"
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
            className="mt-8 p-6 bg-slate-100 dark:bg-slate-900/30 rounded-2xl border border-slate-200 dark:border-slate-800/50"
          >
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
              Recent Activity
            </h3>
            <p className="text-slate-600 dark:text-gray-400">
              {stats.recentActivity} actions in the last 24 hours
            </p>
          </motion.div>
        )}
      </main>
    </div>
  );
}
