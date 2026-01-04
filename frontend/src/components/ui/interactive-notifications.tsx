"use client";

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Bell, Check, X, Clock, Eye, MessageSquare, AlertTriangle, Info,
    CheckCircle2, Trash2, MoreHorizontal, Archive, Pin, Reply,
    ThumbsUp, ThumbsDown, Share2, Bookmark,
} from "lucide-react";

// Types
type NotificationType = "info" | "success" | "warning" | "error" | "action" | "message";

interface NotificationAction {
    label: string;
    action: () => void | Promise<void>;
    variant?: "primary" | "secondary" | "destructive";
}

interface InteractiveNotification {
    id: string;
    type: NotificationType;
    title: string;
    message: string;
    timestamp: Date | string;
    read?: boolean;
    pinned?: boolean;
    actions?: NotificationAction[];
    avatar?: string;
    source?: string;
    priority?: "low" | "medium" | "high" | "urgent";
}

const notificationIcons: Record<NotificationType, React.ReactNode> = {
    info: <Info className="h-5 w-5 text-blue-500" />,
    success: <CheckCircle2 className="h-5 w-5 text-green-500" />,
    warning: <AlertTriangle className="h-5 w-5 text-amber-500" />,
    error: <X className="h-5 w-5 text-red-500" />,
    action: <Bell className="h-5 w-5 text-purple-500" />,
    message: <MessageSquare className="h-5 w-5 text-cyan-500" />,
};

const priorityColors = {
    low: "border-l-gray-400",
    medium: "border-l-blue-500",
    high: "border-l-amber-500",
    urgent: "border-l-red-500",
};

// Notification Card
interface NotificationCardProps {
    notification: InteractiveNotification;
    onDismiss?: (id: string) => void;
    onRead?: (id: string) => void;
    onPin?: (id: string) => void;
    onQuickReply?: (id: string, message: string) => void;
}

export function InteractiveNotificationCard({
    notification, onDismiss, onRead, onPin, onQuickReply,
}: NotificationCardProps) {
    const [isHovered, setIsHovered] = useState(false);
    const [showReply, setShowReply] = useState(false);
    const [replyText, setReplyText] = useState("");
    const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

    const formatTimeAgo = (timestamp: Date | string) => {
        const date = new Date(timestamp);
        const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
        if (diffMins < 1) return "Just now";
        if (diffMins < 60) return `${diffMins}m`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
        return `${Math.floor(diffMins / 1440)}d`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -100 }}
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className={cn(
                "relative overflow-hidden rounded-xl border-l-4 bg-white shadow-lg dark:bg-gray-800",
                notification.priority && priorityColors[notification.priority],
                !notification.read && "ring-2 ring-blue-500/20",
                notification.pinned && "bg-amber-50/50 dark:bg-amber-900/10"
            )}
        >
            <div className="p-4">
                <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                        {notificationIcons[notification.type]}
                    </div>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between">
                            <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                                {notification.title}
                            </h4>
                            <span className="text-xs text-gray-500 flex items-center gap-1">
                                {notification.pinned && <Pin className="h-3 w-3 text-amber-500" />}
                                <Clock className="h-3 w-3" />
                                {formatTimeAgo(notification.timestamp)}
                            </span>
                        </div>
                        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {notification.message}
                        </p>

                        {/* Quick Reply */}
                        <AnimatePresence>
                            {showReply && (
                                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 flex gap-2">
                                    <input
                                        value={replyText}
                                        onChange={(e) => setReplyText(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter" && replyText.trim()) {
                                                onQuickReply?.(notification.id, replyText);
                                                setReplyText("");
                                                setShowReply(false);
                                            }
                                        }}
                                        placeholder="Type reply..."
                                        className="flex-1 rounded-lg border px-3 py-2 text-sm dark:bg-gray-700"
                                    />
                                    <button onClick={() => { onQuickReply?.(notification.id, replyText); setShowReply(false); }} className="rounded-lg bg-blue-500 px-3 py-2 text-sm text-white">Send</button>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Actions */}
                        {notification.actions && (
                            <div className="mt-3 flex gap-2">
                                {notification.actions.map((action, i) => (
                                    <button key={i} onClick={() => action.action()} className={cn("rounded-lg px-3 py-1.5 text-sm font-medium", action.variant === "primary" ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300")}>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Hover Actions */}
            <AnimatePresence>
                {isHovered && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute right-2 top-2 flex gap-1 rounded-lg bg-white/90 p-1 shadow dark:bg-gray-800/90">
                        {!notification.read && <button onClick={() => onRead?.(notification.id)} className="p-1.5 text-gray-500 hover:text-blue-500"><Eye className="h-4 w-4" /></button>}
                        <button onClick={() => onPin?.(notification.id)} className={cn("p-1.5", notification.pinned ? "text-amber-500" : "text-gray-500")}><Pin className="h-4 w-4" /></button>
                        <button onClick={() => setShowReply(!showReply)} className="p-1.5 text-gray-500 hover:text-cyan-500"><Reply className="h-4 w-4" /></button>
                        <button onClick={() => onDismiss?.(notification.id)} className="p-1.5 text-gray-500 hover:text-red-500"><X className="h-4 w-4" /></button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Feedback */}
            <div className="flex items-center justify-between border-t px-4 py-2 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Helpful?</span>
                    <button onClick={() => setFeedback(feedback === "up" ? null : "up")} className={cn("p-1", feedback === "up" ? "text-green-500" : "text-gray-400")}><ThumbsUp className="h-4 w-4" /></button>
                    <button onClick={() => setFeedback(feedback === "down" ? null : "down")} className={cn("p-1", feedback === "down" ? "text-red-500" : "text-gray-400")}><ThumbsDown className="h-4 w-4" /></button>
                </div>
                <div className="flex gap-1">
                    <button className="p-1 text-gray-400 hover:text-blue-500"><Share2 className="h-4 w-4" /></button>
                    <button className="p-1 text-gray-400 hover:text-amber-500"><Bookmark className="h-4 w-4" /></button>
                </div>
            </div>
        </motion.div>
    );
}

// Notification List
interface NotificationListProps {
    notifications: InteractiveNotification[];
    onDismiss?: (id: string) => void;
    onRead?: (id: string) => void;
    onReadAll?: () => void;
    onPin?: (id: string) => void;
    onQuickReply?: (id: string, message: string) => void;
}

export function InteractiveNotificationList({ notifications, onDismiss, onRead, onReadAll, onPin, onQuickReply }: NotificationListProps) {
    const [filter, setFilter] = useState<"all" | "unread" | "pinned">("all");
    const unreadCount = notifications.filter((n) => !n.read).length;

    const filtered = notifications.filter((n) => {
        if (filter === "unread") return !n.read;
        if (filter === "pinned") return n.pinned;
        return true;
    }).sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    return (
        <div className="flex flex-col">
            <div className="flex items-center justify-between border-b px-4 py-3 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <Bell className="h-5 w-5 text-gray-600" />
                    <h3 className="font-semibold">Notifications</h3>
                    {unreadCount > 0 && <span className="rounded-full bg-blue-500 px-2 py-0.5 text-xs text-white">{unreadCount}</span>}
                </div>
                {unreadCount > 0 && onReadAll && <button onClick={onReadAll} className="text-sm text-blue-500">Mark all read</button>}
            </div>

            <div className="flex gap-2 border-b px-4 py-2 dark:border-gray-700">
                {(["all", "unread", "pinned"] as const).map((f) => (
                    <button key={f} onClick={() => setFilter(f)} className={cn("rounded-full px-3 py-1 text-sm", filter === f ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30" : "text-gray-600 hover:bg-gray-100")}>
                        {f.charAt(0).toUpperCase() + f.slice(1)}
                    </button>
                ))}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
                <AnimatePresence mode="popLayout">
                    {filtered.length > 0 ? filtered.map((n) => (
                        <InteractiveNotificationCard key={n.id} notification={n} onDismiss={onDismiss} onRead={onRead} onPin={onPin} onQuickReply={onQuickReply} />
                    )) : (
                        <div className="flex flex-col items-center py-12 text-center">
                            <Bell className="h-12 w-12 text-gray-300 mb-4" />
                            <p className="text-gray-500">No notifications</p>
                        </div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

export type { InteractiveNotification, NotificationAction, NotificationType };
