"use client";

import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
    ZoomIn, ZoomOut, ChevronLeft, ChevronRight,
    Download, Maximize2, RefreshCw, Minus,
    ArrowUpRight, ArrowDownRight, Eye, EyeOff, Layers,
} from "lucide-react";

// Types
interface ChartDataPoint {
    name: string;
    [key: string]: string | number;
}

interface DrillDownLevel {
    id: string;
    label: string;
    data: ChartDataPoint[];
    parentKey?: string;
}

interface InteractiveChartProps {
    data: ChartDataPoint[];
    type?: "line" | "area" | "bar" | "pie";
    dataKeys: string[];
    colors?: string[];
    height?: number;
    title?: string;
    subtitle?: string;
    enableDrillDown?: boolean;
    drillDownLevels?: DrillDownLevel[];
    onDrillDown?: (point: ChartDataPoint) => DrillDownLevel | null;
    enableZoom?: boolean;
    enableCompare?: boolean;
    compareData?: ChartDataPoint[];
    showTrendIndicator?: boolean;
    onExport?: () => void;
    onRefresh?: () => void;
    isLoading?: boolean;
    className?: string;
}

const defaultColors = ["#8b5cf6", "#ec4899", "#3b82f6", "#10b981", "#f59e0b", "#ef4444"];

// Custom Tooltip
function CustomTooltip({ active, payload, label, colors: _colors }: { active?: boolean; payload?: unknown[]; label?: string; colors?: unknown }) {
    if (!active || !payload?.length) return null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border bg-white/95 p-4 shadow-xl backdrop-blur-sm dark:bg-gray-800/95"
        >
            <p className="mb-2 font-semibold text-gray-900 dark:text-gray-100">{label}</p>
            <div className="space-y-1">
                {(payload as { color: string; name: string; value: number | string }[]).map((entry, i: number) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: entry.color }} />
                            <span className="text-sm text-gray-600 dark:text-gray-400">{entry.name}</span>
                        </div>
                        <span className="font-medium" style={{ color: entry.color }}>
                            {typeof entry.value === "number" ? new Intl.NumberFormat().format(entry.value) : entry.value}
                        </span>
                    </div>
                ))} 
            </div>
        </motion.div>
    );
}

// Trend Indicator
function TrendIndicator({ current, previous }: { current: number; previous: number }) {
    const change = ((current - previous) / previous) * 100;
    const isPositive = change > 0;
    const isNeutral = Math.abs(change) < 0.5;

    return (
        <div className={cn("flex items-center gap-1 text-sm font-medium", isNeutral ? "text-gray-500" : isPositive ? "text-green-600" : "text-red-600")}>
            {isNeutral ? <Minus className="h-4 w-4" /> : isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
            <span>{Math.abs(change).toFixed(1)}%</span>
        </div>
    );
}

// Main Component
export function InteractiveChart({
    data,
    type = "line",
    dataKeys,
    colors = defaultColors,
    height = 350,
    title,
    subtitle,
    enableDrillDown = false,
    drillDownLevels: _drillDownLevels,
    onDrillDown,
    enableZoom = true,
    enableCompare = false,
    compareData,
    showTrendIndicator = true,
    onExport,
    onRefresh,
    isLoading = false,
    className,
}: InteractiveChartProps) {
    const [drillStack, setDrillStack] = useState<DrillDownLevel[]>([{ id: "root", label: "Overview", data }]);
    const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set(dataKeys));
    const [isComparing, setIsComparing] = useState(false);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [selectedPoint, setSelectedPoint] = useState<ChartDataPoint | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const currentLevel = drillStack[drillStack.length - 1];
    const currentData = currentLevel.data;

    // Calculate trends
    const trends = useMemo(() => {
        if (!showTrendIndicator || currentData.length < 2) return {};
        const result: Record<string, { current: number; previous: number }> = {};
        dataKeys.forEach((key) => {
            const current = Number(currentData[currentData.length - 1]?.[key]) || 0;
            const previous = Number(currentData[currentData.length - 2]?.[key]) || 0;
            result[key] = { current, previous };
        });
        return result;
    }, [currentData, dataKeys, showTrendIndicator]);

    // Handlers
    const handlePointClick = useCallback((point: ChartDataPoint) => {
        setSelectedPoint(point);
        if (enableDrillDown && onDrillDown) {
            const nextLevel = onDrillDown(point);
            if (nextLevel) {
                setDrillStack((prev) => [...prev, nextLevel]);
            }
        }
    }, [enableDrillDown, onDrillDown]);

    const handleBack = useCallback(() => {
        if (drillStack.length > 1) {
            setDrillStack((prev) => prev.slice(0, -1));
            setSelectedPoint(null);
        }
    }, [drillStack.length]);

    const toggleKey = useCallback((key: string) => {
        setVisibleKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }, []);

    // Render chart
    const renderChart = () => {
        const displayData = currentData.slice(0, Math.ceil(currentData.length * zoomLevel));
        const activeKeys = dataKeys.filter((k) => visibleKeys.has(k));

        const commonProps = { data: displayData, margin: { top: 10, right: 30, left: 10, bottom: 10 } };

        switch (type) {
            case "pie":
                return (
                    <PieChart>
                        <Pie
                            data={displayData}
                            dataKey={activeKeys[0]}
                            nameKey="name"
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            innerRadius={60}
                            paddingAngle={2}
                            onClick={(_, i) => handlePointClick(displayData[i])}
                        >
                            {displayData.map((_, i) => (
                                <Cell key={i} fill={colors[i % colors.length]} className="cursor-pointer hover:opacity-80" />
                            ))}
                        </Pie>
                        <Tooltip content={<CustomTooltip colors={colors} />} />
                        <Legend />
                    </PieChart>
                );

            case "bar":
                return (
                    <BarChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip content={<CustomTooltip colors={colors} />} />
                        <Legend />
                        {activeKeys.map((key, i) => (
                            <Bar
                                key={key}
                                dataKey={key}
                                fill={colors[i % colors.length]}
                                radius={[4, 4, 0, 0]}
                                className="cursor-pointer"
                            />
                        ))}
                    </BarChart>
                );

            case "area":
                return (
                    <AreaChart {...commonProps}>
                        <defs>
                            {activeKeys.map((key, i) => (
                                <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors[i % colors.length]} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={colors[i % colors.length]} stopOpacity={0} />
                                </linearGradient>
                            ))}
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip content={<CustomTooltip colors={colors} />} />
                        <Legend />
                        {activeKeys.map((key, i) => (
                            <Area
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[i % colors.length]}
                                fill={`url(#gradient-${key})`}
                                strokeWidth={2}
                                className="cursor-pointer"
                            />
                        ))}
                    </AreaChart>
                );

            default:
                return (
                    <LineChart {...commonProps}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <Tooltip content={<CustomTooltip colors={colors} />} />
                        <Legend />
                        {activeKeys.map((key, i) => (
                            <Line
                                key={key}
                                type="monotone"
                                dataKey={key}
                                stroke={colors[i % colors.length]}
                                strokeWidth={2}
                                dot={{ fill: colors[i % colors.length], r: 4, className: "cursor-pointer" }}
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                 activeDot={{ r: 6, onClick: ((data: unknown, _index: number, _event: React.MouseEvent) => handlePointClick(data as ChartDataPoint)) as any }}
                            />
                        ))}
                    </LineChart>
                );
        }
    };

    return (
        <motion.div
            layout
            className={cn(
                "relative overflow-hidden rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800",
                isFullscreen && "fixed inset-4 z-50",
                className
            )}
        >
            {/* Header */}
            <div className="mb-4 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    {drillStack.length > 1 && (
                        <button onClick={handleBack} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <ChevronLeft className="h-5 w-5" />
                        </button>
                    )}
                    <div>
                        {title && <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{title}</h3>}
                        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
                        {/* Breadcrumb */}
                        {drillStack.length > 1 && (
                            <div className="mt-1 flex items-center gap-1 text-xs text-gray-500">
                                {drillStack.map((level, i) => (
                                    <span key={level.id}>
                                        {i > 0 && <ChevronRight className="inline h-3 w-3" />}
                                        <span className={i === drillStack.length - 1 ? "font-medium text-blue-500" : ""}>{level.label}</span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {enableZoom && (
                        <>
                            <button onClick={() => setZoomLevel(Math.max(0.5, zoomLevel - 0.25))} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700" title="Zoom Out">
                                <ZoomOut className="h-4 w-4" />
                            </button>
                            <button onClick={() => setZoomLevel(Math.min(1, zoomLevel + 0.25))} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700" title="Zoom In">
                                <ZoomIn className="h-4 w-4" />
                            </button>
                        </>
                    )}
                    {enableCompare && compareData && (
                        <button onClick={() => setIsComparing(!isComparing)} className={cn("rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700", isComparing && "bg-blue-100 text-blue-600")}>
                            <Layers className="h-4 w-4" />
                        </button>
                    )}
                    {onRefresh && (
                        <button onClick={onRefresh} disabled={isLoading} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        </button>
                    )}
                    {onExport && (
                        <button onClick={onExport} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                            <Download className="h-4 w-4" />
                        </button>
                    )}
                    <button onClick={() => setIsFullscreen(!isFullscreen)} className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <Maximize2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Trend Indicators */}
            {showTrendIndicator && Object.keys(trends).length > 0 && (
                <div className="mb-4 flex flex-wrap gap-4">
                    {Object.entries(trends).map(([key, { current, previous }], i) => (
                        <div key={key} className="flex items-center gap-2">
                            <div className="h-3 w-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                            <span className="text-sm font-medium">{key}</span>
                            <TrendIndicator current={current} previous={previous} />
                        </div>
                    ))}
                </div>
            )}

            {/* Legend Toggle */}
            <div className="mb-4 flex flex-wrap gap-2">
                {dataKeys.map((key, i) => (
                    <button
                        key={key}
                        onClick={() => toggleKey(key)}
                        className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-sm transition-all", visibleKeys.has(key) ? "bg-gray-100 dark:bg-gray-700" : "opacity-50")}
                    >
                        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                        <span>{key}</span>
                        {visibleKeys.has(key) ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                ))}
            </div>

            {/* Chart */}
            <div className="relative">
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 backdrop-blur-sm dark:bg-gray-800/50">
                        <RefreshCw className="h-8 w-8 animate-spin text-blue-500" />
                    </div>
                )}
                <ResponsiveContainer width="100%" height={isFullscreen ? 500 : height} minWidth={0}>
                    {renderChart()}
                </ResponsiveContainer>
            </div>

            {/* Selected Point Details */}
            <AnimatePresence>
                {selectedPoint && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="mt-4 rounded-xl bg-gray-50 p-4 dark:bg-gray-700/50"
                    >
                        <div className="flex items-center justify-between">
                            <h4 className="font-semibold">{selectedPoint.name}</h4>
                            <button onClick={() => setSelectedPoint(null)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
                            {dataKeys.map((key, i) => (
                                <div key={key}>
                                    <p className="text-xs text-gray-500">{key}</p>
                                    <p className="text-lg font-bold" style={{ color: colors[i % colors.length] }}>
                                        {new Intl.NumberFormat().format(Number(selectedPoint[key]) || 0)}
                                    </p>
                                </div>
                            ))}
                        </div>
                        {enableDrillDown && <p className="mt-2 text-xs text-blue-500">Click to drill down →</p>}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export type { ChartDataPoint, DrillDownLevel, InteractiveChartProps };
