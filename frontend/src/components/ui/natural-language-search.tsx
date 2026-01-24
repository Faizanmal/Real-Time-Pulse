"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Search, Mic, MicOff, Sparkles, TrendingUp, Calendar, Users,
    DollarSign, BarChart3, Clock, ArrowRight, X, Loader2,
    History, Zap, Filter, MessageSquare, ChevronRight,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface QuerySuggestion {
    id: string;
    text: string;
    category: "metric" | "comparison" | "trend" | "filter" | "action";
    icon?: React.ReactNode;
}

interface QueryResult {
    id: string;
    type: "metric" | "chart" | "table" | "insight" | "action";
    title: string;
    description?: string;
    value?: string | number;
    change?: number;
    data?: unknown;
    actions?: Array<{ label: string; action: () => void }>;
}

interface ParsedQuery {
    intent: "show" | "compare" | "filter" | "trend" | "action" | "unknown";
    entities: {
        metrics?: string[];
        timeRange?: string;
        filters?: Record<string, string>;
        comparison?: string;
    };
    confidence: number;
}

// ============================================================================
// NATURAL LANGUAGE INPUT
// ============================================================================

interface NaturalLanguageInputProps {
    onQuery: (query: string) => void;
    onVoiceInput?: (transcript: string) => void;
    placeholder?: string;
    suggestions?: QuerySuggestion[];
    recentQueries?: string[];
    isLoading?: boolean;
    className?: string;
}

export function NaturalLanguageInput({
    onQuery,
    onVoiceInput,
    placeholder = "Ask anything about your data...",
    suggestions = [],
    recentQueries = [],
    isLoading = false,
    className,
}: NaturalLanguageInputProps) {
    const [query, setQuery] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const hasVoiceSupport = (() => {
        if (typeof window === "undefined") return false;
        const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
            || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
        return !!SpeechRecognitionAPI;
    })();
    const inputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<unknown>(null);

    // Voice recognition setup
    useEffect(() => {
        if (typeof window !== "undefined" && hasVoiceSupport) {
            const SpeechRecognitionAPI = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
                || (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

            if (SpeechRecognitionAPI) {
                const recognition = new SpeechRecognitionAPI() as {
                    continuous: boolean;
                    interimResults: boolean;
                    onresult: ((event: { results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
                    onend: (() => void) | null;
                    onerror: (() => void) | null;
                    start: () => void;
                    stop: () => void;
                };
                recognition.continuous = false;
                recognition.interimResults = true;

                recognition.onresult = (event) => {
                    const transcript = Array.from(event.results)
                        .map((result) => result[0].transcript)
                        .join("");
                    setQuery(transcript);
                    if (event.results[0]?.isFinal) {
                        onVoiceInput?.(transcript);
                        setIsListening(false);
                    }
                };

                recognition.onend = () => setIsListening(false);
                recognition.onerror = () => setIsListening(false);
                recognitionRef.current = recognition;
            }
        }
    }, [onVoiceInput, hasVoiceSupport]);

    const toggleVoice = useCallback(() => {
        const recognition = recognitionRef.current as {
            start: () => void;
            stop: () => void;
        } | null;
        if (!recognition) return;

        if (isListening) {
            recognition.stop();
        } else {
            recognition.start();
            setIsListening(true);
        }
    }, [isListening]);

    const handleSubmit = useCallback((e?: React.FormEvent) => {
        e?.preventDefault();
        if (query.trim()) {
            onQuery(query.trim());
            setShowSuggestions(false);
        }
    }, [query, onQuery]);

    const handleSuggestionClick = useCallback((suggestion: QuerySuggestion) => {
        setQuery(suggestion.text);
        onQuery(suggestion.text);
        setShowSuggestions(false);
    }, [onQuery]);

    // Filter suggestions based on query
    const filteredSuggestions = suggestions.filter((s) =>
        s.text.toLowerCase().includes(query.toLowerCase())
    );

    return (
        <div className={cn("relative", className)}>
            <form onSubmit={handleSubmit}>
                <div
                    className={cn(
                        "relative flex items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3 shadow-lg transition-all dark:bg-gray-800",
                        isFocused
                            ? "border-purple-500 ring-4 ring-purple-500/20"
                            : "border-gray-200 dark:border-gray-700",
                        isListening && "border-red-500 ring-4 ring-red-500/20"
                    )}
                >
                    {/* AI Icon */}
                    <div className="shrink-0">
                        <motion.div
                            animate={isLoading ? { rotate: 360 } : { rotate: 0 }}
                            transition={isLoading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
                        >
                            <Sparkles className={cn(
                                "h-5 w-5",
                                isFocused ? "text-purple-500" : "text-gray-400"
                            )} />
                        </motion.div>
                    </div>

                    {/* Input */}
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => {
                            setQuery(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => {
                            setIsFocused(true);
                            setShowSuggestions(true);
                        }}
                        onBlur={() => {
                            setIsFocused(false);
                            // Delay hiding to allow clicks on suggestions
                            setTimeout(() => setShowSuggestions(false), 200);
                        }}
                        placeholder={placeholder}
                        className="flex-1 bg-transparent text-gray-900 placeholder-gray-400 outline-none dark:text-gray-100"
                        disabled={isLoading}
                    />

                    {/* Clear button */}
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery("")}
                            className="text-gray-400 hover:text-gray-600"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    )}

                    {/* Voice button */}
                    {hasVoiceSupport && (
                        <button
                            type="button"
                            onClick={toggleVoice}
                            className={cn(
                                "rounded-full p-2 transition-colors",
                                isListening
                                    ? "bg-red-100 text-red-500 dark:bg-red-900/30"
                                    : "text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                            )}
                        >
                            {isListening ? (
                                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}>
                                    <Mic className="h-5 w-5" />
                                </motion.div>
                            ) : (
                                <MicOff className="h-5 w-5" />
                            )}
                        </button>
                    )}

                    {/* Submit button */}
                    <button
                        type="submit"
                        disabled={!query.trim() || isLoading}
                        className={cn(
                            "rounded-xl px-4 py-2 font-medium text-white transition-all",
                            query.trim() && !isLoading
                                ? "bg-purple-500 hover:bg-purple-600"
                                : "bg-gray-300 cursor-not-allowed dark:bg-gray-600"
                        )}
                    >
                        {isLoading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <ArrowRight className="h-5 w-5" />
                        )}
                    </button>
                </div>
            </form>

            {/* Suggestions Dropdown */}
            <AnimatePresence>
                {showSuggestions && (query || recentQueries.length > 0 || suggestions.length > 0) && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
                    >
                        {/* Recent queries */}
                        {!query && recentQueries.length > 0 && (
                            <div className="border-b border-gray-100 p-3 dark:border-gray-700">
                                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
                                    <History className="h-3 w-3" />
                                    Recent
                                </p>
                                <div className="space-y-1">
                                    {recentQueries.slice(0, 3).map((q, i) => (
                                        <button
                                            key={i}
                                            onClick={() => {
                                                setQuery(q);
                                                onQuery(q);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
                                        >
                                            <Clock className="h-4 w-4 text-gray-400" />
                                            {q}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Suggestions */}
                        {(query ? filteredSuggestions : suggestions).length > 0 && (
                            <div className="p-3">
                                <p className="mb-2 flex items-center gap-2 text-xs font-medium text-gray-500">
                                    <Zap className="h-3 w-3" />
                                    {query ? "Suggestions" : "Try asking"}
                                </p>
                                <div className="space-y-1">
                                    {(query ? filteredSuggestions : suggestions).slice(0, 5).map((suggestion) => (
                                        <button
                                            key={suggestion.id}
                                            onClick={() => handleSuggestionClick(suggestion)}
                                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-purple-50 dark:hover:bg-purple-900/20"
                                        >
                                            <span className={cn(
                                                "flex h-8 w-8 items-center justify-center rounded-lg",
                                                suggestion.category === "metric" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                                                suggestion.category === "comparison" && "bg-green-100 text-green-600 dark:bg-green-900/30",
                                                suggestion.category === "trend" && "bg-purple-100 text-purple-600 dark:bg-purple-900/30",
                                                suggestion.category === "filter" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                                                suggestion.category === "action" && "bg-pink-100 text-pink-600 dark:bg-pink-900/30"
                                            )}>
                                                {suggestion.icon || <MessageSquare className="h-4 w-4" />}
                                            </span>
                                            <span className="flex-1 text-gray-700 dark:text-gray-300">
                                                {suggestion.text}
                                            </span>
                                            <ChevronRight className="h-4 w-4 text-gray-400" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// QUERY RESULTS DISPLAY
// ============================================================================

interface QueryResultsProps {
    results: QueryResult[];
    query: string;
    isLoading?: boolean;
    onResultAction?: (resultId: string, action: string) => void;
}

export function QueryResults({
    results,
    query,
    isLoading,
    onResultAction: _onResultAction,
}: QueryResultsProps) {
    if (isLoading) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12"
            >
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="mb-4"
                >
                    <Sparkles className="h-8 w-8 text-purple-500" />
                </motion.div>
                <p className="text-gray-500">Analyzing your query...</p>
                <p className="mt-1 text-sm text-gray-400">&quot;{query}&quot;</p>
            </motion.div>
        );
    }

    if (results.length === 0) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center py-12 text-center"
            >
                <Search className="mb-4 h-12 w-12 text-gray-300" />
                <p className="text-gray-500">No results found for your query</p>
                <p className="mt-1 text-sm text-gray-400">Try rephrasing or ask something different</p>
            </motion.div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Query interpretation */}
            <div className="flex items-center gap-2 rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20">
                <Sparkles className="h-5 w-5 text-purple-500" />
                <p className="text-sm text-purple-700 dark:text-purple-300">
                    Showing results for: <strong>&quot;{query}&quot;</strong>
                </p>
            </div>

            {/* Results */}
            <div className="grid gap-4 md:grid-cols-2">
                {results.map((result, index) => (
                    <motion.div
                        key={result.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="rounded-xl border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800"
                    >
                        {/* Result header */}
                        <div className="mb-3 flex items-start justify-between">
                            <div>
                                <span className={cn(
                                    "inline-block rounded-full px-2 py-0.5 text-xs font-medium",
                                    result.type === "metric" && "bg-blue-100 text-blue-700",
                                    result.type === "chart" && "bg-purple-100 text-purple-700",
                                    result.type === "table" && "bg-green-100 text-green-700",
                                    result.type === "insight" && "bg-amber-100 text-amber-700",
                                    result.type === "action" && "bg-pink-100 text-pink-700"
                                )}>
                                    {result.type}
                                </span>
                                <h4 className="mt-2 font-semibold text-gray-900 dark:text-gray-100">
                                    {result.title}
                                </h4>
                            </div>
                        </div>

                        {/* Value display for metrics */}
                        {result.value !== undefined && (
                            <div className="flex items-baseline gap-3">
                                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                                    {typeof result.value === "number"
                                        ? new Intl.NumberFormat().format(result.value)
                                        : result.value}
                                </span>
                                {result.change !== undefined && (
                                    <span className={cn(
                                        "flex items-center gap-1 text-sm font-medium",
                                        result.change >= 0 ? "text-green-600" : "text-red-600"
                                    )}>
                                        <TrendingUp className={cn("h-4 w-4", result.change < 0 && "rotate-180")} />
                                        {Math.abs(result.change)}%
                                    </span>
                                )}
                            </div>
                        )}

                        {/* Description */}
                        {result.description && (
                            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                                {result.description}
                            </p>
                        )}

                        {/* Actions */}
                        {result.actions && result.actions.length > 0 && (
                            <div className="mt-4 flex gap-2">
                                {result.actions.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={action.action}
                                        className={cn(
                                            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                                            i === 0
                                                ? "bg-purple-500 text-white hover:bg-purple-600"
                                                : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300"
                                        )}
                                    >
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

// ============================================================================
// AI QUERY INTERFACE
// ============================================================================

interface AIQueryInterfaceProps {
    onQuery: (query: string) => Promise<QueryResult[]>;
    suggestions?: QuerySuggestion[];
    className?: string;
}

const defaultSuggestions: QuerySuggestion[] = [
    { id: "1", text: "Show me this month's revenue", category: "metric", icon: <DollarSign className="h-4 w-4" /> },
    { id: "2", text: "Compare sales vs last month", category: "comparison", icon: <BarChart3 className="h-4 w-4" /> },
    { id: "3", text: "What's the trend for active users?", category: "trend", icon: <TrendingUp className="h-4 w-4" /> },
    { id: "4", text: "Filter by top performing clients", category: "filter", icon: <Filter className="h-4 w-4" /> },
    { id: "5", text: "Show user activity for this week", category: "metric", icon: <Users className="h-4 w-4" /> },
    { id: "6", text: "What happened on December 25th?", category: "metric", icon: <Calendar className="h-4 w-4" /> },
];

export function AIQueryInterface({
    onQuery,
    suggestions = defaultSuggestions,
    className,
}: AIQueryInterfaceProps) {
    const [results, setResults] = useState<QueryResult[]>([]);
    const [currentQuery, setCurrentQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [recentQueries, setRecentQueries] = useState<string[]>([]);

    const handleQuery = useCallback(async (query: string) => {
        setCurrentQuery(query);
        setIsLoading(true);

        try {
            const queryResults = await onQuery(query);
            setResults(queryResults);

            // Add to recent queries
            setRecentQueries((prev) => {
                const updated = [query, ...prev.filter((q) => q !== query)].slice(0, 10);
                return updated;
            });
        } catch (error) {
            console.error("Query failed:", error);
            setResults([]);
        } finally {
            setIsLoading(false);
        }
    }, [onQuery]);

    return (
        <div className={cn("space-y-6", className)}>
            <NaturalLanguageInput
                onQuery={handleQuery}
                suggestions={suggestions}
                recentQueries={recentQueries}
                isLoading={isLoading}
            />

            {(currentQuery || results.length > 0) && (
                <QueryResults
                    results={results}
                    query={currentQuery}
                    isLoading={isLoading}
                />
            )}
        </div>
    );
}

// ============================================================================
// QUICK INSIGHTS BAR
// ============================================================================

interface QuickInsight {
    id: string;
    text: string;
    type: "positive" | "negative" | "neutral" | "action";
    onClick?: () => void;
}

interface QuickInsightsBarProps {
    insights: QuickInsight[];
    className?: string;
}

export function QuickInsightsBar({ insights, className }: QuickInsightsBarProps) {
    return (
        <div className={cn("flex items-center gap-2 overflow-x-auto py-2", className)}>
            <span className="shrink-0 text-sm text-gray-500">
                <Sparkles className="inline h-4 w-4 mr-1" />
                AI Insights:
            </span>
            {insights.map((insight) => (
                <motion.button
                    key={insight.id}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={insight.onClick}
                    className={cn(
                        "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                        insight.type === "positive" && "bg-green-100 text-green-700 hover:bg-green-200",
                        insight.type === "negative" && "bg-red-100 text-red-700 hover:bg-red-200",
                        insight.type === "neutral" && "bg-gray-100 text-gray-700 hover:bg-gray-200",
                        insight.type === "action" && "bg-purple-100 text-purple-700 hover:bg-purple-200"
                    )}
                >
                    {insight.text}
                </motion.button>
            ))}
        </div>
    );
}

// ============================================================================
// EXPORTS
// ============================================================================

export type { QuerySuggestion, QueryResult, ParsedQuery, QuickInsight };
