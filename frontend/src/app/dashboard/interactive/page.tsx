"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    CelebrationProvider,
    useCelebration,
    celebrations,
    MiniCelebration,
    LivePulse,
    DataUpdateFlash,
    AnimatedCounter,
    ConnectionStatus,
    LastUpdated,
    DataSyncStatus,
    ActivityFeed,
    Heartbeat,
    InteractiveNotificationList,
    InteractiveChart,
    type InteractiveNotification,
} from "@/components/ui";
import {
    Sparkles, Zap, Trophy, Target, Flame,
    PartyPopper, Medal, Star, Activity, TrendingUp,
} from "lucide-react";

// Demo Data
const chartData = [
    { name: "Jan", revenue: 4000, users: 2400, sessions: 1800 },
    { name: "Feb", revenue: 3000, users: 1398, sessions: 2210 },
    { name: "Mar", revenue: 2000, users: 9800, sessions: 2290 },
    { name: "Apr", revenue: 2780, users: 3908, sessions: 2000 },
    { name: "May", revenue: 1890, users: 4800, sessions: 2181 },
    { name: "Jun", revenue: 2390, users: 3800, sessions: 2500 },
    { name: "Jul", revenue: 3490, users: 4300, sessions: 2100 },
];

const initialNotifications: InteractiveNotification[] = [
    {
        id: "1",
        type: "success",
        title: "Dashboard Updated",
        message: "Your analytics dashboard has been refreshed with new data from all connected sources.",
        timestamp: new Date(Date.now() - 5 * 60000),
        read: false,
        priority: "high",
        actions: [
            { label: "View Dashboard", action: () => console.log("View"), variant: "primary" },
            { label: "Dismiss", action: () => { }, variant: "secondary" },
        ],
    },
    {
        id: "2",
        type: "warning",
        title: "API Rate Limit Warning",
        message: "You've used 80% of your API rate limit for this hour.",
        timestamp: new Date(Date.now() - 15 * 60000),
        read: false,
        priority: "medium",
    },
    {
        id: "3",
        type: "info",
        title: "New Feature Available",
        message: "Check out our new interactive charts with drill-down capabilities!",
        timestamp: new Date(Date.now() - 60 * 60000),
        read: true,
        pinned: true,
    },
    {
        id: "4",
        type: "message",
        title: "Team Comment",
        message: "John mentioned you in a comment on the Q4 Revenue Report.",
        timestamp: new Date(Date.now() - 2 * 60 * 60000),
        read: true,
        source: "Revenue Dashboard",
    },
];

const activities = [
    { id: "1", type: "update" as const, message: "Revenue data refreshed", timestamp: new Date(), source: "Stripe" },
    { id: "2", type: "sync" as const, message: "Google Analytics synced", timestamp: new Date(Date.now() - 60000) },
    { id: "3", type: "alert" as const, message: "Traffic spike detected", timestamp: new Date(Date.now() - 120000), source: "Analytics" },
    { id: "4", type: "create" as const, message: "New widget added", timestamp: new Date(Date.now() - 180000) },
];

const dataSources = [
    { name: "Google Analytics", status: "synced" as const, lastSync: new Date() },
    { name: "Stripe", status: "syncing" as const },
    { name: "Asana", status: "synced" as const, lastSync: new Date(Date.now() - 300000) },
    { name: "HubSpot", status: "error" as const },
];

// Celebration Demo Component
function CelebrationDemo() {
    const { celebrate, showConfetti } = useCelebration();
    const [streakCount, setStreakCount] = useState(0);
    const [goalProgress, setGoalProgress] = useState(0);

    const triggerMilestone = () => {
        celebrate(celebrations.milestone("First Dashboard", "You created your first dashboard!", 100));
    };

    const triggerStreak = () => {
        const newStreak = streakCount + 7;
        setStreakCount(newStreak);
        celebrate(celebrations.streak(newStreak));
    };

    const triggerGoal = () => {
        const newProgress = Math.min(100, goalProgress + 25);
        setGoalProgress(newProgress);
        if (newProgress >= 100) {
            celebrate(celebrations.goal("Monthly Revenue", 100));
        } else {
            showConfetti({ particleCount: 30, duration: 1500 });
        }
    };

    const triggerLevelUp = () => {
        celebrate(celebrations.levelUp(Math.floor(Math.random() * 10) + 1));
    };

    const triggerBadge = () => {
        const badges = ["Data Maven", "Early Adopter", "Power User", "Integration Master"];
        const rarities: ("common" | "rare" | "epic" | "legendary")[] = ["common", "rare", "epic", "legendary"];
        celebrate(celebrations.badge(badges[Math.floor(Math.random() * badges.length)], rarities[Math.floor(Math.random() * rarities.length)]));
    };

    const triggerRecord = () => {
        celebrate(celebrations.record("Highest Revenue", "$" + (Math.random() * 10000).toFixed(0)));
    };

    return (
        <div className="rounded-2xl bg-linear-to-br from-purple-500/10 via-pink-500/10 to-blue-500/10 p-6">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold">
                <PartyPopper className="h-5 w-5 text-amber-500" />
                Achievement Celebrations
            </h3>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                Click any button to trigger a celebration with confetti and achievement toast!
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <button onClick={triggerMilestone} className="flex items-center gap-2 rounded-xl bg-blue-500 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-blue-600">
                    <Target className="h-4 w-4" /> Milestone
                </button>
                <button onClick={triggerStreak} className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-orange-600">
                    <Flame className="h-4 w-4" /> Streak +7
                </button>
                <button onClick={triggerGoal} className="flex items-center gap-2 rounded-xl bg-green-500 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-green-600">
                    <Trophy className="h-4 w-4" /> Goal +25%
                </button>
                <button onClick={triggerLevelUp} className="flex items-center gap-2 rounded-xl bg-purple-500 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-purple-600">
                    <Zap className="h-4 w-4" /> Level Up
                </button>
                <button onClick={triggerBadge} className="flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-cyan-600">
                    <Medal className="h-4 w-4" /> Badge
                </button>
                <button onClick={triggerRecord} className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-3 text-sm font-medium text-white shadow-lg hover:bg-amber-600">
                    <Star className="h-4 w-4" /> Record
                </button>
            </div>
            {goalProgress > 0 && (
                <div className="mt-4">
                    <div className="flex justify-between text-sm mb-1">
                        <span>Goal Progress</span>
                        <span>{goalProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700">
                        <motion.div
                            className="h-full rounded-full bg-linear-to-r from-green-400 to-emerald-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${goalProgress}%` }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}

// Main Page Component
export default function InteractiveFeaturesPage() {
    const [notifications, setNotifications] = useState(initialNotifications);
    const [revenueValue, setRevenueValue] = useState(45231);
    const [connectionStatus, _setConnectionStatus] = useState<"connected" | "connecting" | "disconnected">("connected");
    const [lastUpdate, setLastUpdate] = useState(new Date());
    const [isRefreshing, setIsRefreshing] = useState(false);

    // Simulate real-time data updates
    useEffect(() => {
        const interval = setInterval(() => {
            setRevenueValue((prev) => prev + Math.floor(Math.random() * 200) - 50);
            setLastUpdate(new Date());
        }, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRefresh = () => {
        setIsRefreshing(true);
        setTimeout(() => {
            setLastUpdate(new Date());
            setIsRefreshing(false);
        }, 1500);
    };

    const handleDismissNotification = (id: string) => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
    };

    const handleReadNotification = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    };

    const handlePinNotification = (id: string) => {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: !n.pinned } : n)));
    };

    return (
        <CelebrationProvider>
            <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
                <div className="mx-auto max-w-7xl space-y-8">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <h1 className="bg-linear-to-r from-purple-600 via-pink-500 to-blue-500 bg-clip-text text-4xl font-bold text-transparent">
                            Interactive Features Demo
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Experience the new interactive components: celebrations, real-time animations, notifications, and charts
                        </p>
                    </motion.div>

                    {/* Real-Time Status Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800"
                    >
                        <div className="flex items-center gap-6">
                            <LivePulse isLive={connectionStatus === "connected"} size="md" />
                            <ConnectionStatus status={connectionStatus} />
                            <Heartbeat isActive={connectionStatus === "connected"} />
                        </div>
                        <LastUpdated timestamp={lastUpdate} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
                    </motion.div>

                    {/* Stats with Animations */}
                    <div className="grid gap-6 md:grid-cols-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <p className="text-sm text-gray-500">Total Revenue</p>
                            <div className="mt-2 flex items-center gap-2">
                                <AnimatedCounter value={revenueValue} format="currency" className="text-3xl" />
                                <MiniCelebration trigger={revenueValue > 45500} type="sparkle">
                                    <TrendingUp className="h-5 w-5 text-green-500" />
                                </MiniCelebration>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <p className="text-sm text-gray-500">Conversion Rate</p>
                            <DataUpdateFlash value={12.5} format="percentage" />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <p className="text-sm text-gray-500">Active Users</p>
                            <AnimatedCounter value={2847} duration={1500} className="text-3xl" />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.3 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <p className="text-sm text-gray-500">Sessions Today</p>
                            <AnimatedCounter value={15892} duration={2000} prefix="" suffix=" " className="text-3xl" />
                        </motion.div>
                    </div>

                    {/* Celebrations Section */}
                    <CelebrationDemo />

                    {/* Main Content Grid */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Interactive Chart */}
                        <div className="lg:col-span-2">
                            <InteractiveChart
                                data={chartData}
                                type="area"
                                dataKeys={["revenue", "users", "sessions"]}
                                title="Performance Analytics"
                                subtitle="Monthly overview with drill-down"
                                enableDrillDown
                                enableZoom
                                showTrendIndicator
                                onRefresh={handleRefresh}
                                isLoading={isRefreshing}
                            />
                        </div>

                        {/* Notifications Panel */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="rounded-2xl bg-white shadow-xl dark:bg-gray-800 overflow-hidden"
                            style={{ maxHeight: 500 }}
                        >
                            <InteractiveNotificationList
                                notifications={notifications}
                                onDismiss={handleDismissNotification}
                                onRead={handleReadNotification}
                                onPin={handlePinNotification}
                                onReadAll={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                            />
                        </motion.div>
                    </div>

                    {/* Activity & Sync Status */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <h3 className="mb-4 flex items-center gap-2 font-bold">
                                <Activity className="h-5 w-5 text-purple-500" />
                                Live Activity Feed
                            </h3>
                            <ActivityFeed activities={activities} maxItems={5} />
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <h3 className="mb-4 flex items-center gap-2 font-bold">
                                <Sparkles className="h-5 w-5 text-blue-500" />
                                Data Source Status
                            </h3>
                            <DataSyncStatus sources={dataSources} />
                        </motion.div>
                    </div>

                    {/* Chart Type Comparison */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <InteractiveChart
                            data={chartData}
                            type="bar"
                            dataKeys={["revenue", "users"]}
                            title="Bar Chart View"
                            subtitle="Click bars to see details"
                            height={300}
                        />
                        <InteractiveChart
                            data={chartData}
                            type="line"
                            dataKeys={["sessions", "users"]}
                            title="Line Chart View"
                            subtitle="With trend indicators"
                            height={300}
                            showTrendIndicator
                        />
                    </div>
                </div>
            </div>
        </CelebrationProvider>
    );
}
