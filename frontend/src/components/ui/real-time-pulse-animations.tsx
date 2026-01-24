"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence, useAnimationControls } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Activity,
    ArrowUp,
    ArrowDown,
    Minus,
    RefreshCw,
    Wifi,
    WifiOff,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Circle,
} from "lucide-react";

// ============================================================================
// LIVE PULSE INDICATOR
// ============================================================================

interface LivePulseProps {
    isLive?: boolean;
    size?: "sm" | "md" | "lg";
    color?: "green" | "blue" | "purple" | "amber" | "red";
    showLabel?: boolean;
    className?: string;
}

const pulseColors = {
    green: {
        bg: "bg-green-500",
        glow: "shadow-green-500/50",
        ring: "ring-green-400/30",
    },
    blue: {
        bg: "bg-blue-500",
        glow: "shadow-blue-500/50",
        ring: "ring-blue-400/30",
    },
    purple: {
        bg: "bg-purple-500",
        glow: "shadow-purple-500/50",
        ring: "ring-purple-400/30",
    },
    amber: {
        bg: "bg-amber-500",
        glow: "shadow-amber-500/50",
        ring: "ring-amber-400/30",
    },
    red: {
        bg: "bg-red-500",
        glow: "shadow-red-500/50",
        ring: "ring-red-400/30",
    },
};

const pulseSizes = {
    sm: { dot: "h-2 w-2", ring: "h-4 w-4" },
    md: { dot: "h-3 w-3", ring: "h-6 w-6" },
    lg: { dot: "h-4 w-4", ring: "h-8 w-8" },
};

export function LivePulse({
    isLive = true,
    size = "md",
    color = "green",
    showLabel = true,
    className,
}: LivePulseProps) {
    const colors = pulseColors[color];
    const sizes = pulseSizes[size];

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <div className="relative flex items-center justify-center">
                {/* Pulsing ring */}
                {isLive && (
                    <motion.div
                        className={cn(
                            "absolute rounded-full",
                            colors.bg,
                            sizes.ring
                        )}
                        animate={{
                            scale: [1, 1.5, 1.5],
                            opacity: [0.5, 0, 0],
                        }}
                        transition={{
                            duration: 1.5,
                            repeat: Infinity,
                            ease: "easeOut",
                        }}
                    />
                )}
                {/* Static dot */}
                <div
                    className={cn(
                        "relative rounded-full shadow-lg",
                        colors.bg,
                        colors.glow,
                        sizes.dot,
                        !isLive && "opacity-50"
                    )}
                />
            </div>
            {showLabel && (
                <span
                    className={cn(
                        "text-xs font-medium",
                        isLive ? "text-green-600 dark:text-green-400" : "text-gray-500"
                    )}
                >
                    {isLive ? "Live" : "Offline"}
                </span>
            )}
        </div>
    );
}

// ============================================================================
// DATA UPDATE FLASH
// ============================================================================

interface DataUpdateFlashProps {
    value: string | number;
    previousValue?: string | number;
    format?: "number" | "currency" | "percentage";
    showChange?: boolean;
    flashColor?: "green" | "red" | "blue" | "auto";
    className?: string;
}

export function DataUpdateFlash({
    value,
    previousValue,
    format = "number",
    showChange = true,
    flashColor = "auto",
    className,
}: DataUpdateFlashProps) {
    const [isFlashing, setIsFlashing] = useState(false);
    const [displayValue, setDisplayValue] = useState(value);
    const [prevValue, setPrevValue] = useState(value);

    const formatValue = useCallback(
        (val: string | number) => {
            if (typeof val === "string") return val;
            switch (format) {
                case "currency":
                    return new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: "USD",
                    }).format(val);
                case "percentage":
                    return `${val.toFixed(1)}%`;
                default:
                    return new Intl.NumberFormat("en-US").format(val);
            }
        },
        [format]
    );

    useEffect(() => {
        if (value !== prevValue) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setIsFlashing(true);
            setDisplayValue(value);
            const timer = setTimeout(() => setIsFlashing(false), 1000);
            setPrevValue(value);
            return () => clearTimeout(timer);
        }
    }, [value, prevValue]);

    const direction = useMemo(() => {
        const current = typeof value === "number" ? value : parseFloat(String(value));
        const prev =
            previousValue !== undefined
                ? typeof previousValue === "number"
                    ? previousValue
                    : parseFloat(String(previousValue))
                : typeof prevValue === "number"
                    ? prevValue
                    : parseFloat(String(prevValue));

        if (isNaN(current) || isNaN(prev)) return "neutral";
        else if (current > prev) return "up";
        else if (current < prev) return "down";
        else return "neutral";
    }, [value, previousValue, prevValue]);

    const effectiveFlashColor =
        flashColor === "auto"
            ? direction === "up"
                ? "green"
                : direction === "down"
                    ? "red"
                    : "blue"
            : flashColor;

    const flashClasses = {
        green: "bg-green-500/20 text-green-600 dark:text-green-400",
        red: "bg-red-500/20 text-red-600 dark:text-red-400",
        blue: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
    };

    return (
        <div className={cn("relative inline-flex items-center gap-2", className)}>
            <motion.span
                className={cn(
                    "tabular-nums font-bold transition-colors duration-300 rounded px-1",
                    isFlashing && flashClasses[effectiveFlashColor]
                )}
                animate={
                    isFlashing
                        ? {
                            scale: [1, 1.05, 1],
                        }
                        : {}
                }
                transition={{ duration: 0.3 }}
            >
                {formatValue(displayValue)}
            </motion.span>

            {showChange && direction !== "neutral" && (
                <motion.span
                    initial={{ opacity: 0, y: direction === "up" ? 10 : -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                        "flex items-center text-xs font-medium",
                        direction === "up"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                    )}
                >
                    {direction === "up" ? (
                        <ArrowUp className="h-3 w-3" />
                    ) : (
                        <ArrowDown className="h-3 w-3" />
                    )}
                </motion.span>
            )}
        </div>
    );
}

// ============================================================================
// ANIMATED NUMBER COUNTER
// ============================================================================

interface AnimatedCounterProps {
    value: number;
    duration?: number;
    format?: "number" | "currency" | "percentage";
    className?: string;
    prefix?: string;
    suffix?: string;
}

export function AnimatedCounter({
    value,
    duration = 1000,
    format = "number",
    className,
    prefix = "",
    suffix = "",
}: AnimatedCounterProps) {
    const [displayValue, setDisplayValue] = useState(0);
    const startTimeRef = useRef<number | null>(null);
    const startValueRef = useRef(0);
    const animationRef = useRef<number>(0);

    useEffect(() => {
        startValueRef.current = displayValue;
        startTimeRef.current = null;

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) startTimeRef.current = timestamp;
            const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);

            // Easing function (ease-out cubic)
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = startValueRef.current + (value - startValueRef.current) * easeOut;

            setDisplayValue(current);

            if (progress < 1) {
                animationRef.current = requestAnimationFrame(animate);
            }
        };

        animationRef.current = requestAnimationFrame(animate);

        return () => cancelAnimationFrame(animationRef.current);
    }, [value, duration, displayValue]);

    const formatValue = (val: number) => {
        switch (format) {
            case "currency":
                return new Intl.NumberFormat("en-US", {
                    style: "currency",
                    currency: "USD",
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                }).format(Math.round(val));
            case "percentage":
                return `${val.toFixed(1)}%`;
            default:
                return new Intl.NumberFormat("en-US").format(Math.round(val));
        }
    };

    return (
        <span className={cn("tabular-nums font-bold", className)}>
            {prefix}
            {formatValue(displayValue)}
            {suffix}
        </span>
    );
}

// ============================================================================
// CONNECTION STATUS INDICATOR
// ============================================================================

type ConnectionStatus = "connected" | "connecting" | "disconnected" | "error";

interface ConnectionStatusProps {
    status: ConnectionStatus;
    showLabel?: boolean;
    className?: string;
}

const statusConfig: Record<
    ConnectionStatus,
    { icon: React.ReactNode; label: string; color: string }
> = {
    connected: {
        icon: <Wifi className="h-4 w-4" />,
        label: "Connected",
        color: "text-green-500",
    },
    connecting: {
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
        label: "Connecting...",
        color: "text-blue-500",
    },
    disconnected: {
        icon: <WifiOff className="h-4 w-4" />,
        label: "Disconnected",
        color: "text-gray-500",
    },
    error: {
        icon: <AlertTriangle className="h-4 w-4" />,
        label: "Connection Error",
        color: "text-red-500",
    },
};

export function ConnectionStatus({
    status,
    showLabel = true,
    className,
}: ConnectionStatusProps) {
    const config = statusConfig[status];

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <motion.div
                className={config.color}
                animate={status === "connecting" ? { rotate: 360 } : {}}
                transition={
                    status === "connecting"
                        ? { duration: 1, repeat: Infinity, ease: "linear" }
                        : {}
                }
            >
                {config.icon}
            </motion.div>
            {showLabel && (
                <span className={cn("text-sm font-medium", config.color)}>
                    {config.label}
                </span>
            )}
        </div>
    );
}

// ============================================================================
// LAST UPDATED INDICATOR
// ============================================================================

interface LastUpdatedProps {
    timestamp: Date | string | number;
    onRefresh?: () => void;
    isRefreshing?: boolean;
    className?: string;
}

export function LastUpdated({
    timestamp,
    onRefresh,
    isRefreshing = false,
    className,
}: LastUpdatedProps) {
    const [timeAgo, setTimeAgo] = useState("");
    const [isStale, setIsStale] = useState(false);

    useEffect(() => {
        const updateTimeAgo = () => {
            const date = new Date(timestamp);
            const now = new Date();
            const diffMs = now.getTime() - date.getTime();
            const diffSecs = Math.floor(diffMs / 1000);
            const diffMins = Math.floor(diffSecs / 60);
            const diffHours = Math.floor(diffMins / 60);

            setIsStale(diffMins > 5);

            if (diffSecs < 10) {
                setTimeAgo("Just now");
            } else if (diffSecs < 60) {
                setTimeAgo(`${diffSecs}s ago`);
            } else if (diffMins < 60) {
                setTimeAgo(`${diffMins}m ago`);
            } else if (diffHours < 24) {
                setTimeAgo(`${diffHours}h ago`);
            } else {
                setTimeAgo(date.toLocaleDateString());
            }
        };

        updateTimeAgo();
        const interval = setInterval(updateTimeAgo, 10000);
        return () => clearInterval(interval);
    }, [timestamp]);

    return (
        <div
            className={cn(
                "flex items-center gap-2 text-sm",
                isStale ? "text-amber-600 dark:text-amber-400" : "text-gray-500",
                className
            )}
        >
            <Clock className="h-4 w-4" />
            <span>Updated {timeAgo}</span>
            {onRefresh && (
                <motion.button
                    onClick={onRefresh}
                    disabled={isRefreshing}
                    className="rounded-full p-1 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                >
                    <RefreshCw
                        className={cn("h-4 w-4", isRefreshing && "animate-spin")}
                    />
                </motion.button>
            )}
        </div>
    );
}

// ============================================================================
// DATA SYNC STATUS
// ============================================================================

interface DataSyncStatusProps {
    sources: Array<{
        name: string;
        status: "synced" | "syncing" | "error" | "pending";
        lastSync?: Date | string;
    }>;
    className?: string;
}

const syncStatusIcons = {
    synced: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    syncing: <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />,
    error: <AlertTriangle className="h-4 w-4 text-red-500" />,
    pending: <Circle className="h-4 w-4 text-gray-400" />,
};

export function DataSyncStatus({ sources, className }: DataSyncStatusProps) {
    const syncedCount = sources.filter((s) => s.status === "synced").length;
    const hasErrors = sources.some((s) => s.status === "error");
    const isSyncing = sources.some((s) => s.status === "syncing");

    return (
        <div className={cn("space-y-2", className)}>
            {/* Summary */}
            <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Data Sources</span>
                <span
                    className={cn(
                        "font-medium",
                        hasErrors
                            ? "text-red-600"
                            : isSyncing
                                ? "text-blue-600"
                                : "text-green-600"
                    )}
                >
                    {syncedCount}/{sources.length} synced
                </span>
            </div>

            {/* Source list */}
            <div className="space-y-1">
                {sources.map((source) => (
                    <motion.div
                        key={source.name}
                        className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-800"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {source.name}
                        </span>
                        <div className="flex items-center gap-2">
                            {source.lastSync && source.status === "synced" && (
                                <span className="text-xs text-gray-500">
                                    {new Date(source.lastSync).toLocaleTimeString()}
                                </span>
                            )}
                            {syncStatusIcons[source.status]}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// REAL-TIME ACTIVITY FEED
// ============================================================================

interface ActivityItem {
    id: string;
    type: "update" | "create" | "delete" | "alert" | "sync";
    message: string;
    timestamp: Date | string;
    source?: string;
}

interface ActivityFeedProps {
    activities: ActivityItem[];
    maxItems?: number;
    className?: string;
}

const activityIcons = {
    update: <ArrowUp className="h-3 w-3 text-blue-500" />,
    create: <CheckCircle2 className="h-3 w-3 text-green-500" />,
    delete: <Minus className="h-3 w-3 text-red-500" />,
    alert: <AlertTriangle className="h-3 w-3 text-amber-500" />,
    sync: <RefreshCw className="h-3 w-3 text-purple-500" />,
};

export function ActivityFeed({
    activities,
    maxItems = 5,
    className,
}: ActivityFeedProps) {
    const displayedActivities = activities.slice(0, maxItems);

    return (
        <div className={cn("space-y-2", className)}>
            <AnimatePresence mode="popLayout">
                {displayedActivities.map((activity, index) => (
                    <motion.div
                        key={activity.id}
                        initial={{ opacity: 0, y: -20, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: "auto" }}
                        exit={{ opacity: 0, x: -20, height: 0 }}
                        transition={{ duration: 0.2, delay: index * 0.05 }}
                        className="flex items-start gap-3 rounded-lg bg-gray-50 p-3 dark:bg-gray-800"
                    >
                        <div className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-700">
                            {activityIcons[activity.type]}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-700 dark:text-gray-300 truncate">
                                {activity.message}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                                <span>{new Date(activity.timestamp).toLocaleTimeString()}</span>
                                {activity.source && (
                                    <>
                                        <span>•</span>
                                        <span>{activity.source}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// HEARTBEAT ANIMATION
// ============================================================================

interface HeartbeatProps {
    isActive?: boolean;
    interval?: number;
    className?: string;
}

export function Heartbeat({
    isActive = true,
    interval = 2000,
    className,
}: HeartbeatProps) {
    const controls = useAnimationControls();

    useEffect(() => {
        if (!isActive) return;

        const animate = () => {
            controls.start({
                scale: [1, 1.2, 1, 1.1, 1],
                transition: { duration: 0.8 },
            });
        };

        animate();
        const timer = setInterval(animate, interval);
        return () => clearInterval(timer);
    }, [isActive, interval, controls]);

    return (
        <motion.div animate={controls} className={cn("text-red-500", className)}>
            <Activity className="h-5 w-5" />
        </motion.div>
    );
}

// ============================================================================
// TYPING INDICATOR
// ============================================================================

interface TypingIndicatorProps {
    isTyping: boolean;
    names?: string[];
    className?: string;
}

export function TypingIndicator({
    isTyping,
    names = [],
    className,
}: TypingIndicatorProps) {
    if (!isTyping) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn("flex items-center gap-2 text-sm text-gray-500", className)}
        >
            <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                    <motion.div
                        key={i}
                        className="h-2 w-2 rounded-full bg-gray-400"
                        animate={{
                            y: [0, -5, 0],
                        }}
                        transition={{
                            duration: 0.6,
                            repeat: Infinity,
                            delay: i * 0.1,
                        }}
                    />
                ))}
            </div>
            <span>
                {names.length > 0
                    ? `${names.join(", ")} ${names.length === 1 ? "is" : "are"} typing...`
                    : "Someone is typing..."}
            </span>
        </motion.div>
    );
}
