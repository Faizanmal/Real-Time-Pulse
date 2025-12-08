/**
 * Reusable Animated Card Components
 */
'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  LayoutDashboard, 
  Puzzle, 
  Zap,
  RefreshCw,
  Eye,
  Settings,
  Trash2,
  MoreVertical,
} from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color?: 'blue' | 'purple' | 'green' | 'orange' | 'red';
  className?: string;
}

const colorClasses = {
  blue: 'from-blue-500/20 to-blue-600/20 border-blue-500/30',
  purple: 'from-purple-500/20 to-purple-600/20 border-purple-500/30',
  green: 'from-green-500/20 to-green-600/20 border-green-500/30',
  orange: 'from-orange-500/20 to-orange-600/20 border-orange-500/30',
  red: 'from-red-500/20 to-red-600/20 border-red-500/30',
};

const iconColorClasses = {
  blue: 'text-blue-400',
  purple: 'text-purple-400',
  green: 'text-green-400',
  orange: 'text-orange-400',
  red: 'text-red-400',
};

export function StatsCard({
  title,
  value,
  description,
  icon,
  trend,
  color = 'blue',
  className,
}: StatsCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ willChange: 'transform' }}
      className={cn(
        'relative overflow-hidden rounded-xl border bg-gradient-to-br backdrop-blur-sm p-6',
        colorClasses[color],
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <h3 className="mt-2 text-3xl font-bold text-white">{value}</h3>
          {description && (
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              {trend.isPositive ? (
                <TrendingUp className="h-4 w-4 text-green-400" />
              ) : (
                <TrendingDown className="h-4 w-4 text-red-400" />
              )}
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? 'text-green-400' : 'text-red-400'
                )}
              >
                {trend.value}%
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn('rounded-lg p-3', iconColorClasses[color])}>
            {icon}
          </div>
        )}
      </div>
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
    </motion.div>
  );
}

interface PortalCardProps {
  id: string;
  name: string;
  description?: string | null;
  widgetCount?: number;
  isPublic: boolean;
  lastAccessedAt?: string | null;
  onView?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  className?: string;
}

export function PortalCard({
  id,
  name,
  description,
  widgetCount = 0,
  isPublic,
  lastAccessedAt,
  onView,
  onEdit,
  onDelete,
  className,
}: PortalCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.03, y: -8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ willChange: 'transform' }}
      className={cn(
        'group relative overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-6 hover:border-purple-500/50 transition-all',
        className
      )}
    >
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <LayoutDashboard className="h-5 w-5 text-purple-400" />
              <h3 className="text-xl font-bold text-white line-clamp-1">{name}</h3>
            </div>
            {description && (
              <p className="text-sm text-gray-400 line-clamp-2">{description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.1 }}
              onClick={() => onView?.(id)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-purple-400 hover:text-purple-300 transition-colors"
              title="View Portal"
            >
              <Eye className="h-4 w-4" />
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              transition={{ duration: 0.1 }}
              onClick={() => onEdit?.(id)}
              className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-blue-400 hover:text-blue-300 transition-colors"
              title="Edit Portal"
            >
              <Settings className="h-4 w-4" />
            </motion.button>
            <div className="relative">
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                transition={{ duration: 0.1 }}
                onClick={() => setShowMenu(!showMenu)}
                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-gray-400 hover:text-gray-300 transition-colors"
                title="More options"
              >
                <MoreVertical className="h-4 w-4" />
              </motion.button>
              {showMenu && (
                <div className="absolute right-0 mt-2 w-40 rounded-lg bg-slate-800 border border-slate-700 shadow-xl z-20">
                  <Link href={`/portal/${id}`} className="block px-4 py-2 text-sm text-gray-300 hover:bg-slate-700 rounded-t-lg transition-colors">
                    Open Link
                  </Link>
                  <button
                    onClick={() => {
                      onDelete?.(id);
                      setShowMenu(false);
                    }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-700 rounded-b-lg transition-colors"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-3 mt-4 pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1 text-gray-400">
                <Puzzle className="h-4 w-4" />
                {widgetCount} widgets
              </span>
              <span className="flex items-center gap-1 text-gray-400">
                <Activity className="h-4 w-4" />
                Active
              </span>
            </div>
            {isPublic && (
              <span className="px-2 py-1 rounded-md bg-green-500/20 text-green-400 text-xs font-medium flex items-center gap-1">
                <Users className="h-3 w-3" />
                Public
              </span>
            )}
          </div>
          {lastAccessedAt && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Last accessed {new Date(lastAccessedAt).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div className="absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-purple-500/10 blur-2xl group-hover:bg-purple-500/20 transition-colors" />
    </motion.div>
  );
}

interface WidgetCardProps {
  id: string;
  name: string;
  type: string;
  lastRefreshedAt?: string | null;
  integration?: {
    provider: string;
    name: string;
  };
  onRefresh?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isRefreshing?: boolean;
  className?: string;
}
export function WidgetCard({
  id,
  name,
  type,
  lastRefreshedAt,
  integration,
  onRefresh,
  onEdit,
  onDelete,
  isRefreshing = false,
  className,
}: WidgetCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      style={{ willChange: 'transform' }}
      className={cn(
        'relative overflow-hidden rounded-lg border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-4 hover:border-blue-500/50 transition-all',
        className
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-white mb-1">{name}</h4>
          <p className="text-xs text-gray-400">{type}</p>
        </div>
        <div className="flex gap-1">
          <motion.button
            whileHover={{ scale: 1.1, rotate: 180 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onRefresh?.(id)}
            disabled={isRefreshing}
            className="p-1.5 rounded-md bg-slate-700/50 hover:bg-blue-500/20 text-blue-400 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefreshing && 'animate-spin')} />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit?.(id)}
            className="p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-gray-400 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete?.(id)}
            className="p-1.5 rounded-md bg-slate-700/50 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>

      {integration && (
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <Zap className="h-3 w-3" />
          <span>{integration.name}</span>
        </div>
      )}

      {lastRefreshedAt && (
        <div className="mt-2 text-xs text-gray-600">
          Updated {new Date(lastRefreshedAt).toLocaleTimeString()}
        </div>
      )}
    </motion.div>
  );
}

interface IntegrationCardProps {
  id: string;
  provider: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  lastSyncAt?: string | null;
  onTest?: (id: string) => void;
  onSync?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  isSyncing?: boolean;
  className?: string;
}

const statusColors = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  error: 'bg-red-500/20 text-red-400 border-red-500/30',
};

export function IntegrationCard({
  id,
  provider,
  name,
  status,
  lastSyncAt,
  onTest,
  onSync,
  onEdit,
  onDelete,
  isSyncing = false,
  className,
}: IntegrationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02, y: -5 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      style={{ willChange: 'transform' }}
      className={cn(
        'relative overflow-hidden rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur-sm p-5 hover:border-green-500/50 transition-all',
        className
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h4 className="text-lg font-bold text-white mb-1">{name}</h4>
          <p className="text-sm text-gray-400">{provider}</p>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-xs font-medium border', statusColors[status])}>
          {status}
        </span>
      </div>

      <div className="flex items-center gap-2 mb-4">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onTest?.(id)}
          className="flex-1 py-2 px-3 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm font-medium transition-colors"
        >
          Test
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSync?.(id)}
          disabled={isSyncing}
          className="flex-1 py-2 px-3 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', isSyncing && 'animate-spin')} />
          Sync
        </motion.button>
      </div>

      <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
        {lastSyncAt ? (
          <span className="text-xs text-gray-500">
            Synced {new Date(lastSyncAt).toLocaleString()}
          </span>
        ) : (
          <span className="text-xs text-gray-600">Never synced</span>
        )}
        <div className="flex gap-1">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onEdit?.(id)}
            className="p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-600/50 text-gray-400 transition-colors"
          >
            <Settings className="h-3.5 w-3.5" />
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => onDelete?.(id)}
            className="p-1.5 rounded-md bg-slate-700/50 hover:bg-red-500/20 text-red-400 transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </motion.button>
        </div>
      </div>

      <div className="absolute -right-8 -bottom-8 h-24 w-24 rounded-full bg-green-500/10 blur-xl" />
    </motion.div>
  );
}
