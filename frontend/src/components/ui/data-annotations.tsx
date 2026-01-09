"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
    MessageSquare, Pin, Flag, AlertTriangle, CheckCircle2, Info,
    X, Send, Edit2, Trash2, MoreHorizontal,
    ThumbsUp, Reply, Link2, Calendar, TrendingUp,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

type AnnotationType = "comment" | "pin" | "flag" | "alert" | "success" | "info";

interface Annotation {
    id: string;
    type: AnnotationType;
    content: string;
    author: {
        id: string;
        name: string;
        avatar?: string;
    };
    position: { x: number; y: number };
    dataPoint?: {
        label: string;
        value: number | string;
        date?: Date;
    };
    timestamp: Date;
    resolved?: boolean;
    replies?: AnnotationReply[];
    likes?: number;
    mentions?: string[];
    attachments?: { type: string; url: string; name: string }[];
}

interface AnnotationReply {
    id: string;
    content: string;
    author: {
        id: string;
        name: string;
        avatar?: string;
    };
    timestamp: Date;
}

// ============================================================================
// ANNOTATION MARKER
// ============================================================================

interface AnnotationMarkerProps {
    annotation: Annotation;
    isSelected?: boolean;
    onClick?: () => void;
    onHover?: (isHovering: boolean) => void;
    className?: string;
}

const annotationIcons: Record<AnnotationType, React.ReactNode> = {
    comment: <MessageSquare className="h-3 w-3" />,
    pin: <Pin className="h-3 w-3" />,
    flag: <Flag className="h-3 w-3" />,
    alert: <AlertTriangle className="h-3 w-3" />,
    success: <CheckCircle2 className="h-3 w-3" />,
    info: <Info className="h-3 w-3" />,
};

const annotationColors: Record<AnnotationType, string> = {
    comment: "bg-blue-500 border-blue-600",
    pin: "bg-amber-500 border-amber-600",
    flag: "bg-red-500 border-red-600",
    alert: "bg-orange-500 border-orange-600",
    success: "bg-green-500 border-green-600",
    info: "bg-purple-500 border-purple-600",
};

export function AnnotationMarker({
    annotation,
    isSelected = false,
    onClick,
    onHover,
    className,
}: AnnotationMarkerProps) {
    return (
        <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClick}
            onMouseEnter={() => onHover?.(true)}
            onMouseLeave={() => onHover?.(false)}
            className={cn(
                "absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-white shadow-lg transition-shadow",
                annotationColors[annotation.type],
                isSelected && "ring-4 ring-white/50",
                annotation.resolved && "opacity-50",
                className
            )}
            style={{ left: `${annotation.position.x}%`, top: `${annotation.position.y}%` }}
        >
            {annotationIcons[annotation.type]}

            {/* Reply indicator */}
            {annotation.replies && annotation.replies.length > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-bold text-gray-900 shadow">
                    {annotation.replies.length}
                </span>
            )}
        </motion.button>
    );
}

// ============================================================================
// ANNOTATION TOOLTIP
// ============================================================================

interface AnnotationTooltipProps {
    annotation: Annotation;
    position: { x: number; y: number };
    onClose: () => void;
    onReply?: (content: string) => void;
    onResolve?: () => void;
    onDelete?: () => void;
    onEdit?: (content: string) => void;
    currentUserId?: string;
    className?: string;
}

export function AnnotationTooltip({
    annotation,
    position,
    onClose,
    onReply,
    onResolve,
    onDelete,
    onEdit,
    currentUserId,
    className,
}: AnnotationTooltipProps) {
    const [isReplying, setIsReplying] = useState(false);
    const [replyContent, setReplyContent] = useState("");
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(annotation.content);
    const [showMenu, setShowMenu] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    const isOwner = currentUserId === annotation.author.id;

    const handleReply = useCallback(() => {
        if (replyContent.trim()) {
            onReply?.(replyContent.trim());
            setReplyContent("");
            setIsReplying(false);
        }
    }, [replyContent, onReply]);

    const handleEdit = useCallback(() => {
        if (editContent.trim()) {
            onEdit?.(editContent.trim());
            setIsEditing(false);
        }
    }, [editContent, onEdit]);

    // Calculate tooltip position
    const [adjustedPosition, setAdjustedPosition] = useState(position);

    useEffect(() => {
        if (!tooltipRef.current) return;
        const rect = tooltipRef.current.getBoundingClientRect();
        let x = position.x;
        let y = position.y + 20;

        if (x + rect.width > window.innerWidth) {
            x = window.innerWidth - rect.width - 16;
        }
        if (y + rect.height > window.innerHeight) {
            y = position.y - rect.height - 20;
        }

        setAdjustedPosition({ x: Math.max(16, x), y: Math.max(16, y) });
    }, [position]);

    return (
        <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className={cn(
                "fixed z-9999 w-80 rounded-xl bg-white shadow-2xl dark:bg-gray-800",
                className
            )}
            style={{
                left: adjustedPosition.x,
                top: adjustedPosition.y,
            }}
        >
            {/* Header */}
            <div className="flex items-center justify-between border-b p-3 dark:border-gray-700">
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-white",
                        annotationColors[annotation.type].split(" ")[0]
                    )}>
                        {annotationIcons[annotation.type]}
                    </span>
                    <span className="text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
                        {annotation.type}
                    </span>
                    {annotation.resolved && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            Resolved
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    {isOwner && (
                        <div className="relative">
                            <button
                                onClick={() => setShowMenu(!showMenu)}
                                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                                <MoreHorizontal className="h-4 w-4 text-gray-400" />
                            </button>
                            <AnimatePresence>
                                {showMenu && (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="absolute right-0 top-full mt-1 w-32 overflow-hidden rounded-lg border bg-white py-1 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                                    >
                                        <button
                                            onClick={() => {
                                                setIsEditing(true);
                                                setShowMenu(false);
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700"
                                        >
                                            <Edit2 className="h-4 w-4" />
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                onDelete?.();
                                                setShowMenu(false);
                                            }}
                                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            Delete
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                    <button
                        onClick={onClose}
                        className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-700"
                    >
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>
            </div>

            {/* Data point reference */}
            {annotation.dataPoint && (
                <div className="border-b bg-gray-50 px-3 py-2 dark:border-gray-700 dark:bg-gray-900/50">
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                        <TrendingUp className="h-3 w-3" />
                        <span>{annotation.dataPoint.label}</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                            {annotation.dataPoint.value}
                        </span>
                        {annotation.dataPoint.date && (
                            <>
                                <span>•</span>
                                <Calendar className="h-3 w-3" />
                                <span>{new Date(annotation.dataPoint.date).toLocaleDateString()}</span>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Content */}
            <div className="p-3">
                {/* Author */}
                <div className="mb-2 flex items-center gap-2">
                    {annotation.author.avatar ? (
                        <Image
                            src={annotation.author.avatar}
                            alt=""
                            width={24}
                            height={24}
                            className="h-6 w-6 rounded-full"
                        />
                    ) : (
                        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-purple-500 text-xs font-medium text-white">
                            {annotation.author.name.charAt(0)}
                        </div>
                    )}
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {annotation.author.name}
                    </span>
                    <span className="text-xs text-gray-400">
                        {new Date(annotation.timestamp).toLocaleString()}
                    </span>
                </div>

                {/* Message */}
                {isEditing ? (
                    <div className="mb-3">
                        <textarea
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                            className="w-full rounded-lg border bg-gray-50 p-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                            rows={3}
                        />
                        <div className="mt-2 flex justify-end gap-2">
                            <button
                                onClick={() => setIsEditing(false)}
                                className="rounded px-3 py-1 text-sm text-gray-500 hover:bg-gray-100"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleEdit}
                                className="rounded bg-purple-500 px-3 py-1 text-sm text-white hover:bg-purple-600"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                ) : (
                    <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
                        {annotation.content}
                    </p>
                )}

                {/* Actions */}
                <div className="mb-3 flex items-center gap-4">
                    <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-500">
                        <ThumbsUp className="h-3 w-3" />
                        {annotation.likes || 0}
                    </button>
                    <button
                        onClick={() => setIsReplying(!isReplying)}
                        className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-500"
                    >
                        <Reply className="h-3 w-3" />
                        Reply
                    </button>
                    <button className="flex items-center gap-1 text-xs text-gray-500 hover:text-purple-500">
                        <Link2 className="h-3 w-3" />
                        Link
                    </button>
                    {!annotation.resolved && onResolve && (
                        <button
                            onClick={onResolve}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
                        >
                            <CheckCircle2 className="h-3 w-3" />
                            Resolve
                        </button>
                    )}
                </div>

                {/* Replies */}
                {annotation.replies && annotation.replies.length > 0 && (
                    <div className="mb-3 space-y-2 border-l-2 border-gray-200 pl-3 dark:border-gray-700">
                        {annotation.replies.map((reply) => (
                            <div key={reply.id}>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                        {reply.author.name}
                                    </span>
                                    <span className="text-xs text-gray-400">
                                        {new Date(reply.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400">{reply.content}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Reply input */}
                <AnimatePresence>
                    {isReplying && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={replyContent}
                                    onChange={(e) => setReplyContent(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="flex-1 rounded-lg border bg-gray-50 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
                                    onKeyDown={(e) => e.key === "Enter" && handleReply()}
                                />
                                <button
                                    onClick={handleReply}
                                    disabled={!replyContent.trim()}
                                    className="rounded-lg bg-purple-500 px-3 py-2 text-white disabled:opacity-50 hover:bg-purple-600"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

// ============================================================================
// ANNOTATION LAYER
// ============================================================================

interface AnnotationLayerProps {
    annotations: Annotation[];
    onAddAnnotation?: (position: { x: number; y: number }, type: AnnotationType) => void;
    onUpdateAnnotation?: (id: string, updates: Partial<Annotation>) => void;
    onDeleteAnnotation?: (id: string) => void;
    onReplyToAnnotation?: (id: string, content: string) => void;
    currentUserId?: string;
    readOnly?: boolean;
    className?: string;
}

export function AnnotationLayer({
    annotations,
    onAddAnnotation,
    onUpdateAnnotation,
    onDeleteAnnotation,
    onReplyToAnnotation,
    currentUserId,
    readOnly = false,
    className,
}: AnnotationLayerProps) {
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [isAdding, setIsAdding] = useState(false);
    const [addType, setAddType] = useState<AnnotationType>("comment");
    const layerRef = useRef<HTMLDivElement>(null);
    const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

    const selectedAnnotation = annotations.find((a) => a.id === selectedId);

    useEffect(() => {
        if (selectedAnnotation && layerRef.current) {
            const rect = layerRef.current.getBoundingClientRect();
            setTooltipPosition({
                x: (selectedAnnotation.position.x / 100) * rect.width,
                y: (selectedAnnotation.position.y / 100) * rect.height,
            });
        }
    }, [selectedAnnotation]);

    const handleLayerClick = useCallback((e: React.MouseEvent) => {
        if (readOnly || !isAdding || !layerRef.current) return;

        const rect = layerRef.current.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;

        onAddAnnotation?.({ x, y }, addType);
        setIsAdding(false);
    }, [readOnly, isAdding, addType, onAddAnnotation]);

    return (
        <div
            ref={layerRef}
            onClick={handleLayerClick}
            className={cn(
                "absolute inset-0",
                isAdding && "cursor-crosshair",
                className
            )}
        >
            {/* Add annotation toolbar */}
            {!readOnly && (
                <div className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg bg-white/90 p-1 shadow-lg backdrop-blur-sm dark:bg-gray-800/90">
                    {(["comment", "pin", "flag", "alert", "success", "info"] as AnnotationType[]).map((type) => (
                        <button
                            key={type}
                            onClick={(e) => {
                                e.stopPropagation();
                                setAddType(type);
                                setIsAdding(!isAdding || addType !== type);
                            }}
                            className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-lg transition-colors",
                                isAdding && addType === type
                                    ? annotationColors[type].split(" ")[0] + " text-white"
                                    : "hover:bg-gray-100 dark:hover:bg-gray-700"
                            )}
                            title={`Add ${type}`}
                        >
                            {annotationIcons[type]}
                        </button>
                    ))}
                </div>
            )}

            {/* Annotation markers */}
            {annotations.map((annotation) => (
                <AnnotationMarker
                    key={annotation.id}
                    annotation={{
                        ...annotation,
                        position: {
                            x: annotation.position.x,
                            y: annotation.position.y,
                        },
                    }}
                    isSelected={selectedId === annotation.id}
                    onClick={() => setSelectedId(selectedId === annotation.id ? null : annotation.id)}
                    className="z-10"
                />
            ))}

            {/* Tooltip for selected annotation */}
            <AnimatePresence>
                {selectedAnnotation && (
                    <AnnotationTooltip
                        annotation={selectedAnnotation}
                        position={tooltipPosition}
                        onClose={() => setSelectedId(null)}
                        onReply={(content) => onReplyToAnnotation?.(selectedAnnotation.id, content)}
                        onResolve={() => onUpdateAnnotation?.(selectedAnnotation.id, { resolved: true })}
                        onDelete={() => {
                            onDeleteAnnotation?.(selectedAnnotation.id);
                            setSelectedId(null);
                        }}
                        onEdit={(content) => onUpdateAnnotation?.(selectedAnnotation.id, { content })}
                        currentUserId={currentUserId}
                    />
                )}
            </AnimatePresence>

            {/* Adding mode overlay */}
            <AnimatePresence>
                {isAdding && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-purple-500/5 border-2 border-dashed border-purple-500/50 rounded-lg pointer-events-none"
                    >
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg bg-white px-4 py-2 shadow-lg dark:bg-gray-800">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Click anywhere to add a {addType}
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { Annotation, AnnotationReply, AnnotationType };
