'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { portalApi } from '@/lib/api-client';
import { PortalCard } from '@/components/ui/feature-cards';
import { toast } from 'sonner';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import type { Portal } from '@/types';
import {
  LayoutDashboard,
  Plus,
  ArrowLeft,
  Search,
  Filter,
  Grid,
  List,
  SortAsc,
  SortDesc,
  X,
} from 'lucide-react';

interface PortalFilters {
  showPublic: boolean;
  showPrivate: boolean;
  sortOrder: 'asc' | 'desc';
}

export default function PortalsPage() {
  const router = useRouter();
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [portals, setPortals] = useState<Portal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'accessed'>('name');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState<PortalFilters>({
    showPublic: true,
    showPrivate: true,
    sortOrder: 'asc',
  });

  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    loadPortals();
  }, [isAuthenticated, isHydrated, router]);

  const loadPortals = async () => {
    try {
      const data = await portalApi.getAll();
      setPortals(data.portals);
    } catch (error) {
      console.error('Failed to load portals:', error);
    } finally {
      setIsLoading(false);
    }
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

  const sortedAndFilteredPortals = useMemo(() => {
    return portals
      .filter((portal) => {
        // Text search
        const matchesSearch = portal.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          portal.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Visibility filter
        const matchesVisibility = (filters.showPublic && portal.isPublic) || 
          (filters.showPrivate && !portal.isPublic);
        
        return matchesSearch && matchesVisibility;
      })
      .sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case 'name':
            comparison = a.name.localeCompare(b.name);
            break;
          case 'created':
            comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
            break;
          case 'accessed':
            const aAccess = a.lastAccessedAt ? new Date(a.lastAccessedAt).getTime() : 0;
            const bAccess = b.lastAccessedAt ? new Date(b.lastAccessedAt).getTime() : 0;
            comparison = aAccess - bAccess;
            break;
        }
        return filters.sortOrder === 'desc' ? -comparison : comparison;
      });
  }, [portals, searchQuery, sortBy, filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (!filters.showPublic || !filters.showPrivate) count++;
    return count;
  }, [filters]);

  const resetFilters = () => {
    setFilters({
      showPublic: true,
      showPrivate: true,
      sortOrder: 'asc',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-linear-to-br from-slate-950 via-purple-950 to-slate-950 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg text-gray-300">Loading portals...</p>
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
                  <LayoutDashboard className="h-7 w-7 text-purple-400" />
                  Portals
                </h1>
                <p className="text-sm text-gray-400">{portals.length} total portals</p>
              </div>
            </div>

            <Link href="/dashboard/portals/new">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="px-6 py-2.5 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all flex items-center gap-2"
              >
                <Plus className="h-5 w-5" />
                New Portal
              </motion.button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Filters and Controls */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 flex flex-col sm:flex-row gap-4 items-center justify-between"
        >
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search portals..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-2">
            {/* Sort */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'created' | 'accessed')}
              className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-all flex items-center gap-2"
            >
              <option value="name">Sort by Name</option>
              <option value="created">Sort by Created</option>
              <option value="accessed">Sort by Accessed</option>
            </select>

            {/* Sort Direction Toggle */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setFilters(f => ({ ...f, sortOrder: f.sortOrder === 'asc' ? 'desc' : 'asc' }))}
              className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-purple-400 hover:bg-slate-700/50 transition-all"
              title={filters.sortOrder === 'asc' ? 'Sorting Ascending' : 'Sorting Descending'}
            >
              {filters.sortOrder === 'asc' ? <SortAsc className="h-5 w-5" /> : <SortDesc className="h-5 w-5" />}
            </motion.button>

            {/* Filter Options Popover */}
            <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
              <PopoverTrigger asChild>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="relative p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-gray-300 hover:bg-slate-700/50 transition-all"
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
              <PopoverContent className="w-64 p-4" align="end">
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
                </div>
              </PopoverContent>
            </Popover>

            {/* View Mode Toggle */}
            <div className="flex gap-1 p-1 bg-slate-800/50 border border-slate-700/50 rounded-xl">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'grid'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-gray-400 hover:text-gray-300'
                  }`}
              >
                <Grid className="h-5 w-5" />
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-all ${viewMode === 'list'
                    ? 'bg-purple-500/20 text-purple-400'
                    : 'text-gray-400 hover:text-gray-300'
                  }`}
              >
                <List className="h-5 w-5" />
              </motion.button>
            </div>
          </div>
        </motion.div>

        {/* Portals Grid/List */}
        {sortedAndFilteredPortals.length === 0 ? (
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
                  className="px-6 py-3 bg-linear-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold rounded-xl transition-all"
                >
                  <Plus className="inline-block h-5 w-5 mr-2" />
                  Create Portal
                </motion.button>
              </Link>
            )}
          </motion.div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'
                : 'space-y-4'
            }
          >
            {sortedAndFilteredPortals.map((portal, index) => (
              <motion.div
                key={portal.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <PortalCard
                  {...portal}
                  onView={(id) => router.push(`/dashboard/portals/${id}`)}
                  onEdit={(id) => router.push(`/dashboard/portals/${id}/edit`)}
                  onDelete={handleDeletePortal}
                  className={viewMode === 'list' ? 'w-full' : ''}
                />
              </motion.div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
