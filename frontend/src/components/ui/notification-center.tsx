'use client';

/**
 * ============================================================================
 * NOTIFICATION CENTER & ACTIVITY FEED
 * ============================================================================
 * Comprehensive notification center with filtering, read/unread states,
 * grouping, activity timeline, and real-time updates.
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  useMemo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from './button';
import {
  Bell,
  BellOff,
  Check,
  CheckCheck,
  X,
  Settings,
  Filter,
  Clock,
  AlertTriangle,
  Info,
  AlertCircle,
  CheckCircle,
  Zap,
  MessageSquare,
  Users,
  BarChart3,
  FileText,
  Shield,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Volume2,
  VolumeX,
  MoreHorizontal,
  Archive,
  Star,
  Eye,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ==================== TYPES ====================

type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'alert' | 'update';
type NotificationCategory = 'system' | 'portal' | 'alert' | 'team' | 'billing' | 'security' | 'integration';

interface Notification {
  id: string;
  type: NotificationType;
  category: NotificationCategory;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  archived: boolean;
  starred: boolean;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
  metadata?: {
    portalId?: string;
    portalName?: string;
    userId?: string;
    userName?: string;
    alertId?: string;
    [key: string]: unknown;
  };
  groupId?: string;
}

interface NotificationGroup {
  id: string;
  title: string;
  notifications: Notification[];
  count: number;
}

interface NotificationPreferences {
  soundEnabled: boolean;
  desktopEnabled: boolean;
  emailDigest: 'off' | 'instant' | 'daily' | 'weekly';
  categories: Record<NotificationCategory, boolean>;
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  preferences: NotificationPreferences;
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'archived' | 'starred'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  markAsUnread: (id: string) => void;
  archive: (id: string) => void;
  delete: (id: string) => void;
  toggleStar: (id: string) => void;
  clearAll: () => void;
  updatePreferences: (prefs: Partial<NotificationPreferences>) => void;
}

// ==================== CONTEXT ====================

const NotificationCenterContext = createContext<NotificationContextValue | null>(null);
const STORAGE_KEY = 'pulse_notifications';
const PREFS_KEY = 'pulse_notification_prefs';

const DEFAULT_PREFERENCES: NotificationPreferences = {
  soundEnabled: true,
  desktopEnabled: false,
  emailDigest: 'daily',
  categories: {
    system: true,
    portal: true,
    alert: true,
    team: true,
    billing: true,
    security: true,
    integration: true,
  },
};

// Sample notifications for demo
const SAMPLE_NOTIFICATIONS: Notification[] = [
  {
    id: '1',
    type: 'success',
    category: 'portal',
    title: 'Portal Created',
    message: 'Your new portal "Acme Corp Dashboard" has been created successfully.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5), // 5 mins ago
    read: false,
    archived: false,
    starred: false,
    action: { label: 'View Portal', href: '/dashboard/portals/acme' },
    metadata: { portalId: 'acme', portalName: 'Acme Corp Dashboard' },
  },
  {
    id: '2',
    type: 'warning',
    category: 'alert',
    title: 'High Traffic Alert',
    message: 'The widget "Revenue Chart" on "Client A Portal" is experiencing high traffic.',
    timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
    read: false,
    archived: false,
    starred: true,
    action: { label: 'View Alert', href: '/dashboard/alerts/123' },
    metadata: { alertId: '123', portalName: 'Client A Portal' },
  },
  {
    id: '3',
    type: 'info',
    category: 'team',
    title: 'New Team Member',
    message: 'Sarah Johnson has joined your workspace as a Member.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    read: true,
    archived: false,
    starred: false,
    metadata: { userId: 'sarah', userName: 'Sarah Johnson' },
  },
  {
    id: '4',
    type: 'error',
    category: 'integration',
    title: 'Integration Failed',
    message: 'The Google Analytics connection has been disconnected. Please reconnect.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
    read: true,
    archived: false,
    starred: false,
    action: { label: 'Reconnect', href: '/dashboard/integrations' },
  },
  {
    id: '5',
    type: 'info',
    category: 'system',
    title: 'Scheduled Maintenance',
    message: 'The platform will undergo scheduled maintenance tomorrow from 2-4 AM UTC.',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    read: true,
    archived: false,
    starred: false,
  },
];

export function NotificationCenterProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [preferences, setPreferences] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);

  // Load from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const savedNotifications = localStorage.getItem(STORAGE_KEY);
      if (savedNotifications) {
        const parsed = JSON.parse(savedNotifications);
        setNotifications(parsed.map((n: Notification) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        })));
      } else {
        // Use sample notifications for demo
        setNotifications(SAMPLE_NOTIFICATIONS);
      }

      const savedPrefs = localStorage.getItem(PREFS_KEY);
      if (savedPrefs) {
        setPreferences(JSON.parse(savedPrefs));
      }
    } catch {
      setNotifications(SAMPLE_NOTIFICATIONS);
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
    } catch {
      // Ignore
    }
  }, [notifications]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(preferences));
    } catch {
      // Ignore
    }
  }, [preferences]);

  const unreadCount = useMemo(() => 
    notifications.filter(n => !n.read && !n.archived).length,
    [notifications]
  );

  const addNotification = useCallback((
    notification: Omit<Notification, 'id' | 'timestamp' | 'read' | 'archived' | 'starred'>
  ) => {
    const newNotification: Notification = {
      ...notification,
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      read: false,
      archived: false,
      starred: false,
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Play sound if enabled
    if (preferences.soundEnabled && typeof window !== 'undefined') {
      // Play notification sound
      const audio = new Audio('/sounds/notification.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    }

    // Show desktop notification if enabled
    if (preferences.desktopEnabled && typeof window !== 'undefined' && 'Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(notification.title, {
          body: notification.message,
          icon: '/icon-192.png',
        });
      }
    }
  }, [preferences.soundEnabled, preferences.desktopEnabled]);

  const markAsRead = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => 
      prev.map(n => ({ ...n, read: true }))
    );
  }, []);

  const markAsUnread = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: false } : n)
    );
  }, []);

  const archive = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, archived: true } : n)
    );
  }, []);

  const deleteNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const toggleStar = useCallback((id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, starred: !n.starred } : n)
    );
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
  }, []);

  const updatePreferences = useCallback((prefs: Partial<NotificationPreferences>) => {
    setPreferences(prev => ({ ...prev, ...prefs }));
  }, []);

  return (
    <NotificationCenterContext.Provider
      value={{
        notifications,
        unreadCount,
        preferences,
        addNotification,
        markAsRead,
        markAllAsRead,
        markAsUnread,
        archive,
        delete: deleteNotification,
        toggleStar,
        clearAll,
        updatePreferences,
      }}
    >
      {children}
    </NotificationCenterContext.Provider>
  );
}

export function useNotificationCenter() {
  const context = useContext(NotificationCenterContext);
  if (!context) {
    throw new Error('useNotificationCenter must be used within NotificationCenterProvider');
  }
  return context;
}

// ==================== NOTIFICATION BELL ====================

interface NotificationBellProps {
  onClick: () => void;
  className?: string;
}

export function NotificationBell({ onClick, className }: NotificationBellProps) {
  const { unreadCount } = useNotificationCenter();

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors',
        className
      )}
      aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
    >
      <Bell className="h-5 w-5 text-gray-600 dark:text-gray-400" />
      
      <AnimatePresence>
        {unreadCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-medium rounded-full"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  );
}

// ==================== NOTIFICATION PANEL ====================

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationPanel({ isOpen, onClose }: NotificationPanelProps) {
  const {
    notifications,
    unreadCount,
    preferences,
    markAsRead,
    markAllAsRead,
    archive,
    delete: deleteNotification,
    toggleStar,
    clearAll,
    updatePreferences,
  } = useNotificationCenter();

  const [filter, setFilter] = useState<'all' | 'unread' | 'starred'>('all');
  const [showSettings, setShowSettings] = useState(false);

  // Filter notifications
  const filteredNotifications = useMemo(() => {
    let result = notifications.filter(n => !n.archived);

    switch (filter) {
      case 'unread':
        result = result.filter(n => !n.read);
        break;
      case 'starred':
        result = result.filter(n => n.starred);
        break;
    }

    return result;
  }, [notifications, filter]);

  // Group by date
  const groupedNotifications = useMemo((): NotificationGroup[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeek = new Date(today);
    thisWeek.setDate(thisWeek.getDate() - 7);

    const groups: Record<string, Notification[]> = {
      today: [],
      yesterday: [],
      thisWeek: [],
      older: [],
    };

    filteredNotifications.forEach(n => {
      const date = new Date(n.timestamp);
      date.setHours(0, 0, 0, 0);

      if (date.getTime() === today.getTime()) {
        groups.today.push(n);
      } else if (date.getTime() === yesterday.getTime()) {
        groups.yesterday.push(n);
      } else if (date >= thisWeek) {
        groups.thisWeek.push(n);
      } else {
        groups.older.push(n);
      }
    });

    const result: NotificationGroup[] = [];

    if (groups.today.length > 0) {
      result.push({ id: 'today', title: 'Today', notifications: groups.today, count: groups.today.length });
    }
    if (groups.yesterday.length > 0) {
      result.push({ id: 'yesterday', title: 'Yesterday', notifications: groups.yesterday, count: groups.yesterday.length });
    }
    if (groups.thisWeek.length > 0) {
      result.push({ id: 'thisWeek', title: 'This Week', notifications: groups.thisWeek, count: groups.thisWeek.length });
    }
    if (groups.older.length > 0) {
      result.push({ id: 'older', title: 'Older', notifications: groups.older, count: groups.older.length });
    }

    return result;
  }, [filteredNotifications]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="fixed right-4 top-16 w-96 max-h-[calc(100vh-5rem)] bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden z-50 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b dark:border-slate-700">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-purple-500" />
                <h2 className="font-semibold">Notifications</h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 text-xs rounded-full">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                  title="Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
                <button
                  onClick={onClose}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Settings Panel */}
            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-b dark:border-slate-700"
                >
                  <div className="p-4 space-y-4 bg-gray-50 dark:bg-slate-800/50">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {preferences.soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                        <span className="text-sm">Sound</span>
                      </div>
                      <button
                        onClick={() => updatePreferences({ soundEnabled: !preferences.soundEnabled })}
                        className={cn(
                          'w-10 h-6 rounded-full transition-colors relative',
                          preferences.soundEnabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-slate-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: preferences.soundEnabled ? 16 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                        />
                      </button>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell className="h-4 w-4" />
                        <span className="text-sm">Desktop notifications</span>
                      </div>
                      <button
                        onClick={() => {
                          if (preferences.desktopEnabled) {
                            updatePreferences({ desktopEnabled: false });
                          } else {
                            Notification.requestPermission().then(permission => {
                              if (permission === 'granted') {
                                updatePreferences({ desktopEnabled: true });
                              }
                            });
                          }
                        }}
                        className={cn(
                          'w-10 h-6 rounded-full transition-colors relative',
                          preferences.desktopEnabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-slate-600'
                        )}
                      >
                        <motion.div
                          animate={{ x: preferences.desktopEnabled ? 16 : 2 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow"
                        />
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Filters */}
            <div className="flex items-center gap-2 p-3 border-b dark:border-slate-700">
              {(['all', 'unread', 'starred'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1.5 text-sm rounded-lg transition-colors capitalize',
                    filter === f
                      ? 'bg-purple-100 dark:bg-purple-900/50 text-purple-600'
                      : 'hover:bg-gray-100 dark:hover:bg-slate-800'
                  )}
                >
                  {f}
                </button>
              ))}
              
              <div className="flex-1" />
              
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notifications List */}
            <div className="flex-1 overflow-auto">
              {groupedNotifications.length === 0 ? (
                <div className="py-12 text-center">
                  <BellOff className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-gray-500">No notifications</p>
                  <p className="text-sm text-gray-400">You&apos;re all caught up!</p>
                </div>
              ) : (
                groupedNotifications.map(group => (
                  <div key={group.id}>
                    <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase bg-gray-50 dark:bg-slate-800/50 sticky top-0">
                      {group.title}
                    </div>
                    
                    {group.notifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onRead={() => markAsRead(notification.id)}
                        onArchive={() => archive(notification.id)}
                        onDelete={() => deleteNotification(notification.id)}
                        onToggleStar={() => toggleStar(notification.id)}
                      />
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 border-t dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                <button
                  onClick={clearAll}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                  Clear all notifications
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ==================== NOTIFICATION ITEM ====================

interface NotificationItemProps {
  notification: Notification;
  onRead: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onToggleStar: () => void;
}

function NotificationItem({
  notification,
  onRead,
  onArchive,
  onDelete,
  onToggleStar,
}: NotificationItemProps) {
  const [showActions, setShowActions] = useState(false);

  const typeConfig: Record<NotificationType, { icon: ReactNode; color: string }> = {
    info: { icon: <Info />, color: 'text-blue-500 bg-blue-100 dark:bg-blue-900/50' },
    success: { icon: <CheckCircle />, color: 'text-green-500 bg-green-100 dark:bg-green-900/50' },
    warning: { icon: <AlertTriangle />, color: 'text-yellow-500 bg-yellow-100 dark:bg-yellow-900/50' },
    error: { icon: <AlertCircle />, color: 'text-red-500 bg-red-100 dark:bg-red-900/50' },
    alert: { icon: <Zap />, color: 'text-orange-500 bg-orange-100 dark:bg-orange-900/50' },
    update: { icon: <BarChart3 />, color: 'text-purple-500 bg-purple-100 dark:bg-purple-900/50' },
  };

  const config = typeConfig[notification.type];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -100 }}
      className={cn(
        'relative p-4 border-b dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors group',
        !notification.read && 'bg-purple-50/50 dark:bg-purple-900/10'
      )}
      onClick={() => {
        if (!notification.read) onRead();
        if (notification.action?.href) {
          window.location.href = notification.action.href;
        } else if (notification.action?.onClick) {
          notification.action.onClick();
        }
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Unread indicator */}
      {!notification.read && (
        <div className="absolute left-1.5 top-1/2 -translate-y-1/2 w-2 h-2 bg-purple-500 rounded-full" />
      )}

      <div className="flex gap-3 pl-2">
        {/* Icon */}
        <div className={cn('p-2 rounded-lg shrink-0', config.color)}>
          {React.cloneElement(config.icon as React.ReactElement, { className: 'h-4 w-4' })}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h4 className={cn(
              'text-sm',
              !notification.read ? 'font-semibold' : 'font-medium'
            )}>
              {notification.title}
            </h4>
            <div className="flex items-center gap-1 shrink-0">
              {notification.starred && (
                <Star className="h-3 w-3 text-yellow-400 fill-yellow-400" />
              )}
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
              </span>
            </div>
          </div>
          
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
            {notification.message}
          </p>

          {notification.action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (notification.action?.onClick) {
                  notification.action.onClick();
                }
              }}
              className="flex items-center gap-1 mt-2 text-xs text-purple-600 hover:text-purple-700 font-medium"
            >
              {notification.action.label}
              <ChevronRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <AnimatePresence>
        {showActions && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute right-2 top-2 flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg shadow-lg p-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={onToggleStar}
              className={cn(
                'p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors',
                notification.starred && 'text-yellow-400'
              )}
              title={notification.starred ? 'Unstar' : 'Star'}
            >
              <Star className={cn('h-4 w-4', notification.starred && 'fill-current')} />
            </button>
            {!notification.read && (
              <button
                onClick={onRead}
                className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                title="Mark as read"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={onArchive}
              className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              title="Archive"
            >
              <Archive className="h-4 w-4" />
            </button>
            <button
              onClick={onDelete}
              className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/50 text-red-500 transition-colors"
              title="Delete"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ==================== ACTIVITY FEED ====================

interface ActivityItem {
  id: string;
  type: 'create' | 'update' | 'delete' | 'view' | 'share' | 'comment' | 'login';
  actor: {
    id: string;
    name: string;
    avatar?: string;
  };
  action: string;
  target?: {
    type: string;
    name: string;
    href?: string;
  };
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading?: boolean;
  className?: string;
}

export function ActivityFeed({ activities, isLoading, className }: ActivityFeedProps) {
  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4" />
              <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <Clock className="h-8 w-8 mx-auto text-gray-300 dark:text-gray-600 mb-2" />
        <p className="text-gray-500">No recent activity</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-1', className)}>
      {activities.map((activity, index) => (
        <motion.div
          key={activity.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
          className="flex gap-3 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
        >
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white text-sm font-medium shrink-0">
            {activity.actor.avatar ? (
              <img src={activity.actor.avatar} alt="" className="w-full h-full rounded-full object-cover" />
            ) : (
              activity.actor.name.charAt(0).toUpperCase()
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <p className="text-sm">
              <span className="font-medium">{activity.actor.name}</span>
              {' '}
              <span className="text-gray-500">{activity.action}</span>
              {activity.target && (
                <>
                  {' '}
                  {activity.target.href ? (
                    <a href={activity.target.href} className="font-medium text-purple-600 hover:underline">
                      {activity.target.name}
                    </a>
                  ) : (
                    <span className="font-medium">{activity.target.name}</span>
                  )}
                </>
              )}
            </p>
            <p className="text-xs text-gray-400 mt-0.5">
              {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export default {
  NotificationCenterProvider,
  useNotificationCenter,
  NotificationBell,
  NotificationPanel,
  ActivityFeed,
};
