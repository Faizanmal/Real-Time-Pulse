'use client';

/**
 * Notifications Center Dashboard
 * View and manage all notifications with preferences
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bell,
  BellOff,
  Settings,
  Check,
  CheckCheck,
  Trash2,
  Search,
  Mail,
  Smartphone,
  MessageSquare,
  Slack,
  Webhook,
  Clock,
  AlertCircle,
  AlertTriangle,
  Info,
  X
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { notificationsApi } from '@/lib/api/index';
import type { Notification, NotificationPreferences, NotificationStats } from '@/lib/api/index';
import { toast } from 'sonner';

const NOTIFICATION_TYPES = [
  { value: 'alert', label: 'Alerts', icon: AlertCircle },
  { value: 'warning', label: 'Warnings', icon: AlertTriangle },
  { value: 'info', label: 'Information', icon: Info },
  { value: 'system', label: 'System', icon: Settings },
];

const CHANNELS = [
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'push', label: 'Push', icon: Smartphone },
  { value: 'in-app', label: 'In-App', icon: MessageSquare },
  { value: 'slack', label: 'Slack', icon: Slack },
  { value: 'webhook', label: 'Webhook', icon: Webhook },
];

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [selectedNotifications, setSelectedNotifications] = useState<Set<string>>(new Set());
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [notificationsData, statsData, prefsData] = await Promise.all([
        notificationsApi.getNotifications({ unreadOnly: showUnreadOnly }),
        notificationsApi.getStats(),
        notificationsApi.getPreferences(),
      ]);
      setNotifications(notificationsData);
      setStats(statsData);
      setPreferences(prefsData);
    } catch (error) {
      console.error('Failed to load notifications:', error);
      toast.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [showUnreadOnly]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const markAsRead = async (id: string) => {
    try {
      await notificationsApi.markAsRead(id);
      setNotifications(prev => prev.map(n => 
        n.id === id ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ));
      if (stats) {
        setStats({ ...stats, unread: stats.unread - 1 });
      }
    } catch (error) {
      console.error('Failed to mark as read:', error);
      toast.error('Failed to mark as read');
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true, readAt: new Date().toISOString() })));
      if (stats) {
        setStats({ ...stats, unread: 0 });
      }
      toast.success('All notifications marked as read');
    } catch (error) {
      console.error('Failed to mark all as read:', error);
      toast.error('Failed to mark all as read');
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await notificationsApi.deleteNotification(id);
      setNotifications(prev => prev.filter(n => n.id !== id));
      toast.success('Notification deleted');
    } catch (error) {
      console.error('Failed to delete notification:', error);
      toast.error('Failed to delete notification');
    }
  };

  const deleteSelected = async () => {
    try {
      await Promise.all(Array.from(selectedNotifications).map(id => 
        notificationsApi.deleteNotification(id)
      ));
      setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)));
      setSelectedNotifications(new Set());
      toast.success('Selected notifications deleted');
    } catch (error) {
      console.error('Failed to delete notifications:', error);
      toast.error('Failed to delete notifications');
    }
  };

  const deleteAllRead = async () => {
    try {
      await notificationsApi.deleteAllRead();
      setNotifications(prev => prev.filter(n => !n.read));
      toast.success('Read notifications deleted');
    } catch (error) {
      console.error('Failed to delete read notifications:', error);
      toast.error('Failed to delete read notifications');
    }
  };

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    try {
      const updated = await notificationsApi.updatePreferences(updates);
      setPreferences(updated);
      toast.success('Preferences updated');
    } catch (error) {
      console.error('Failed to update preferences:', error);
      toast.error('Failed to update preferences');
    }
  };

  const sendTestNotification = async (channel: 'email' | 'push' | 'sms' | 'in-app' | 'slack' | 'webhook') => {
    try {
      await notificationsApi.sendTestNotification(channel);
      toast.success(`Test notification sent to ${channel}`);
    } catch (error) {
      console.error('Failed to send test notification:', error);
      toast.error('Failed to send test notification');
    }
  };

  const toggleSelectNotification = (id: string) => {
    const newSelected = new Set(selectedNotifications);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedNotifications(newSelected);
  };

  const selectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set());
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)));
    }
  };

  const filteredNotifications = notifications.filter(notification => {
    const matchesSearch = notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      notification.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || notification.type === filterType;
    const matchesPriority = filterPriority === 'all' || notification.priority === filterPriority;
    return matchesSearch && matchesType && matchesPriority;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'text-red-500 bg-red-100 dark:bg-red-900';
      case 'high': return 'text-orange-500 bg-orange-100 dark:bg-orange-900';
      case 'normal': return 'text-blue-500 bg-blue-100 dark:bg-blue-900';
      case 'low': return 'text-gray-500 bg-gray-100 dark:bg-gray-800';
      default: return 'text-gray-500 bg-gray-100 dark:bg-gray-800';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'alert': return <AlertCircle className="w-4 h-4" />;
      case 'warning': return <AlertTriangle className="w-4 h-4" />;
      case 'info': return <Info className="w-4 h-4" />;
      default: return <Bell className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Notifications</h1>
          <p className="text-muted-foreground">Manage your notifications and preferences</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={markAllAsRead} disabled={stats?.unread === 0}>
            <CheckCheck className="w-4 h-4 mr-2" />
            Mark All Read
          </Button>
          <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Settings className="w-4 h-4 mr-2" />
                Preferences
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Notification Preferences</DialogTitle>
              </DialogHeader>
              {preferences && (
                <div className="space-y-6">
                  <div className="space-y-4">
                    <h4 className="font-medium">Channels</h4>
                    {CHANNELS.map(channel => (
                      <div key={channel.value} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <channel.icon className="w-4 h-4" />
                          <span>{channel.label}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={preferences[channel.value as keyof NotificationPreferences] as boolean}
                            onCheckedChange={(checked) => updatePreferences({ [channel.value]: checked })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => sendTestNotification(channel.value as 'email' | 'push' | 'sms' | 'in-app' | 'slack' | 'webhook')}
                          >
                            Test
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium">Quiet Hours</h4>
                    <div className="flex items-center justify-between">
                      <span>Enable Quiet Hours</span>
                      <Switch
                        checked={preferences.quietHours?.enabled || false}
                        onCheckedChange={(checked) => updatePreferences({
                          quietHours: { ...preferences.quietHours, enabled: checked, start: '22:00', end: '08:00' }
                        })}
                      />
                    </div>
                    {preferences.quietHours?.enabled && (
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Start Time</Label>
                          <Input
                            type="time"
                            value={preferences.quietHours.start}
                            onChange={(e) => updatePreferences({
                              quietHours: { ...preferences.quietHours!, start: e.target.value }
                            })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>End Time</Label>
                          <Input
                            type="time"
                            value={preferences.quietHours.end}
                            onChange={(e) => updatePreferences({
                              quietHours: { ...preferences.quietHours!, end: e.target.value }
                            })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <Bell className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-100 dark:bg-red-900 rounded-lg">
                  <BellOff className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Unread</p>
                  <p className="text-2xl font-bold">{stats?.unread || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">High Priority</p>
                  <p className="text-2xl font-bold">
                    {(stats?.byPriority?.high || 0) + (stats?.byPriority?.urgent || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Check className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Read</p>
                  <p className="text-2xl font-bold">{(stats?.total || 0) - (stats?.unread || 0)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {NOTIFICATION_TYPES.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                <SelectItem value="urgent">Urgent</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch checked={showUnreadOnly} onCheckedChange={setShowUnreadOnly} />
              <Label>Unread only</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedNotifications.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-4 p-4 bg-muted rounded-lg"
        >
          <span className="text-sm font-medium">{selectedNotifications.size} selected</span>
          <Button variant="outline" size="sm" onClick={() => setSelectedNotifications(new Set())}>
            Clear
          </Button>
          <Button variant="outline" size="sm" onClick={deleteSelected}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Selected
          </Button>
        </motion.div>
      )}

      {/* Notifications List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-4">
            <Checkbox
              checked={selectedNotifications.size === filteredNotifications.length && filteredNotifications.length > 0}
              onCheckedChange={selectAll}
            />
            <CardTitle>All Notifications</CardTitle>
          </div>
          <Button variant="ghost" size="sm" onClick={deleteAllRead}>
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Read
          </Button>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <AnimatePresence>
              {filteredNotifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No notifications found</p>
                </div>
              ) : (
                filteredNotifications.map((notification, index) => (
                  <motion.div
                    key={notification.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex items-start gap-4 p-4 rounded-lg transition-colors cursor-pointer ${
                      notification.read
                        ? 'bg-muted/50'
                        : 'bg-primary/5 border border-primary/10'
                    }`}
                    onClick={() => !notification.read && markAsRead(notification.id)}
                  >
                    <Checkbox
                      checked={selectedNotifications.has(notification.id)}
                      onCheckedChange={() => toggleSelectNotification(notification.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className={`p-2 rounded-lg ${getPriorityColor(notification.priority)}`}>
                      {getTypeIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className={`font-medium ${notification.read ? '' : 'text-primary'}`}>
                          {notification.title}
                        </h4>
                        {!notification.read && (
                          <span className="w-2 h-2 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">{notification.body}</p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(notification.createdAt).toLocaleString()}
                        </span>
                        <Badge variant="outline" className="text-xs">{notification.priority}</Badge>
                        {notification.channels.map(channel => (
                          <Badge key={channel} variant="secondary" className="text-xs">{channel}</Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
