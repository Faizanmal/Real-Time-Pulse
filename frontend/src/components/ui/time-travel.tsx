"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Play, Pause, SkipBack, SkipForward, Calendar, Clock,
    ChevronLeft, ChevronRight, Rewind, FastForward,
    RotateCcw, Camera, Download, ZoomIn, ZoomOut,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface TimePoint {
    date: Date;
    label: string;
    data?: unknown;
    isKeyframe?: boolean;
}

interface TimeTravelSliderProps {
    timePoints: TimePoint[];
    currentIndex: number;
    onChange: (index: number) => void;
    isPlaying?: boolean;
    onPlayPause?: () => void;
    playbackSpeed?: number;
    onSpeedChange?: (speed: number) => void;
    showThumbnails?: boolean;
    onSnapshot?: (index: number) => void;
    className?: string;
}

// ============================================================================
// TIME TRAVEL SLIDER
// ============================================================================

export function TimeTravelSlider({
    timePoints,
    currentIndex,
    onChange,
    isPlaying = false,
    onPlayPause,
    playbackSpeed = 1,
    onSpeedChange,
    showThumbnails = false,
    onSnapshot,
    className,
}: TimeTravelSliderProps) {
    const sliderRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [hoverIndex, setHoverIndex] = useState<number | null>(null);

    const currentPoint = timePoints[currentIndex];
    const progress = timePoints.length > 1 ? (currentIndex / (timePoints.length - 1)) * 100 : 0;

    // Handle slider click
    const handleSliderClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        if (!sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const percentage = x / rect.width;
        const newIndex = Math.round(percentage * (timePoints.length - 1));
        onChange(Math.max(0, Math.min(timePoints.length - 1, newIndex)));
    }, [timePoints.length, onChange]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "ArrowLeft") {
                onChange(Math.max(0, currentIndex - 1));
            } else if (e.key === "ArrowRight") {
                onChange(Math.min(timePoints.length - 1, currentIndex + 1));
            } else if (e.key === " ") {
                e.preventDefault();
                onPlayPause?.();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, timePoints.length, onChange, onPlayPause]);

    // Playback timer
    useEffect(() => {
        if (!isPlaying) return;

        const interval = setInterval(() => {
            if (currentIndex < timePoints.length - 1) {
                onChange(currentIndex + 1);
            } else {
                onPlayPause?.(); // Stop at end
            }
        }, 1000 / playbackSpeed);

        return () => clearInterval(interval);
    }, [isPlaying, currentIndex, timePoints.length, playbackSpeed, onChange, onPlayPause]);

    const speeds = [0.5, 1, 2, 4];

    return (
        <div className={cn("rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800", className)}>
            {/* Header */}
            <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-500" />
                    <div>
                        <h3 className="font-bold text-gray-900 dark:text-gray-100">Time Travel</h3>
                        {currentPoint && (
                            <p className="text-sm text-gray-500">
                                {currentPoint.label} • {currentPoint.date.toLocaleDateString()}
                            </p>
                        )}
                    </div>
                </div>

                {/* Snapshot button */}
                {onSnapshot && (
                    <button
                        onClick={() => onSnapshot(currentIndex)}
                        className="flex items-center gap-2 rounded-lg bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-400"
                    >
                        <Camera className="h-4 w-4" />
                        Snapshot
                    </button>
                )}
            </div>

            {/* Timeline Slider */}
            <div className="relative mb-4">
                <div
                    ref={sliderRef}
                    onClick={handleSliderClick}
                    onMouseMove={(e) => {
                        if (!sliderRef.current) return;
                        const rect = sliderRef.current.getBoundingClientRect();
                        const x = e.clientX - rect.left;
                        const percentage = x / rect.width;
                        const idx = Math.round(percentage * (timePoints.length - 1));
                        setHoverIndex(idx);
                    }}
                    onMouseLeave={() => setHoverIndex(null)}
                    className="relative h-2 cursor-pointer rounded-full bg-gray-200 dark:bg-gray-700"
                >
                    {/* Progress fill */}
                    <motion.div
                        className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                        style={{ width: `${progress}%` }}
                        layoutId="progress"
                    />

                    {/* Keyframe markers */}
                    {timePoints.map((point, index) => (
                        point.isKeyframe && (
                            <div
                                key={index}
                                className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-400 shadow-md"
                                style={{ left: `${(index / (timePoints.length - 1)) * 100}%` }}
                            />
                        )
                    ))}

                    {/* Current position handle */}
                    <motion.div
                        className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full bg-white shadow-lg ring-2 ring-purple-500"
                        style={{ left: `${progress}%` }}
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                    />
                </div>

                {/* Hover tooltip */}
                <AnimatePresence>
                    {hoverIndex !== null && hoverIndex !== currentIndex && timePoints[hoverIndex] && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute bottom-full mb-2 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white"
                            style={{ left: `${(hoverIndex / (timePoints.length - 1)) * 100}%` }}
                        >
                            {timePoints[hoverIndex].label}
                            <div className="absolute left-1/2 top-full h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900" />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Time labels */}
            <div className="mb-4 flex justify-between text-xs text-gray-500">
                <span>{timePoints[0]?.label}</span>
                <span>{timePoints[timePoints.length - 1]?.label}</span>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-center gap-2">
                {/* Reset */}
                <button
                    onClick={() => onChange(0)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                    title="Reset"
                >
                    <RotateCcw className="h-4 w-4" />
                </button>

                {/* Previous */}
                <button
                    onClick={() => onChange(Math.max(0, currentIndex - 1))}
                    disabled={currentIndex === 0}
                    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                    <SkipBack className="h-4 w-4" />
                </button>

                {/* Rewind */}
                <button
                    onClick={() => onChange(Math.max(0, currentIndex - 5))}
                    disabled={currentIndex === 0}
                    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                    <Rewind className="h-4 w-4" />
                </button>

                {/* Play/Pause */}
                <button
                    onClick={onPlayPause}
                    className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500 text-white shadow-lg hover:bg-purple-600"
                >
                    {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
                </button>

                {/* Fast Forward */}
                <button
                    onClick={() => onChange(Math.min(timePoints.length - 1, currentIndex + 5))}
                    disabled={currentIndex === timePoints.length - 1}
                    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                    <FastForward className="h-4 w-4" />
                </button>

                {/* Next */}
                <button
                    onClick={() => onChange(Math.min(timePoints.length - 1, currentIndex + 1))}
                    disabled={currentIndex === timePoints.length - 1}
                    className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 disabled:opacity-50 dark:text-gray-400 dark:hover:bg-gray-700"
                >
                    <SkipForward className="h-4 w-4" />
                </button>

                {/* Jump to End */}
                <button
                    onClick={() => onChange(timePoints.length - 1)}
                    className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                    title="Jump to End"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Speed Control */}
            {onSpeedChange && (
                <div className="mt-4 flex items-center justify-center gap-2">
                    <span className="text-xs text-gray-500">Speed:</span>
                    {speeds.map((speed) => (
                        <button
                            key={speed}
                            onClick={() => onSpeedChange(speed)}
                            className={cn(
                                "rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
                                playbackSpeed === speed
                                    ? "bg-purple-500 text-white"
                                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-400"
                            )}
                        >
                            {speed}x
                        </button>
                    ))}
                </div>
            )}

            {/* Thumbnails */}
            {showThumbnails && (
                <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
                    {timePoints.filter((_, i) => i % Math.ceil(timePoints.length / 10) === 0 || _.isKeyframe).map((point, index) => {
                        const actualIndex = timePoints.indexOf(point);
                        return (
                            <button
                                key={index}
                                onClick={() => onChange(actualIndex)}
                                className={cn(
                                    "flex-shrink-0 rounded-lg border-2 p-2 transition-all",
                                    actualIndex === currentIndex
                                        ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20"
                                        : "border-transparent hover:border-gray-300"
                                )}
                            >
                                <div className="h-12 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                                <p className="mt-1 text-xs text-gray-500">{point.label}</p>
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// ============================================================================
// DATE RANGE QUICK SELECTOR
// ============================================================================

interface DateRangeOption {
    label: string;
    value: string;
    days: number;
}

interface DateRangeQuickSelectorProps {
    value: string;
    onChange: (value: string, days: number) => void;
    options?: DateRangeOption[];
    className?: string;
}

const defaultDateRanges: DateRangeOption[] = [
    { label: "Today", value: "today", days: 1 },
    { label: "7 Days", value: "7d", days: 7 },
    { label: "30 Days", value: "30d", days: 30 },
    { label: "90 Days", value: "90d", days: 90 },
    { label: "This Year", value: "ytd", days: 365 },
    { label: "All Time", value: "all", days: -1 },
];

export function DateRangeQuickSelector({
    value,
    onChange,
    options = defaultDateRanges,
    className,
}: DateRangeQuickSelectorProps) {
    return (
        <div className={cn("flex flex-wrap gap-2", className)}>
            {options.map((option) => (
                <motion.button
                    key={option.value}
                    onClick={() => onChange(option.value, option.days)}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                        "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                        value === option.value
                            ? "bg-purple-500 text-white shadow-lg"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                    )}
                >
                    {option.label}
                </motion.button>
            ))}
        </div>
    );
}

// ============================================================================
// COMPARISON SELECTOR
// ============================================================================

interface ComparisonPeriod {
    label: string;
    value: string;
}

interface ComparisonSelectorProps {
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    period: string;
    onPeriodChange: (period: string) => void;
    periods?: ComparisonPeriod[];
    className?: string;
}

const defaultPeriods: ComparisonPeriod[] = [
    { label: "Previous Period", value: "previous" },
    { label: "Same Period Last Year", value: "yoy" },
    { label: "Same Period Last Month", value: "mom" },
    { label: "Custom", value: "custom" },
];

export function ComparisonSelector({
    enabled,
    onToggle,
    period,
    onPeriodChange,
    periods = defaultPeriods,
    className,
}: ComparisonSelectorProps) {
    return (
        <div className={cn("flex items-center gap-4", className)}>
            {/* Toggle */}
            <button
                onClick={() => onToggle(!enabled)}
                className={cn(
                    "relative h-6 w-11 rounded-full transition-colors",
                    enabled ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"
                )}
            >
                <motion.div
                    className="absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-md"
                    animate={{ left: enabled ? 22 : 2 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
            </button>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Compare to
            </span>

            {/* Period selector */}
            <AnimatePresence>
                {enabled && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="flex gap-2"
                    >
                        {periods.map((p) => (
                            <button
                                key={p.value}
                                onClick={() => onPeriodChange(p.value)}
                                className={cn(
                                    "rounded-lg px-3 py-1 text-sm transition-colors",
                                    period === p.value
                                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                        : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700"
                                )}
                            >
                                {p.label}
                            </button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// PREDICTIVE INSIGHTS CARD
// ============================================================================

interface Prediction {
    metric: string;
    currentValue: number;
    predictedValue: number;
    confidence: number;
    trend: "up" | "down" | "stable";
    timeframe: string;
    factors?: string[];
}

interface PredictiveInsightsProps {
    predictions: Prediction[];
    onViewDetails?: (prediction: Prediction) => void;
    className?: string;
}

export function PredictiveInsights({
    predictions,
    onViewDetails,
    className,
}: PredictiveInsightsProps) {
    return (
        <div className={cn("rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-pink-500/10 p-4", className)}>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                <motion.div
                    animate={{ rotate: [0, 360] }}
                    transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                >
                    <span className="text-xl">🔮</span>
                </motion.div>
                Predictive Insights
            </h3>

            <div className="space-y-3">
                {predictions.map((prediction, index) => (
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="rounded-xl bg-white/80 p-4 backdrop-blur-sm dark:bg-gray-800/80"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                                    {prediction.metric}
                                </p>
                                <div className="mt-1 flex items-baseline gap-3">
                                    <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                        {prediction.predictedValue.toLocaleString()}
                                    </span>
                                    <span className={cn(
                                        "flex items-center gap-1 text-sm font-medium",
                                        prediction.trend === "up" && "text-green-600",
                                        prediction.trend === "down" && "text-red-600",
                                        prediction.trend === "stable" && "text-gray-500"
                                    )}>
                                        {prediction.trend === "up" && "↑"}
                                        {prediction.trend === "down" && "↓"}
                                        {prediction.trend === "stable" && "→"}
                                        {Math.abs(((prediction.predictedValue - prediction.currentValue) / prediction.currentValue) * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    From {prediction.currentValue.toLocaleString()} • {prediction.timeframe}
                                </p>
                            </div>

                            {/* Confidence indicator */}
                            <div className="text-right">
                                <div className="flex items-center gap-1">
                                    <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                        <motion.div
                                            className={cn(
                                                "h-full rounded-full",
                                                prediction.confidence >= 80 && "bg-green-500",
                                                prediction.confidence >= 50 && prediction.confidence < 80 && "bg-amber-500",
                                                prediction.confidence < 50 && "bg-red-500"
                                            )}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${prediction.confidence}%` }}
                                        />
                                    </div>
                                    <span className="text-xs font-medium text-gray-500">{prediction.confidence}%</span>
                                </div>
                                <p className="mt-1 text-xs text-gray-400">confidence</p>
                            </div>
                        </div>

                        {/* Factors */}
                        {prediction.factors && prediction.factors.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1">
                                {prediction.factors.slice(0, 3).map((factor, i) => (
                                    <span
                                        key={i}
                                        className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                                    >
                                        {factor}
                                    </span>
                                ))}
                            </div>
                        )}

                        {onViewDetails && (
                            <button
                                onClick={() => onViewDetails(prediction)}
                                className="mt-3 text-xs font-medium text-purple-600 hover:text-purple-700"
                            >
                                View analysis →
                            </button>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { TimePoint, Prediction, DateRangeOption, ComparisonPeriod };
