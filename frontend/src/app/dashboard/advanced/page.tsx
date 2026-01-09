"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
    // Time Travel
    TimeTravelSlider,
    DateRangeQuickSelector,
    ComparisonSelector,
    PredictiveInsights,
    type TimePoint,
    type Prediction,
    // Context Menus & Gestures
    ContextMenuTrigger,
    buildQuickActions,
    SwipeableCard,
    ZoomPanContainer,
    // Onboarding
    OnboardingProvider,
    TourLauncher,
    FeatureAnnouncement,
    type OnboardingTour,
    // Annotations
    AnnotationLayer,
    type Annotation,
    type AnnotationType,
} from "@/components/ui";
import { useAnnotations } from "@/hooks/use-annotations";
import {
     Mouse, Layers, Sparkles,
     Target, Zap, MessageSquare,
} from "lucide-react";

// ============================================================================
// DEMO DATA
// ============================================================================

const generateTimePoints = (): TimePoint[] => {
    const points: TimePoint[] = [];
    const now = new Date();
    for (let i = 30; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        points.push({
            date,
            label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
            data: { value: Math.floor(Math.random() * 10000) + 5000 },
            isKeyframe: i % 7 === 0,
        });
    }
    return points;
};

const demoTimePoints = generateTimePoints();

const demoPredictions: Prediction[] = [
    {
        metric: "Monthly Revenue",
        currentValue: 125000,
        predictedValue: 148000,
        confidence: 87,
        trend: "up",
        timeframe: "Next 30 days",
        factors: ["Seasonal trends", "Marketing campaign", "New features"],
    },
    {
        metric: "Active Users",
        currentValue: 2847,
        predictedValue: 3200,
        confidence: 72,
        trend: "up",
        timeframe: "Next week",
        factors: ["Organic growth", "Referral program"],
    },
    {
        metric: "Churn Rate",
        currentValue: 5.2,
        predictedValue: 4.8,
        confidence: 65,
        trend: "down",
        timeframe: "Next month",
        factors: ["Improved onboarding", "Feature updates"],
    },
];

const demoAnnotations: Annotation[] = [
    {
        id: "a1",
        type: "comment",
        content: "Major spike in traffic after the product launch announcement.",
        author: { id: "1", name: "Sarah Chen" },
        position: { x: 25, y: 30 },
        dataPoint: { label: "Sessions", value: 15234, date: new Date() },
        timestamp: new Date(Date.now() - 3600000),
        replies: [
            { id: "r1", content: "Great timing with the PR coverage!", author: { id: "2", name: "Mike" }, timestamp: new Date() },
        ],
        likes: 5,
    },
    {
        id: "a2",
        type: "flag",
        content: "Investigating the sudden drop in conversions here.",
        author: { id: "2", name: "Mike Wilson" },
        position: { x: 55, y: 65 },
        dataPoint: { label: "Conversion", value: "2.1%", date: new Date() },
        timestamp: new Date(Date.now() - 7200000),
    },
    {
        id: "a3",
        type: "success",
        content: "Target achieved! Q4 revenue goal met 2 weeks early.",
        author: { id: "1", name: "Sarah Chen" },
        position: { x: 80, y: 25 },
        timestamp: new Date(Date.now() - 86400000),
        resolved: true,
    },
];

const demoTours: OnboardingTour[] = [
    {
        id: "dashboard-basics",
        name: "Dashboard Basics",
        description: "Learn how to navigate and use the dashboard",
        estimatedTime: "2 min",
        icon: <Layers className="h-5 w-5" />,
        steps: [
            { id: "s1", title: "Welcome to Your Dashboard", description: "This is your command center for all analytics and insights.", position: "center" },
            { id: "s2", title: "Time Travel Controls", description: "Use the timeline to explore historical data and see how metrics changed over time.", target: "#time-travel-demo", position: "bottom", tips: ["Click and drag to scrub through time", "Use keyboard arrows for precise control"] },
            { id: "s3", title: "Predictive Insights", description: "AI-powered predictions help you anticipate future trends.", target: "#predictions-demo", position: "left" },
            { id: "s4", title: "Data Annotations", description: "Add comments and flags directly on your charts to collaborate with your team.", target: "#annotations-demo", position: "top", action: "click" },
        ],
    },
    {
        id: "advanced-features",
        name: "Advanced Features",
        description: "Master gestures and context menus",
        estimatedTime: "3 min",
        icon: <Zap className="h-5 w-5" />,
        steps: [
            { id: "a1", title: "Gesture Controls", description: "Swipe, pinch, and tap to interact with cards and data.", position: "center" },
            { id: "a2", title: "Context Menus", description: "Right-click on any element for quick actions.", position: "center", action: "click" },
            { id: "a3", title: "Zoom & Pan", description: "Use the zoom controls or scroll to explore detailed views.", position: "center" },
        ],
    },
];

// ============================================================================
// SWIPEABLE DEMO CARDS
// ============================================================================

function SwipeableCardDemo() {
    const [cards, setCards] = useState([
        { id: "1", title: "Revenue Report Q4", subtitle: "Generated 2 hours ago" },
        { id: "2", title: "User Analytics", subtitle: "Updated 30 min ago" },
        { id: "3", title: "Conversion Metrics", subtitle: "Real-time" },
    ]);

    const handleSwipeLeft = (id: string) => {
        setCards((prev) => prev.filter((c) => c.id !== id));
    };

    const handleSwipeRight = (id: string) => {
        console.log("Archived:", id);
    };

    return (
        <div className="space-y-3">
            {cards.map((card) => (
                <SwipeableCard
                    key={card.id}
                    onSwipeLeft={() => handleSwipeLeft(card.id)}
                    onSwipeRight={() => handleSwipeRight(card.id)}
                >
                    <div className="rounded-xl bg-white p-4 shadow-lg dark:bg-gray-800">
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">{card.title}</h4>
                        <p className="text-sm text-gray-500">{card.subtitle}</p>
                    </div>
                </SwipeableCard>
            ))}
            {cards.length === 0 && (
                <div className="py-8 text-center text-gray-500">
                    All cards swiped! Refresh to see them again.
                </div>
            )}
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function Phase3DemoContent() {
    // const { startTour } = useOnboarding();
    const [timeIndex, setTimeIndex] = useState(demoTimePoints.length - 1);
    const [isPlaying, setIsPlaying] = useState(false);
    const [playbackSpeed, setPlaybackSpeed] = useState(1);
    const [dateRange, setDateRange] = useState("30d");
    const [compareEnabled, setCompareEnabled] = useState(false);
    const [comparePeriod, setComparePeriod] = useState("previous");
    // Integrated API Hook
    // Using a fixed portal ID for demo purposes - in production this would come from params or context
    const {
        annotations,
        addAnnotation,
        updateAnnotation,
        deleteAnnotation,
        replyToAnnotation,
        error: annotationsError
    } = useAnnotations("demo-portal-v3");

    // Fallback to demo data if API fails or is empty (and no error yet)
    // Note: This is checking if we have API annotations, otherwise using demo
    // For a pure integration, we might want to just show empty state from API
    // but for the demo page continuity, using demo data as fallback is safer if backend isn't running.
    // However, the hook controls 'annotations' state. If API returns [], it shows [].
    // Let's rely on the hook's state. If the user wants to see demo data, they need to seed the backend.

    const [showAnnouncement, setShowAnnouncement] = useState(true);

    const handleAddAnnotation = useCallback((position: { x: number; y: number }, type: AnnotationType) => {
        addAnnotation({
            x: position.x,
            y: position.y,
            type,
            content: "New annotation - click to edit"
        });
    }, [addAnnotation]);

    const handleDeleteAnnotation = useCallback((id: string) => {
        deleteAnnotation(id);
    }, [deleteAnnotation]);

    const contextMenuItems = buildQuickActions({
        onCopy: () => console.log("Copy"),
        onEdit: () => console.log("Edit"),
        onShare: () => console.log("Share"),
        onDownload: () => console.log("Download"),
        onPin: () => console.log("Pin"),
        onRefresh: () => console.log("Refresh"),
        onDelete: () => console.log("Delete"),
    });

    return (
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
            <div className="mx-auto max-w-7xl space-y-8">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                    >
                        <h1 className="bg-linear-to-r from-cyan-500 via-purple-500 to-pink-500 bg-clip-text text-4xl font-bold text-transparent">
                            Phase 3: Advanced Interactions
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Time Travel • Context Menus • Gestures • Onboarding • Annotations
                        </p>
                    </motion.div>

                    <TourLauncher tours={demoTours} />
                </div>

                {/* Feature Announcement */}
                {showAnnouncement && (
                    <FeatureAnnouncement
                        title="New: AI Predictions are here!"
                        description="Get intelligent forecasts powered by machine learning. See what's coming next for your key metrics."
                        variant="celebration"
                        icon={<Sparkles className="h-6 w-6" />}
                        onAction={() => {
                            const predictionsEl = document.getElementById("predictions-demo");
                            predictionsEl?.scrollIntoView({ behavior: "smooth" });
                            setShowAnnouncement(false);
                        }}
                        onDismiss={() => setShowAnnouncement(false)}
                    />
                )}

                {/* Date & Comparison Controls */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800"
                >
                    <DateRangeQuickSelector
                        value={dateRange}
                        onChange={(v) => setDateRange(v)}
                    />
                    <ComparisonSelector
                        enabled={compareEnabled}
                        onToggle={setCompareEnabled}
                        period={comparePeriod}
                        onPeriodChange={setComparePeriod}
                    />
                </motion.div>

                {/* Time Travel Slider */}
                <div id="time-travel-demo">
                    <TimeTravelSlider
                        timePoints={demoTimePoints}
                        currentIndex={timeIndex}
                        onChange={setTimeIndex}
                        isPlaying={isPlaying}
                        onPlayPause={() => setIsPlaying(!isPlaying)}
                        playbackSpeed={playbackSpeed}
                        onSpeedChange={setPlaybackSpeed}
                        showThumbnails
                        onSnapshot={(idx) => console.log("Snapshot at:", demoTimePoints[idx].label)}
                    />
                </div>

                {/* Main Grid */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Predictive Insights */}
                    <div id="predictions-demo">
                        <PredictiveInsights
                            predictions={demoPredictions}
                            onViewDetails={(p) => console.log("View details:", p.metric)}
                        />
                    </div>

                    {/* Gesture Controls Demo */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                    >
                        <h3 className="mb-4 flex items-center gap-2 font-bold">
                            <Mouse className="h-5 w-5 text-purple-500" />
                            Gesture Controls
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Try swiping cards left to delete or right to archive:
                        </p>
                        <SwipeableCardDemo />
                    </motion.div>
                </div>

                {/* Context Menu + Annotations Demo */}
                <div className="grid gap-6 lg:grid-cols-2">
                    {/* Context Menu Demo */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                    >
                        <h3 className="mb-4 flex items-center gap-2 font-bold">
                            <Layers className="h-5 w-5 text-blue-500" />
                            Context Menu Demo
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Right-click on the card below to see the context menu:
                        </p>
                        <ContextMenuTrigger items={contextMenuItems}>
                            <div className="cursor-context-menu rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-8 text-center transition-colors hover:border-purple-500 hover:bg-purple-50 dark:border-gray-600 dark:bg-gray-700/50 dark:hover:border-purple-500">
                                <p className="text-gray-600 dark:text-gray-400">
                                    Right-click here for context menu
                                </p>
                                <p className="mt-2 text-sm text-gray-400">
                                    (or long-press on mobile)
                                </p>
                            </div>
                        </ContextMenuTrigger>
                    </motion.div>

                    {/* Zoom Pan Demo */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                    >
                        <h3 className="mb-4 flex items-center gap-2 font-bold">
                            <Target className="h-5 w-5 text-green-500" />
                            Zoom & Pan Demo
                        </h3>
                        <p className="mb-4 text-sm text-gray-500">
                            Use the controls or scroll (Ctrl+scroll) to zoom:
                        </p>
                        <ZoomPanContainer className="h-64 rounded-xl bg-linear-to-br from-purple-100 via-pink-100 to-blue-100 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-blue-900/20">
                            <div className="flex h-full items-center justify-center">
                                <div className="text-center">
                                    <div className="text-6xl">📊</div>
                                    <p className="mt-4 text-lg font-medium">Zoomable Content</p>
                                    <p className="text-sm text-gray-500">Pan me around!</p>
                                </div>
                            </div>
                        </ZoomPanContainer>
                    </motion.div>
                </div>

                {/* Data Annotations Demo */}
                <motion.div
                    id="annotations-demo"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                >
                    <h3 className="mb-4 flex items-center gap-2 font-bold">
                        <MessageSquare className="h-5 w-5 text-orange-500" />
                        Data Annotations
                    </h3>
                    <p className="mb-4 text-sm text-gray-500">
                        Click annotation icons to view details. Use the toolbar to add new annotations:
                    </p>
                    <div className="relative h-80 rounded-xl bg-linear-to-r from-blue-50 via-purple-50 to-pink-50 dark:from-blue-900/20 dark:via-purple-900/20 dark:to-pink-900/20">
                        {/* Fake chart background */}
                        <svg className="h-full w-full" viewBox="0 0 100 50" preserveAspectRatio="none">
                            <path
                                d="M 0 40 Q 10 35, 20 38 T 40 25 T 60 30 T 80 20 T 100 25"
                                fill="none"
                                stroke="rgba(139,92,246,0.3)"
                                strokeWidth="0.5"
                            />
                            <path
                                d="M 0 45 Q 15 40, 25 42 T 50 35 T 75 28 T 100 30"
                                fill="none"
                                stroke="rgba(236,72,153,0.3)"
                                strokeWidth="0.5"
                            />
                        </svg>
                        <AnnotationLayer
                            annotations={annotationsError ? demoAnnotations : annotations}
                            onAddAnnotation={handleAddAnnotation}
                            onDeleteAnnotation={handleDeleteAnnotation}
                            onUpdateAnnotation={(id, updates) => updateAnnotation(id, updates)}
                            onReplyToAnnotation={(id, content) => replyToAnnotation(id, content)}
                            currentUserId="1"
                        />
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default function Phase3DemoPage() {
    return (
        <OnboardingProvider>
            <Phase3DemoContent />
        </OnboardingProvider>
    );
}
