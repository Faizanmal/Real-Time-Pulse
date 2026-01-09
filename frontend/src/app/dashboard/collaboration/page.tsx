"use client";

import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { advancedAiApi } from "@/lib/advanced-api";
import { toast } from "sonner";
import {
    // Collaboration
    PresenceIndicator,
    CollaboratorPanel,
    ActivityRing,
    TypingAwareness,
    type Collaborator,
    // Natural Language
    AIQueryInterface,
    QuickInsightsBar,
    type QueryResult,
    type QuickInsight,
    // Gamification
    XPProgressBar,
    BadgeCollection,
    StreakDisplay,
    Leaderboard,
    AchievementProgress,
    GamificationProvider,
    useGamification,
    LEVELS,
    type Badge,
    type Achievement,
    type Streak,
    type LeaderboardEntry,
} from "@/components/ui";
import {
    Users, Sparkles, Trophy, Star, Medal, Crown, Flame, Target,
    Zap, Award, Shield, Rocket, Brain,
} from "lucide-react";

// ============================================================================
// DEMO DATA
// ============================================================================

const demoCollaborators: Collaborator[] = [
    { id: "1", name: "You", color: "#8b5cf6", status: "online", role: "owner", currentPage: "Dashboard" },
    { id: "2", name: "Sarah Chen", color: "#ec4899", status: "online", currentPage: "Analytics", isTyping: true },
    { id: "3", name: "Mike Wilson", color: "#3b82f6", status: "online", currentPage: "Reports" },
    { id: "4", name: "Emily Davis", color: "#10b981", status: "away", role: "admin" },
    { id: "5", name: "Alex Thompson", color: "#f59e0b", status: "busy" },
    { id: "6", name: "Jordan Lee", color: "#ef4444", status: "offline" },
];

const demoBadges: Badge[] = [
    { id: "b1", name: "First Dashboard", description: "Create your first dashboard", icon: <Target className="h-5 w-5" />, rarity: "common", category: "achievement", unlockedAt: new Date() },
    { id: "b2", name: "Data Explorer", description: "View 100 data points", icon: <Sparkles className="h-5 w-5" />, rarity: "uncommon", category: "achievement", progress: 75, maxProgress: 100 },
    { id: "b3", name: "Integration Master", description: "Connect 5 integrations", icon: <Zap className="h-5 w-5" />, rarity: "rare", category: "skill", unlockedAt: new Date() },
    { id: "b4", name: "Team Player", description: "Collaborate with 10 users", icon: <Users className="h-5 w-5" />, rarity: "rare", category: "social", progress: 7, maxProgress: 10 },
    { id: "b5", name: "Power User", description: "Use the app for 30 days", icon: <Flame className="h-5 w-5" />, rarity: "epic", category: "milestone", progress: 21, maxProgress: 30 },
    { id: "b6", name: "Legendary Analyst", description: "Generate 1000 reports", icon: <Crown className="h-5 w-5" />, rarity: "legendary", category: "special" },
];

const demoAchievements: Achievement[] = [
    { id: "a1", name: "First Steps", description: "Complete the onboarding", icon: <Rocket className="h-5 w-5" />, points: 50, progress: 100, maxProgress: 100, category: "achievement", unlockedAt: new Date() },
    { id: "a2", name: "Data Wizard", description: "Create 10 custom widgets", icon: <Sparkles className="h-5 w-5" />, points: 100, progress: 7, maxProgress: 10, category: "skill" },
    { id: "a3", name: "Streak Champion", description: "Maintain a 7-day streak", icon: <Flame className="h-5 w-5" />, points: 200, progress: 5, maxProgress: 7, category: "social" },
    { id: "a4", name: "Secret Achievement", description: "???", icon: <Shield className="h-5 w-5" />, points: 500, progress: 0, maxProgress: 1, category: "special", secret: true },
];

const demoStreak: Streak = {
    type: "daily",
    current: 12,
    best: 21,
    lastActivity: new Date(),
    multiplier: 1.5,
};

const demoLeaderboard: LeaderboardEntry[] = [
    { rank: 1, userId: "u1", name: "Sarah Chen", score: 15420, change: 2, badges: [demoBadges[2], demoBadges[4]] },
    { rank: 2, userId: "u2", name: "Mike Wilson", score: 14850, change: -1 },
    { rank: 3, userId: "u3", name: "Emily Davis", score: 13200, change: 1 },
    { rank: 4, userId: "1", name: "You", score: 12500, change: 3, badges: [demoBadges[0], demoBadges[2]] },
    { rank: 5, userId: "u5", name: "Alex Thompson", score: 11800, change: 0 },
    { rank: 6, userId: "u6", name: "Jordan Lee", score: 10500, change: -2 },
    { rank: 7, userId: "u7", name: "Chris Martin", score: 9800 },
    { rank: 8, userId: "u8", name: "Lisa Wang", score: 9200 },
];

const demoInsights: QuickInsight[] = [
    { id: "i1", text: "Revenue up 15% this week", type: "positive" },
    { id: "i2", text: "3 tasks overdue", type: "negative" },
    { id: "i3", text: "New integration available", type: "action" },
    { id: "i4", text: "5 team members online", type: "neutral" },
];

// ============================================================================
// GAMIFICATION DEMO WRAPPER
// ============================================================================

function GamificationDemo() {
    const { state, addXP, getLevel, getNextLevel } = useGamification();
    const currentLevel = getLevel();
    const nextLevel = getNextLevel();

    return (
        <div className="space-y-6">
            {/* XP Progress */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
            >
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 font-bold">
                        <Trophy className="h-5 w-5 text-amber-500" />
                        Your Progress
                    </h3>
                    <button
                        onClick={() => addXP(50)}
                        className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
                    >
                        +50 XP
                    </button>
                </div>
                <XPProgressBar
                    currentXP={state.xp}
                    currentLevel={currentLevel}
                    nextLevel={nextLevel}
                    size="lg"
                />
                <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
                    <span>Total XP: {state.xp.toLocaleString()}</span>
                    <span>Level {state.level}</span>
                </div>
            </motion.div>

            {/* Streak */}
            <StreakDisplay streak={demoStreak} />

            {/* Achievements */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
            >
                <h3 className="mb-4 flex items-center gap-2 font-bold">
                    <Award className="h-5 w-5 text-purple-500" />
                    Achievements
                </h3>
                <div className="space-y-3">
                    {demoAchievements.map((achievement) => (
                        <AchievementProgress key={achievement.id} achievement={achievement} />
                    ))}
                </div>
            </motion.div>
        </div>
    );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function CollaborationPage() {
    const [currentUserId] = useState("1");
    const typingUsers = demoCollaborators.filter((c) => c.isTyping);

    // Real AI query handler using backend API
    const handleAIQuery = useCallback(async (query: string): Promise<QueryResult[]> => {
        try {
            const response = await advancedAiApi.processQuery(query);
            const aiQuery = response.data;
            
            // Transform API response to QueryResult format
            const results: QueryResult[] = [];
            
            if (aiQuery.response && typeof aiQuery.response === 'object') {
                const resultData = aiQuery.response as Record<string, unknown>;
                
                // Handle metrics if present
                if (resultData.metrics && Array.isArray(resultData.metrics)) {
                    (resultData.metrics as Array<{ name: string; value: number; change?: number; description?: string }>).forEach((metric, i) => {
                        results.push({
                            id: `metric-${i}`,
                            type: 'metric',
                            title: metric.name || 'Metric',
                            value: metric.value || 0,
                            change: metric.change,
                            description: metric.description,
                        });
                    });
                }
                
                // Handle insights if present
                if (resultData.insights && Array.isArray(resultData.insights)) {
                    (resultData.insights as Array<{ title: string; description: string }>).forEach((insight, i) => {
                        results.push({
                            id: `insight-${i}`,
                            type: 'insight',
                            title: insight.title || 'Insight',
                            description: insight.description,
                        });
                    });
                }
                
                // Handle SQL result if present
                if (aiQuery.sqlGenerated || resultData.data) {
                    results.push({
                        id: 'sql-result',
                        type: 'insight',
                        title: 'Query Result',
                        description: aiQuery.sqlGenerated ? `SQL: ${aiQuery.sqlGenerated}` : JSON.stringify(resultData.data),
                    });
                }
            }
            
            // If no structured results, show the raw response as insight
            if (results.length === 0) {
                results.push({
                    id: 'response',
                    type: 'insight',
                    title: 'Analysis Complete',
                    description: aiQuery.response ? String(aiQuery.response) : `Query processed: "${query}"`,
                });
            }
            
            return results;
        } catch (error) {
            console.error('AI Query error:', error);
            toast.error('Failed to process query');
            
            // Fallback to basic response
            return [
                {
                    id: 'error',
                    type: 'insight',
                    title: 'Query Processing',
                    description: `I analyzed your query "${query}". Please ensure the AI service is configured and try again.`,
                },
            ];
        }
    }, []);

    return (
        <GamificationProvider initialState={{ xp: 450, level: 3 }}>
            <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
                <div className="mx-auto max-w-7xl space-y-8">
                    {/* Header */}
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center"
                    >
                        <h1 className="bg-linear-to-r from-blue-600 via-purple-500 to-pink-500 bg-clip-text text-4xl font-bold text-transparent">
                            Phase 2: Advanced Features
                        </h1>
                        <p className="mt-2 text-gray-600 dark:text-gray-400">
                            Live Collaboration • Natural Language Search • Gamification
                        </p>
                    </motion.div>

                    {/* Presence Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800"
                    >
                        <PresenceIndicator collaborators={demoCollaborators} maxVisible={5} />
                        <TypingAwareness typingUsers={typingUsers} context="Dashboard" />
                    </motion.div>

                    {/* AI Search */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                    >
                        <div className="mb-4 flex items-center gap-2">
                            <Brain className="h-6 w-6 text-purple-500" />
                            <h2 className="text-xl font-bold">AI-Powered Data Query</h2>
                        </div>
                        <AIQueryInterface onQuery={handleAIQuery} />
                        <QuickInsightsBar insights={demoInsights} className="mt-4" />
                    </motion.div>

                    {/* Main Grid */}
                    <div className="grid gap-6 lg:grid-cols-3">
                        {/* Collaboration Panel */}
                        <div className="lg:col-span-1">
                            <CollaboratorPanel
                                collaborators={demoCollaborators}
                                currentUserId={currentUserId}
                                onInvite={() => console.log("Invite")}
                                onMessageUser={(id) => console.log("Message", id)}
                                onFollowUser={(id) => console.log("Follow", id)}
                            />

                            {/* Activity Ring */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="mt-6 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                            >
                                <h3 className="mb-4 flex items-center gap-2 font-bold">
                                    <Users className="h-5 w-5 text-blue-500" />
                                    Team Activity
                                </h3>
                                <div className="flex justify-center">
                                    <ActivityRing collaborators={demoCollaborators} size={150} />
                                </div>
                            </motion.div>
                        </div>

                        {/* Gamification */}
                        <div className="lg:col-span-2">
                            <GamificationDemo />

                            {/* Badges */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.3 }}
                                className="mt-6 rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                            >
                                <h3 className="mb-4 flex items-center gap-2 font-bold">
                                    <Medal className="h-5 w-5 text-amber-500" />
                                    Badge Collection
                                </h3>
                                <BadgeCollection
                                    badges={demoBadges}
                                    unlockedBadgeIds={["b1", "b3"]}
                                    onBadgeClick={(badge) => console.log("Badge clicked:", badge.name)}
                                />
                            </motion.div>
                        </div>
                    </div>

                    {/* Leaderboard */}
                    <div className="grid gap-6 md:grid-cols-2">
                        <Leaderboard
                            entries={demoLeaderboard}
                            currentUserId={currentUserId}
                            title="Weekly Leaderboard"
                        />

                        {/* All Levels Preview */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="rounded-2xl bg-white p-6 shadow-xl dark:bg-gray-800"
                        >
                            <h3 className="mb-4 flex items-center gap-2 font-bold">
                                <Star className="h-5 w-5 text-purple-500" />
                                Level Progression
                            </h3>
                            <div className="grid grid-cols-5 gap-3">
                                {LEVELS.map((level) => (
                                    <div
                                        key={level.level}
                                        className="flex flex-col items-center gap-1 rounded-xl p-3 text-center transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
                                    >
                                        <div
                                            className="flex h-10 w-10 items-center justify-center rounded-full text-white"
                                            style={{ backgroundColor: level.color }}
                                        >
                                            {level.icon}
                                        </div>
                                        <span className="text-xs font-medium">{level.name}</span>
                                        <span className="text-[10px] text-gray-500">Lv.{level.level}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </GamificationProvider>
    );
}
