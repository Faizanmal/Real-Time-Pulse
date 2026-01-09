"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence, PanInfo, useMotionValue, useTransform } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Copy, Trash2, Edit3, Download, Share2, Pin,
    ChevronRight, Bookmark, Archive,
    RefreshCw, Maximize2, Lock,
    ZoomIn, ZoomOut, RotateCw, Hand,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface ContextMenuItem {
    id: string;
    label: string;
    icon?: React.ReactNode;
    shortcut?: string;
    disabled?: boolean;
    danger?: boolean;
    divider?: boolean;
    submenu?: ContextMenuItem[];
    action?: () => void;
}

interface ContextMenuPosition {
    x: number;
    y: number;
}

// ============================================================================
// CONTEXT MENU
// ============================================================================

interface ContextMenuProps {
    items: ContextMenuItem[];
    position: ContextMenuPosition;
    onClose: () => void;
    className?: string;
}

export function ContextMenu({ items, position, onClose, className }: ContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);
    const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    // Adjust position to stay within viewport
    useEffect(() => {
        if (!menuRef.current) return;

        const rect = menuRef.current.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        let x = position.x;
        let y = position.y;

        if (position.x + rect.width > viewportWidth) {
            x = viewportWidth - rect.width - 10;
        }
        if (position.y + rect.height > viewportHeight) {
            y = viewportHeight - rect.height - 10;
        }

        setAdjustedPosition({ x, y });
    }, [position]);

    // Close on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };

        document.addEventListener("mousedown", handleClick);
        document.addEventListener("keydown", handleEscape);
        return () => {
            document.removeEventListener("mousedown", handleClick);
            document.removeEventListener("keydown", handleEscape);
        };
    }, [onClose]);

    const handleItemClick = useCallback((item: ContextMenuItem) => {
        if (item.disabled || item.submenu) return;
        item.action?.();
        onClose();
    }, [onClose]);

    return (
        <motion.div
            ref={menuRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.1 }}
            className={cn(
                "fixed z-[9999] min-w-[200px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800",
                className
            )}
            style={{ left: adjustedPosition.x, top: adjustedPosition.y }}
        >
            {items.map((item) => (
                <div key={item.id}>
                    {item.divider ? (
                        <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                    ) : (
                        <div
                            className="relative"
                            onMouseEnter={() => item.submenu && setActiveSubmenu(item.id)}
                            onMouseLeave={() => item.submenu && setActiveSubmenu(null)}
                        >
                            <button
                                onClick={() => handleItemClick(item)}
                                disabled={item.disabled}
                                className={cn(
                                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm transition-colors",
                                    item.disabled
                                        ? "cursor-not-allowed text-gray-400"
                                        : item.danger
                                            ? "text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                            : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                )}
                            >
                                {item.icon && <span className="w-4">{item.icon}</span>}
                                <span className="flex-1">{item.label}</span>
                                {item.shortcut && (
                                    <span className="text-xs text-gray-400">{item.shortcut}</span>
                                )}
                                {item.submenu && <ChevronRight className="h-4 w-4 text-gray-400" />}
                            </button>

                            {/* Submenu */}
                            <AnimatePresence>
                                {item.submenu && activeSubmenu === item.id && (
                                    <motion.div
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -10 }}
                                        className="absolute left-full top-0 ml-1 min-w-[180px] overflow-hidden rounded-xl border border-gray-200 bg-white py-1 shadow-xl dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        {item.submenu.map((subItem) => (
                                            <button
                                                key={subItem.id}
                                                onClick={() => {
                                                    subItem.action?.();
                                                    onClose();
                                                }}
                                                disabled={subItem.disabled}
                                                className={cn(
                                                    "flex w-full items-center gap-3 px-3 py-2 text-left text-sm",
                                                    subItem.disabled
                                                        ? "cursor-not-allowed text-gray-400"
                                                        : "text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                                                )}
                                            >
                                                {subItem.icon && <span className="w-4">{subItem.icon}</span>}
                                                <span className="flex-1">{subItem.label}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            ))}
        </motion.div>
    );
}

// ============================================================================
// CONTEXT MENU TRIGGER
// ============================================================================

interface ContextMenuTriggerProps {
    items: ContextMenuItem[];
    children: React.ReactNode;
    disabled?: boolean;
    className?: string;
}

export function ContextMenuTrigger({
    items,
    children,
    disabled = false,
    className,
}: ContextMenuTriggerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [position, setPosition] = useState<ContextMenuPosition>({ x: 0, y: 0 });

    const handleContextMenu = useCallback((e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        setPosition({ x: e.clientX, y: e.clientY });
        setIsOpen(true);
    }, [disabled]);

    return (
        <>
            <div onContextMenu={handleContextMenu} className={className}>
                {children}
            </div>
            <AnimatePresence>
                {isOpen && (
                    <ContextMenu
                        items={items}
                        position={position}
                        onClose={() => setIsOpen(false)}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

// ============================================================================
// QUICK ACTIONS MENU BUILDER
// ============================================================================

interface QuickActionsConfig {
    onCopy?: () => void;
    onEdit?: () => void;
    onDelete?: () => void;
    onShare?: () => void;
    onDownload?: () => void;
    onPin?: () => void;
    onBookmark?: () => void;
    onArchive?: () => void;
    onRefresh?: () => void;
    onFullscreen?: () => void;
    onLock?: () => void;
    customActions?: ContextMenuItem[];
}

export function buildQuickActions(config: QuickActionsConfig): ContextMenuItem[] {
    const items: ContextMenuItem[] = [];

    if (config.onCopy) {
        items.push({ id: "copy", label: "Copy", icon: <Copy className="h-4 w-4" />, shortcut: "⌘C", action: config.onCopy });
    }
    if (config.onEdit) {
        items.push({ id: "edit", label: "Edit", icon: <Edit3 className="h-4 w-4" />, shortcut: "E", action: config.onEdit });
    }
    if (config.onShare) {
        items.push({ id: "share", label: "Share", icon: <Share2 className="h-4 w-4" />, action: config.onShare });
    }
    if (config.onDownload) {
        items.push({ id: "download", label: "Download", icon: <Download className="h-4 w-4" />, shortcut: "⌘S", action: config.onDownload });
    }

    if (items.length > 0 && (config.onPin || config.onBookmark || config.onArchive)) {
        items.push({ id: "divider1", label: "", divider: true });
    }

    if (config.onPin) {
        items.push({ id: "pin", label: "Pin", icon: <Pin className="h-4 w-4" />, action: config.onPin });
    }
    if (config.onBookmark) {
        items.push({ id: "bookmark", label: "Bookmark", icon: <Bookmark className="h-4 w-4" />, action: config.onBookmark });
    }
    if (config.onArchive) {
        items.push({ id: "archive", label: "Archive", icon: <Archive className="h-4 w-4" />, action: config.onArchive });
    }

    if (config.onRefresh || config.onFullscreen || config.onLock) {
        items.push({ id: "divider2", label: "", divider: true });
    }

    if (config.onRefresh) {
        items.push({ id: "refresh", label: "Refresh", icon: <RefreshCw className="h-4 w-4" />, shortcut: "R", action: config.onRefresh });
    }
    if (config.onFullscreen) {
        items.push({ id: "fullscreen", label: "Fullscreen", icon: <Maximize2 className="h-4 w-4" />, shortcut: "F", action: config.onFullscreen });
    }
    if (config.onLock) {
        items.push({ id: "lock", label: "Lock", icon: <Lock className="h-4 w-4" />, action: config.onLock });
    }

    if (config.customActions) {
        items.push({ id: "divider3", label: "", divider: true });
        items.push(...config.customActions);
    }

    if (config.onDelete) {
        items.push({ id: "divider4", label: "", divider: true });
        items.push({ id: "delete", label: "Delete", icon: <Trash2 className="h-4 w-4" />, danger: true, shortcut: "⌫", action: config.onDelete });
    }

    return items;
}

// ============================================================================
// GESTURE HANDLER
// ============================================================================

interface GestureConfig {
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    onSwipeUp?: () => void;
    onSwipeDown?: () => void;
    onPinch?: (scale: number) => void;
    onRotate?: (angle: number) => void;
    onDoubleTap?: () => void;
    onLongPress?: () => void;
    threshold?: number;
}

interface GestureHandlerProps extends GestureConfig {
    children: React.ReactNode;
    className?: string;
}

export function GestureHandler({
    children,
    onSwipeLeft,
    onSwipeRight,
    onSwipeUp,
    onSwipeDown,
    onDoubleTap,
    onLongPress,
    threshold = 50,
    className,
}: GestureHandlerProps) {
    const lastTapRef = useRef<number>(0);
    const longPressRef = useRef<NodeJS.Timeout | null>(null);
    const [gesture, setGesture] = useState<string | null>(null);

    const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        const { offset, velocity } = info;

        // Determine swipe direction
        if (Math.abs(offset.x) > Math.abs(offset.y)) {
            if (offset.x > threshold && velocity.x > 0) {
                onSwipeRight?.();
                setGesture("swipe-right");
            } else if (offset.x < -threshold && velocity.x < 0) {
                onSwipeLeft?.();
                setGesture("swipe-left");
            }
        } else {
            if (offset.y > threshold && velocity.y > 0) {
                onSwipeDown?.();
                setGesture("swipe-down");
            } else if (offset.y < -threshold && velocity.y < 0) {
                onSwipeUp?.();
                setGesture("swipe-up");
            }
        }

        // Clear gesture indicator
        setTimeout(() => setGesture(null), 300);
    }, [threshold, onSwipeLeft, onSwipeRight, onSwipeUp, onSwipeDown]);

    const handleTap = useCallback(() => {
        const now = Date.now();
        if (now - lastTapRef.current < 300) {
            onDoubleTap?.();
            setGesture("double-tap");
            setTimeout(() => setGesture(null), 300);
        }
        lastTapRef.current = now;
    }, [onDoubleTap]);

    const handlePointerDown = useCallback(() => {
        if (onLongPress) {
            longPressRef.current = setTimeout(() => {
                onLongPress();
                setGesture("long-press");
                setTimeout(() => setGesture(null), 300);
            }, 500);
        }
    }, [onLongPress]);

    const handlePointerUp = useCallback(() => {
        if (longPressRef.current) {
            clearTimeout(longPressRef.current);
            longPressRef.current = null;
        }
    }, []);

    return (
        <motion.div
            drag
            dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
            dragElastic={0.1}
            onDragEnd={handleDragEnd}
            onTap={handleTap}
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerLeave={handlePointerUp}
            className={cn("relative touch-pan-y", className)}
        >
            {children}

            {/* Gesture feedback indicator */}
            <AnimatePresence>
                {gesture && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5 }}
                        className="pointer-events-none absolute inset-0 flex items-center justify-center"
                    >
                        <div className="rounded-xl bg-black/70 px-4 py-2 text-sm font-medium text-white">
                            {gesture.replace("-", " ").toUpperCase()}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

// ============================================================================
// SWIPEABLE CARD
// ============================================================================

interface SwipeableCardProps {
    children: React.ReactNode;
    onSwipeLeft?: () => void;
    onSwipeRight?: () => void;
    leftAction?: { label: string; color: string; icon?: React.ReactNode };
    rightAction?: { label: string; color: string; icon?: React.ReactNode };
    className?: string;
}

export function SwipeableCard({
    children,
    onSwipeLeft,
    onSwipeRight,
    leftAction = { label: "Archive", color: "bg-amber-500" },
    rightAction = { label: "Delete", color: "bg-red-500" },
    className,
}: SwipeableCardProps) {
    const [_isDragging, setIsDragging] = useState(false);
    const x = useMotionValue(0);

    const leftOpacity = useTransform(x, [-100, 0], [1, 0]);
    const rightOpacity = useTransform(x, [0, 100], [0, 1]);
    const scale = useTransform(x, [-100, 0, 100], [0.95, 1, 0.95]);

    const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
        setIsDragging(false);
        if (info.offset.x > 100) {
            onSwipeRight?.();
        } else if (info.offset.x < -100) {
            onSwipeLeft?.();
        }
    }, [onSwipeLeft, onSwipeRight]);

    return (
        <div className={cn("relative overflow-hidden rounded-xl", className)}>
            {/* Left action background */}
            <motion.div
                className={cn("absolute inset-y-0 left-0 flex w-24 items-center justify-center", leftAction.color)}
                style={{ opacity: leftOpacity }}
            >
                {leftAction.icon || <Archive className="h-6 w-6 text-white" />}
            </motion.div>

            {/* Right action background */}
            <motion.div
                className={cn("absolute inset-y-0 right-0 flex w-24 items-center justify-center", rightAction.color)}
                style={{ opacity: rightOpacity }}
            >
                {rightAction.icon || <Trash2 className="h-6 w-6 text-white" />}
            </motion.div>

            {/* Card content */}
            <motion.div
                drag="x"
                dragConstraints={{ left: -150, right: 150 }}
                dragElastic={0.1}
                onDragStart={() => setIsDragging(true)}
                onDragEnd={handleDragEnd}
                style={{ x, scale }}
                className="relative cursor-grab active:cursor-grabbing"
            >
                {children}
            </motion.div>
        </div>
    );
}

// ============================================================================
// ZOOM PAN CONTAINER
// ============================================================================

interface ZoomPanContainerProps {
    children: React.ReactNode;
    minZoom?: number;
    maxZoom?: number;
    initialZoom?: number;
    showControls?: boolean;
    className?: string;
}

export function ZoomPanContainer({
    children,
    minZoom = 0.5,
    maxZoom = 3,
    initialZoom = 1,
    showControls = true,
    className,
}: ZoomPanContainerProps) {
    const [zoom, setZoom] = useState(initialZoom);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleWheel = useCallback((e: React.WheelEvent) => {
        if (e.ctrlKey) {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom((z) => Math.max(minZoom, Math.min(maxZoom, z + delta)));
        }
    }, [minZoom, maxZoom]);

    const handleZoomIn = useCallback(() => {
        setZoom((z) => Math.min(maxZoom, z + 0.25));
    }, [maxZoom]);

    const handleZoomOut = useCallback(() => {
        setZoom((z) => Math.max(minZoom, z - 0.25));
    }, [minZoom]);

    const handleReset = useCallback(() => {
        setZoom(1);
        setPan({ x: 0, y: 0 });
    }, []);

    return (
        <div
            ref={containerRef}
            className={cn("relative overflow-hidden", className)}
            onWheel={handleWheel}
        >
            {/* Controls */}
            {showControls && (
                <div className="absolute right-4 top-4 z-10 flex flex-col gap-1 rounded-xl bg-white/90 p-1 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
                    <button
                        onClick={handleZoomIn}
                        className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Zoom In"
                    >
                        <ZoomIn className="h-4 w-4" />
                    </button>
                    <div className="px-2 text-center text-xs font-medium text-gray-500">
                        {Math.round(zoom * 100)}%
                    </div>
                    <button
                        onClick={handleZoomOut}
                        className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Zoom Out"
                    >
                        <ZoomOut className="h-4 w-4" />
                    </button>
                    <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
                    <button
                        onClick={handleReset}
                        className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Reset"
                    >
                        <RotateCw className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setIsPanning(!isPanning)}
                        className={cn(
                            "rounded-lg p-2",
                            isPanning ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30" : "hover:bg-gray-100 dark:hover:bg-gray-700"
                        )}
                        title="Pan Mode"
                    >
                        <Hand className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* Zoomable/Pannable content */}
            <motion.div
                drag={isPanning}
                dragMomentum={false}
                style={{ scale: zoom, x: pan.x, y: pan.y }}
                onDrag={(_, info) => setPan({ x: info.point.x, y: info.point.y })}
                className={cn("origin-center", isPanning && "cursor-grab active:cursor-grabbing")}
            >
                {children}
            </motion.div>
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { ContextMenuItem, ContextMenuPosition, GestureConfig, QuickActionsConfig };
