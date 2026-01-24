"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Users, MessageSquare, Eye, MousePointer2,
    UserPlus, Crown, Shield,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Collaborator {
    id: string;
    name: string;
    avatar?: string;
    color: string;
    status: "online" | "away" | "busy" | "offline";
    lastSeen?: Date;
    role?: "owner" | "admin" | "member" | "viewer";
    cursor?: { x: number; y: number };
    isTyping?: boolean;
    currentPage?: string;
}

interface CursorPosition {
    x: number;
    y: number;
    userId: string;
}

// ============================================================================
// COLLABORATOR COLORS
// ============================================================================

const collaboratorColors = [
    "#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b",
    "#ef4444", "#06b6d4", "#f97316", "#84cc16", "#a855f7",
];

const _getColorForUser = (userId: string): string => {
    const hash = userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return collaboratorColors[hash % collaboratorColors.length];
};

// ============================================================================
// LIVE CURSORS
// ============================================================================

interface LiveCursorProps {
    collaborator: Collaborator;
    position: { x: number; y: number };
    showLabel?: boolean;
}

export function LiveCursor({ collaborator, position, showLabel = true }: LiveCursorProps) {
    return (
        <motion.div
            className="pointer-events-none fixed z-9999"
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{
                opacity: 1,
                scale: 1,
                x: position.x,
                y: position.y,
            }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ type: "spring", damping: 30, stiffness: 500 }}
        >
            {/* Cursor Icon */}
            <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }}
            >
                <path
                    d="M5.5 3.21V20.79c0 .45.54.67.85.35l4.36-4.57h6.93c.4 0 .62-.47.35-.8L6.35 2.85c-.31-.38-.85-.17-.85.36z"
                    fill={collaborator.color}
                    stroke="white"
                    strokeWidth="1.5"
                />
            </svg>

            {/* Name Label */}
            {showLabel && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="absolute left-4 top-4 flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-medium text-white shadow-lg"
                    style={{ backgroundColor: collaborator.color }}
                >
                    {collaborator.avatar ? (
                        <Image src={collaborator.avatar} alt="" width={16} height={16} className="h-4 w-4 rounded-full" />
                    ) : null}
                    <span>{collaborator.name}</span>
                    {collaborator.isTyping && (
                        <span className="flex gap-0.5">
                            {[0, 1, 2].map((i) => (
                                <motion.span
                                    key={i}
                                    className="h-1 w-1 rounded-full bg-white"
                                    animate={{ y: [0, -3, 0] }}
                                    transition={{ duration: 0.4, repeat: Infinity, delay: i * 0.1 }}
                                />
                            ))}
                        </span>
                    )}
                </motion.div>
            )}
        </motion.div>
    );
}

// ============================================================================
// LIVE CURSORS CONTAINER
// ============================================================================

interface LiveCursorsContainerProps {
    collaborators: Collaborator[];
    currentUserId: string;
}

export function LiveCursorsContainer({ collaborators, currentUserId }: LiveCursorsContainerProps) {
    const otherCollaborators = collaborators.filter(
        (c) => c.id !== currentUserId && c.cursor && c.status === "online"
    );

    return (
        <AnimatePresence>
            {otherCollaborators.map((collaborator) => (
                collaborator.cursor && (
                    <LiveCursor
                        key={collaborator.id}
                        collaborator={collaborator}
                        position={collaborator.cursor}
                    />
                )
            ))}
        </AnimatePresence>
    );
}

// ============================================================================
// PRESENCE INDICATOR
// ============================================================================

interface PresenceIndicatorProps {
    collaborators: Collaborator[];
    maxVisible?: number;
    size?: "sm" | "md" | "lg";
    showCount?: boolean;
    onViewAll?: () => void;
}

const sizeClasses = {
    sm: { avatar: "h-6 w-6 text-xs", overlap: "-ml-1.5" },
    md: { avatar: "h-8 w-8 text-sm", overlap: "-ml-2" },
    lg: { avatar: "h-10 w-10 text-base", overlap: "-ml-3" },
};

const statusColors = {
    online: "bg-green-500",
    away: "bg-amber-500",
    busy: "bg-red-500",
    offline: "bg-gray-400",
};

export function PresenceIndicator({
    collaborators,
    maxVisible = 5,
    size = "md",
    showCount = true,
    onViewAll,
}: PresenceIndicatorProps) {
    const onlineCollaborators = collaborators.filter((c) => c.status !== "offline");
    const visibleCollaborators = onlineCollaborators.slice(0, maxVisible);
    const remainingCount = onlineCollaborators.length - maxVisible;
    const classes = sizeClasses[size];

    return (
        <div className="flex items-center">
            <div className="flex">
                {visibleCollaborators.map((collaborator, index) => (
                    <motion.div
                        key={collaborator.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                            "relative rounded-full border-2 border-white dark:border-gray-800",
                            index > 0 && classes.overlap
                        )}
                        title={`${collaborator.name} (${collaborator.status})`}
                    >
                        {collaborator.avatar ? (
                            <Image
                                src={collaborator.avatar}
                                alt={collaborator.name}
                                width={32}
                                height={32}
                                className={cn("rounded-full object-cover", classes.avatar)}
                            />
                        ) : (
                            <div
                                className={cn(
                                    "flex items-center justify-center rounded-full font-medium text-white",
                                    classes.avatar
                                )}
                                style={{ backgroundColor: collaborator.color }}
                            >
                                {collaborator.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        {/* Status dot */}
                        <span
                            className={cn(
                                "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white dark:border-gray-800",
                                statusColors[collaborator.status]
                            )}
                        />
                        {/* Role badge */}
                        {collaborator.role === "owner" && (
                            <Crown className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                        )}
                    </motion.div>
                ))}

                {/* Remaining count */}
                {remainingCount > 0 && (
                    <motion.button
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: maxVisible * 0.05 }}
                        onClick={onViewAll}
                        className={cn(
                            "flex items-center justify-center rounded-full bg-gray-200 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300",
                            classes.avatar,
                            classes.overlap
                        )}
                    >
                        +{remainingCount}
                    </motion.button>
                )}
            </div>

            {showCount && (
                <div className="ml-3 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <Users className="h-4 w-4" />
                    <span>{onlineCollaborators.length} online</span>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// COLLABORATOR PANEL
// ============================================================================

interface CollaboratorPanelProps {
    collaborators: Collaborator[];
    currentUserId: string;
    onInvite?: () => void;
    onMessageUser?: (userId: string) => void;
    onFollowUser?: (userId: string) => void;
}

export function CollaboratorPanel({
    collaborators,
    currentUserId,
    onInvite,
    onMessageUser,
    onFollowUser,
}: CollaboratorPanelProps) {
    const [filter, setFilter] = useState<"all" | "online">("all");

    const filteredCollaborators = collaborators.filter((c) => {
        if (filter === "online") return c.status !== "offline";
        return true;
    });

    const sortedCollaborators = [...filteredCollaborators].sort((a, b) => {
        // Current user first
        if (a.id === currentUserId) return -1;
        if (b.id === currentUserId) return 1;
        // Then by status
        const statusOrder = { online: 0, away: 1, busy: 2, offline: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
    });

    return (
        <div className="rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800">
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                    <Users className="h-5 w-5 text-purple-500" />
                    Collaborators
                </h3>
                {onInvite && (
                    <button
                        onClick={onInvite}
                        className="flex items-center gap-1 rounded-lg bg-purple-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-purple-600"
                    >
                        <UserPlus className="h-4 w-4" />
                        Invite
                    </button>
                )}
            </div>

            {/* Filter tabs */}
            <div className="mb-4 flex gap-2">
                {(["all", "online"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setFilter(f)}
                        className={cn(
                            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
                            filter === f
                                ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                        )}
                    >
                        {f === "all" ? "All" : "Online"}
                        <span className="ml-1 text-xs opacity-70">
                            ({f === "all" ? collaborators.length : collaborators.filter((c) => c.status !== "offline").length})
                        </span>
                    </button>
                ))}
            </div>

            {/* Collaborator list */}
            <div className="space-y-2">
                {sortedCollaborators.map((collaborator) => (
                    <motion.div
                        key={collaborator.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "flex items-center justify-between rounded-xl p-3 transition-colors",
                            collaborator.id === currentUserId
                                ? "bg-purple-50 dark:bg-purple-900/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        )}
                    >
                        <div className="flex items-center gap-3">
                            {/* Avatar */}
                            <div className="relative">
                                {collaborator.avatar ? (
                                    <Image
                                        src={collaborator.avatar}
                                        alt={collaborator.name}
                                        width={40}
                                        height={40}
                                        className="h-10 w-10 rounded-full object-cover"
                                    />
                                ) : (
                                    <div
                                        className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium text-white"
                                        style={{ backgroundColor: collaborator.color }}
                                    >
                                        {collaborator.name.charAt(0).toUpperCase()}
                                    </div>
                                )}
                                <span
                                    className={cn(
                                        "absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white dark:border-gray-800",
                                        statusColors[collaborator.status]
                                    )}
                                />
                            </div>

                            {/* Info */}
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-900 dark:text-gray-100">
                                        {collaborator.name}
                                    </span>
                                    {collaborator.id === currentUserId && (
                                        <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                                            You
                                        </span>
                                    )}
                                    {collaborator.role === "owner" && (
                                        <Crown className="h-4 w-4 text-amber-500" />
                                    )}
                                    {collaborator.role === "admin" && (
                                        <Shield className="h-4 w-4 text-blue-500" />
                                    )}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-gray-500">
                                    <span className="capitalize">{collaborator.status}</span>
                                    {collaborator.currentPage && collaborator.status === "online" && (
                                        <>
                                            <span>•</span>
                                            <span className="flex items-center gap-1">
                                                <Eye className="h-3 w-3" />
                                                {collaborator.currentPage}
                                            </span>
                                        </>
                                    )}
                                    {collaborator.isTyping && (
                                        <>
                                            <span>•</span>
                                            <span className="text-purple-500">typing...</span>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        {collaborator.id !== currentUserId && collaborator.status !== "offline" && (
                            <div className="flex gap-1">
                                {onMessageUser && (
                                    <button
                                        onClick={() => onMessageUser(collaborator.id)}
                                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-purple-500 dark:hover:bg-gray-700"
                                        title="Send message"
                                    >
                                        <MessageSquare className="h-4 w-4" />
                                    </button>
                                )}
                                {onFollowUser && (
                                    <button
                                        onClick={() => onFollowUser(collaborator.id)}
                                        className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-blue-500 dark:hover:bg-gray-700"
                                        title="Follow cursor"
                                    >
                                        <MousePointer2 className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// CURSOR BROADCAST HOOK
// ============================================================================

interface UseCursorBroadcastOptions {
    userId: string;
    onCursorMove?: (position: CursorPosition) => void;
    throttleMs?: number;
    enabled?: boolean;
}

export function useCursorBroadcast({
    userId,
    onCursorMove,
    throttleMs = 50,
    enabled = true,
}: UseCursorBroadcastOptions) {
    const lastBroadcastRef = useRef<number>(0);

    useEffect(() => {
        if (!enabled || !onCursorMove) return;

        const handleMouseMove = (e: MouseEvent) => {
            const now = Date.now();
            if (now - lastBroadcastRef.current < throttleMs) return;

            lastBroadcastRef.current = now;
            onCursorMove({
                x: e.clientX,
                y: e.clientY,
                userId,
            });
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, [userId, onCursorMove, throttleMs, enabled]);
}

// ============================================================================
// ACTIVITY RING
// ============================================================================

interface ActivityRingProps {
    collaborators: Collaborator[];
    size?: number;
}

export function ActivityRing({ collaborators, size = 120 }: ActivityRingProps) {
    const onlineCount = collaborators.filter((c) => c.status === "online").length;
    const awayCount = collaborators.filter((c) => c.status === "away").length;
    const busyCount = collaborators.filter((c) => c.status === "busy").length;
    const total = collaborators.length;

    const radius = size / 2 - 10;
    const circumference = 2 * Math.PI * radius;

    const segments = [
        { count: onlineCount, color: "#22c55e", label: "Online" },
        { count: awayCount, color: "#f59e0b", label: "Away" },
        { count: busyCount, color: "#ef4444", label: "Busy" },
    ];

    let currentOffset = 0;

    return (
        <div className="relative inline-flex items-center justify-center">
            <svg width={size} height={size} className="-rotate-90">
                {/* Background ring */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    className="text-gray-200 dark:text-gray-700"
                />
                {/* Segments */}
                {segments.map((segment, index) => {
                    const segmentLength = (segment.count / total) * circumference;
                    const offset = currentOffset;
                    currentOffset += segmentLength;

                    return (
                        <motion.circle
                            key={index}
                            cx={size / 2}
                            cy={size / 2}
                            r={radius}
                            fill="none"
                            stroke={segment.color}
                            strokeWidth="8"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference - segmentLength}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: circumference - segmentLength }}
                            transition={{ duration: 1, delay: index * 0.2 }}
                            style={{
                                transform: `rotate(${(offset / circumference) * 360}deg)`,
                                transformOrigin: "center",
                            }}
                        />
                    );
                })}
            </svg>
            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    {onlineCount}
                </span>
                <span className="text-xs text-gray-500">online</span>
            </div>
        </div>
    );
}

// ============================================================================
// TYPING AWARENESS
// ============================================================================

interface TypingAwarenessProps {
    typingUsers: Collaborator[];
    context?: string;
}

export function TypingAwareness({ typingUsers, context }: TypingAwarenessProps) {
    if (typingUsers.length === 0) return null;

    const getMessage = () => {
        if (typingUsers.length === 1) {
            return `${typingUsers[0].name} is typing${context ? ` in ${context}` : ""}...`;
        }
        if (typingUsers.length === 2) {
            return `${typingUsers[0].name} and ${typingUsers[1].name} are typing...`;
        }
        return `${typingUsers[0].name} and ${typingUsers.length - 1} others are typing...`;
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex items-center gap-2 text-sm text-gray-500"
        >
            <div className="flex -space-x-1">
                {typingUsers.slice(0, 3).map((user) => (
                    <div
                        key={user.id}
                        className="h-5 w-5 rounded-full border-2 border-white dark:border-gray-800"
                        style={{ backgroundColor: user.color }}
                    />
                ))}
            </div>
            <span>{getMessage()}</span>
            <div className="flex gap-0.5">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="h-1.5 w-1.5 rounded-full bg-gray-400"
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.15 }}
                    />
                ))}
            </div>
        </motion.div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { Collaborator, CursorPosition };
