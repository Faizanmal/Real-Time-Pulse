"use client";

import { useState, useEffect, useCallback, createContext, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    Trophy, Star, Medal, Crown, Flame, Target, Zap, Award, Gift,
    TrendingUp, Calendar, Users, CheckCircle2, Lock, ChevronRight,
    Sparkles, Heart, Shield, Rocket, Diamond, Gem,
} from "lucide-react";
import { gamificationApi, GamificationProfile } from "@/lib/api/gamification";
import { useSocketEvent } from "@/contexts/socket-context";

// ============================================================================
// TYPES
// ============================================================================

type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

interface Badge {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    rarity: BadgeRarity;
    unlockedAt?: Date;
    progress?: number;
    maxProgress?: number;
    category: "achievement" | "milestone" | "skill" | "social" | "special";
}

interface Achievement {
    id: string;
    name: string;
    description: string;
    icon: React.ReactNode;
    points: number;
    unlockedAt?: Date;
    progress: number;
    maxProgress: number;
    category: string;
    secret?: boolean;
}

interface Level {
    level: number;
    name: string;
    minXP: number;
    maxXP: number;
    color: string;
    icon: React.ReactNode;
    perks?: string[];
}

interface Streak {
    type: "daily" | "weekly" | "monthly";
    current: number;
    best: number;
    lastActivity?: Date;
    multiplier: number;
}

interface LeaderboardEntry {
    rank: number;
    userId: string;
    name: string;
    avatar?: string;
    score: number;
    change?: number;
    badges?: Badge[];
}

interface GamificationState {
    xp: number;
    level: number;
    badges: Badge[];
    achievements: Achievement[];
    streaks: Streak[];
    points: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const RARITY_COLORS: Record<BadgeRarity, { bg: string; border: string; text: string; glow: string }> = {
    common: { bg: "from-gray-400 to-gray-500", border: "border-gray-400", text: "text-gray-600", glow: "shadow-gray-400/30" },
    uncommon: { bg: "from-green-400 to-green-600", border: "border-green-500", text: "text-green-600", glow: "shadow-green-500/30" },
    rare: { bg: "from-blue-400 to-blue-600", border: "border-blue-500", text: "text-blue-600", glow: "shadow-blue-500/30" },
    epic: { bg: "from-purple-400 to-purple-600", border: "border-purple-500", text: "text-purple-600", glow: "shadow-purple-500/30" },
    legendary: { bg: "from-amber-400 to-orange-500", border: "border-amber-500", text: "text-amber-600", glow: "shadow-amber-500/30" },
};

const LEVELS: Level[] = [
    { level: 1, name: "Newcomer", minXP: 0, maxXP: 100, color: "#9ca3af", icon: <Star className="h-4 w-4" /> },
    { level: 2, name: "Explorer", minXP: 100, maxXP: 300, color: "#22c55e", icon: <Zap className="h-4 w-4" /> },
    { level: 3, name: "Achiever", minXP: 300, maxXP: 600, color: "#3b82f6", icon: <Target className="h-4 w-4" /> },
    { level: 4, name: "Expert", minXP: 600, maxXP: 1000, color: "#8b5cf6", icon: <Award className="h-4 w-4" /> },
    { level: 5, name: "Master", minXP: 1000, maxXP: 1500, color: "#ec4899", icon: <Crown className="h-4 w-4" /> },
    { level: 6, name: "Champion", minXP: 1500, maxXP: 2500, color: "#f59e0b", icon: <Trophy className="h-4 w-4" /> },
    { level: 7, name: "Legend", minXP: 2500, maxXP: 4000, color: "#ef4444", icon: <Flame className="h-4 w-4" /> },
    { level: 8, name: "Mythic", minXP: 4000, maxXP: 6000, color: "#06b6d4", icon: <Diamond className="h-4 w-4" /> },
    { level: 9, name: "Immortal", minXP: 6000, maxXP: 10000, color: "#a855f7", icon: <Gem className="h-4 w-4" /> },
    { level: 10, name: "Transcendent", minXP: 10000, maxXP: Infinity, color: "#fbbf24", icon: <Sparkles className="h-4 w-4" />, perks: ["All features unlocked", "Custom themes", "Priority support"] },
];

const ICON_MAP: Record<string, React.ReactNode> = {
    "trophy": <Trophy className="h-4 w-4" />,
    "star": <Star className="h-4 w-4" />,
    "medal": <Medal className="h-4 w-4" />,
    "crown": <Crown className="h-4 w-4" />,
    "flame": <Flame className="h-4 w-4" />,
    "target": <Target className="h-4 w-4" />,
    "zap": <Zap className="h-4 w-4" />,
    "award": <Award className="h-4 w-4" />,
    "gift": <Gift className="h-4 w-4" />,
    "rocket": <Rocket className="h-4 w-4" />,
    "diamond": <Diamond className="h-4 w-4" />,
};

const mapBackendBadge = (ub: any): Badge => ({
    id: ub.badge.id,
    name: ub.badge.name,
    description: ub.badge.description,
    icon: ICON_MAP[ub.badge.icon] || <Award className="h-4 w-4" />,
    rarity: ub.badge.rarity.toLowerCase() as BadgeRarity,
    category: ub.badge.category.toLowerCase() as any,
    unlockedAt: new Date(ub.earnedAt),
    progress: 100,
    maxProgress: 100
});

// ============================================================================
// XP PROGRESS BAR
// ============================================================================

interface XPProgressBarProps {
    currentXP: number;
    currentLevel: Level;
    nextLevel?: Level;
    showDetails?: boolean;
    size?: "sm" | "md" | "lg";
    className?: string;
}

export function XPProgressBar({
    currentXP,
    currentLevel,
    nextLevel,
    showDetails = true,
    size = "md",
    className,
}: XPProgressBarProps) {
    const xpInLevel = currentXP - currentLevel.minXP;
    const xpNeeded = (nextLevel?.minXP || currentLevel.maxXP) - currentLevel.minXP;
    const progress = Math.min((xpInLevel / xpNeeded) * 100, 100);

    const heights = { sm: "h-2", md: "h-3", lg: "h-4" };

    return (
        <div className={cn("space-y-2", className)}>
            {showDetails && (
                <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                        <span
                            className="flex h-6 w-6 items-center justify-center rounded-full text-white"
                            style={{ backgroundColor: currentLevel.color }}
                        >
                            {currentLevel.icon}
                        </span>
                        <span className="font-medium">{currentLevel.name}</span>
                    </div>
                    {nextLevel && (
                        <span className="text-gray-500">
                            {xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP
                        </span>
                    )}
                </div>
            )}

            <div className={cn("overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700", heights[size])}>
                <motion.div
                    className={cn("h-full rounded-full", heights[size])}
                    style={{ backgroundColor: currentLevel.color }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                />
            </div>

            {showDetails && nextLevel && (
                <div className="flex items-center justify-end gap-1 text-xs text-gray-500">
                    <span>Next: {nextLevel.name}</span>
                    <span
                        className="flex h-4 w-4 items-center justify-center rounded-full text-white text-[10px]"
                        style={{ backgroundColor: nextLevel.color }}
                    >
                        {nextLevel.icon}
                    </span>
                </div>
            )}
        </div>
    );
}

// ============================================================================
// BADGE DISPLAY
// ============================================================================

interface BadgeDisplayProps {
    badge: Badge;
    size?: "sm" | "md" | "lg";
    showTooltip?: boolean;
    locked?: boolean;
    onClick?: () => void;
}

const badgeSizes = {
    sm: { container: "h-10 w-10", icon: "h-5 w-5" },
    md: { container: "h-14 w-14", icon: "h-7 w-7" },
    lg: { container: "h-20 w-20", icon: "h-10 w-10" },
};

export function BadgeDisplay({
    badge,
    size = "md",
    showTooltip = true,
    locked = false,
    onClick,
}: BadgeDisplayProps) {
    const [isHovered, setIsHovered] = useState(false);
    const colors = RARITY_COLORS[badge.rarity];
    const sizes = badgeSizes[size];

    return (
        <div
            className="relative"
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
        >
            <motion.button
                onClick={onClick}
                whileHover={!locked ? { scale: 1.1, rotate: 5 } : {}}
                whileTap={!locked ? { scale: 0.95 } : {}}
                className={cn(
                    "relative flex items-center justify-center rounded-2xl border-2 bg-gradient-to-br shadow-lg transition-shadow",
                    colors.bg,
                    colors.border,
                    !locked && colors.glow,
                    sizes.container,
                    locked && "opacity-50 grayscale"
                )}
            >
                <div className={cn("text-white", sizes.icon)}>
                    {locked ? <Lock className={sizes.icon} /> : badge.icon}
                </div>

                {/* Progress ring for incomplete badges */}
                {!locked && badge.progress !== undefined && badge.maxProgress && badge.progress < badge.maxProgress && (
                    <svg className="absolute inset-0" viewBox="0 0 100 100">
                        <circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="rgba(255,255,255,0.3)"
                            strokeWidth="4"
                        />
                        <motion.circle
                            cx="50"
                            cy="50"
                            r="45"
                            fill="none"
                            stroke="white"
                            strokeWidth="4"
                            strokeLinecap="round"
                            strokeDasharray={`${(badge.progress / badge.maxProgress) * 283} 283`}
                            initial={{ strokeDasharray: "0 283" }}
                            animate={{ strokeDasharray: `${(badge.progress / badge.maxProgress) * 283} 283` }}
                            style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
                        />
                    </svg>
                )}
            </motion.button>

            {/* Tooltip */}
            <AnimatePresence>
                {showTooltip && isHovered && (
                    <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 5 }}
                        className="absolute left-1/2 top-full z-50 mt-2 w-48 -translate-x-1/2 rounded-xl bg-gray-900 p-3 text-center text-white shadow-xl"
                    >
                        <p className={cn("text-xs font-bold uppercase", colors.text)}>{badge.rarity}</p>
                        <p className="mt-1 font-semibold">{badge.name}</p>
                        <p className="mt-1 text-xs text-gray-400">{badge.description}</p>
                        {badge.progress !== undefined && badge.maxProgress && (
                            <div className="mt-2 text-xs">
                                <div className="h-1.5 overflow-hidden rounded-full bg-gray-700">
                                    <div
                                        className="h-full rounded-full bg-white"
                                        style={{ width: `${(badge.progress / badge.maxProgress) * 100}%` }}
                                    />
                                </div>
                                <p className="mt-1 text-gray-400">
                                    {badge.progress} / {badge.maxProgress}
                                </p>
                            </div>
                        )}
                        {badge.unlockedAt && (
                            <p className="mt-2 text-xs text-gray-500">
                                Unlocked {new Date(badge.unlockedAt).toLocaleDateString()}
                            </p>
                        )}
                        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rotate-45 bg-gray-900" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// ============================================================================
// BADGE COLLECTION
// ============================================================================

interface BadgeCollectionProps {
    badges: Badge[];
    unlockedBadgeIds: string[];
    onBadgeClick?: (badge: Badge) => void;
    className?: string;
}

export function BadgeCollection({
    badges,
    unlockedBadgeIds,
    onBadgeClick,
    className,
}: BadgeCollectionProps) {
    const categories = [...new Set(badges.map((b) => b.category))];

    return (
        <div className={cn("space-y-6", className)}>
            {categories.map((category) => (
                <div key={category}>
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold capitalize text-gray-500">
                        <Award className="h-4 w-4" />
                        {category} Badges
                    </h3>
                    <div className="flex flex-wrap gap-3">
                        {badges
                            .filter((b) => b.category === category)
                            .map((badge) => (
                                <BadgeDisplay
                                    key={badge.id}
                                    badge={badge}
                                    locked={!unlockedBadgeIds.includes(badge.id)}
                                    onClick={() => onBadgeClick?.(badge)}
                                />
                            ))}
                    </div>
                </div>
            ))}
        </div>
    );
}

// ============================================================================
// STREAK DISPLAY
// ============================================================================

interface StreakDisplayProps {
    streak: Streak;
    compact?: boolean;
    className?: string;
}

export function StreakDisplay({ streak, compact = false, className }: StreakDisplayProps) {
    const isActive = streak.lastActivity &&
        Date.now() - new Date(streak.lastActivity).getTime() <
        (streak.type === "daily" ? 86400000 : streak.type === "weekly" ? 604800000 : 2592000000);

    if (compact) {
        return (
            <div className={cn("flex items-center gap-2", className)}>
                <Flame className={cn("h-5 w-5", isActive ? "text-orange-500" : "text-gray-400")} />
                <span className={cn("font-bold", isActive ? "text-orange-500" : "text-gray-400")}>
                    {streak.current}
                </span>
            </div>
        );
    }

    return (
        <motion.div
            className={cn(
                "rounded-2xl p-4 shadow-lg",
                isActive
                    ? "bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/30"
                    : "bg-gray-100 dark:bg-gray-800",
                className
            )}
            whileHover={{ scale: 1.02 }}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <motion.div
                        animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                    >
                        <Flame className={cn("h-8 w-8", isActive ? "text-orange-500" : "text-gray-400")} />
                    </motion.div>
                    <div>
                        <p className="text-sm text-gray-500 capitalize">{streak.type} Streak</p>
                        <p className={cn("text-2xl font-bold", isActive ? "text-orange-500" : "text-gray-400")}>
                            {streak.current} {streak.type === "daily" ? "days" : streak.type === "weekly" ? "weeks" : "months"}
                        </p>
                    </div>
                </div>

                {streak.multiplier > 1 && (
                    <div className="rounded-xl bg-orange-500 px-3 py-1 text-sm font-bold text-white">
                        {streak.multiplier}x XP
                    </div>
                )}
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                <span>Best: {streak.best}</span>
                {!isActive && <span className="text-red-500">Streak broken! Start again</span>}
            </div>
        </motion.div>
    );
}

// ============================================================================
// LEADERBOARD
// ============================================================================

interface LeaderboardProps {
    entries: LeaderboardEntry[];
    currentUserId?: string;
    title?: string;
    showTop?: number;
    className?: string;
}

export function Leaderboard({
    entries,
    currentUserId,
    title = "Leaderboard",
    showTop = 10,
    className,
}: LeaderboardProps) {
    const displayedEntries = entries.slice(0, showTop);
    const currentUserEntry = entries.find((e) => e.userId === currentUserId);
    const currentUserNotInTop = currentUserEntry && currentUserEntry.rank > showTop;

    return (
        <div className={cn("rounded-2xl bg-white p-4 shadow-xl dark:bg-gray-800", className)}>
            <h3 className="mb-4 flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
                <Trophy className="h-5 w-5 text-amber-500" />
                {title}
            </h3>

            <div className="space-y-2">
                {displayedEntries.map((entry, index) => (
                    <motion.div
                        key={entry.userId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={cn(
                            "flex items-center gap-3 rounded-xl p-3 transition-colors",
                            entry.userId === currentUserId
                                ? "bg-purple-50 ring-2 ring-purple-500 dark:bg-purple-900/20"
                                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                        )}
                    >
                        {/* Rank */}
                        <div className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold",
                            entry.rank === 1 && "bg-amber-400 text-white",
                            entry.rank === 2 && "bg-gray-300 text-gray-700",
                            entry.rank === 3 && "bg-amber-600 text-white",
                            entry.rank > 3 && "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
                        )}>
                            {entry.rank === 1 ? <Crown className="h-4 w-4" /> : entry.rank}
                        </div>

                        {/* Avatar */}
                        {entry.avatar ? (
                            <img src={entry.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                        ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 text-sm font-medium text-white">
                                {entry.name.charAt(0)}
                            </div>
                        )}

                        {/* Name & Score */}
                        <div className="flex-1">
                            <p className="font-medium text-gray-900 dark:text-gray-100">{entry.name}</p>
                            <p className="text-sm text-gray-500">{entry.score.toLocaleString()} pts</p>
                        </div>

                        {/* Change indicator */}
                        {entry.change !== undefined && entry.change !== 0 && (
                            <div className={cn(
                                "flex items-center gap-1 text-xs font-medium",
                                entry.change > 0 ? "text-green-500" : "text-red-500"
                            )}>
                                <TrendingUp className={cn("h-3 w-3", entry.change < 0 && "rotate-180")} />
                                {Math.abs(entry.change)}
                            </div>
                        )}

                        {/* Badges preview */}
                        {entry.badges && entry.badges.length > 0 && (
                            <div className="flex -space-x-1">
                                {entry.badges.slice(0, 3).map((badge) => (
                                    <div
                                        key={badge.id}
                                        className={cn(
                                            "flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs border-2 border-white dark:border-gray-800",
                                            RARITY_COLORS[badge.rarity].bg
                                        )}
                                    >
                                        {badge.icon}
                                    </div>
                                ))}
                            </div>
                        )}
                    </motion.div>
                ))}

                {/* Show current user if not in top */}
                {currentUserNotInTop && currentUserEntry && (
                    <>
                        <div className="my-2 flex items-center gap-2 text-xs text-gray-400">
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                            <span>...</span>
                            <div className="h-px flex-1 bg-gray-200 dark:bg-gray-700" />
                        </div>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex items-center gap-3 rounded-xl bg-purple-50 p-3 ring-2 ring-purple-500 dark:bg-purple-900/20"
                        >
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600 dark:bg-gray-700">
                                {currentUserEntry.rank}
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-500 text-sm font-medium text-white">
                                {currentUserEntry.name.charAt(0)}
                            </div>
                            <div className="flex-1">
                                <p className="font-medium text-gray-900 dark:text-gray-100">
                                    {currentUserEntry.name} <span className="text-xs text-purple-500">(You)</span>
                                </p>
                                <p className="text-sm text-gray-500">{currentUserEntry.score.toLocaleString()} pts</p>
                            </div>
                        </motion.div>
                    </>
                )}
            </div>
        </div>
    );
}

// ============================================================================
// ACHIEVEMENT PROGRESS
// ============================================================================

interface AchievementProgressProps {
    achievement: Achievement;
    onClick?: () => void;
    className?: string;
}

export function AchievementProgress({ achievement, onClick, className }: AchievementProgressProps) {
    const isCompleted = achievement.progress >= achievement.maxProgress;
    const progress = (achievement.progress / achievement.maxProgress) * 100;

    return (
        <motion.button
            onClick={onClick}
            whileHover={{ scale: 1.02 }}
            className={cn(
                "flex w-full items-center gap-4 rounded-xl p-4 text-left transition-colors",
                isCompleted
                    ? "bg-green-50 dark:bg-green-900/20"
                    : "bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700",
                className
            )}
        >
            {/* Icon */}
            <div className={cn(
                "flex h-12 w-12 items-center justify-center rounded-xl",
                isCompleted
                    ? "bg-green-500 text-white"
                    : "bg-gray-200 text-gray-500 dark:bg-gray-700"
            )}>
                {isCompleted ? <CheckCircle2 className="h-6 w-6" /> : achievement.icon}
            </div>

            {/* Content */}
            <div className="flex-1">
                <div className="flex items-center justify-between">
                    <p className={cn(
                        "font-medium",
                        isCompleted ? "text-green-700 dark:text-green-400" : "text-gray-900 dark:text-gray-100"
                    )}>
                        {achievement.secret && !isCompleted ? "???" : achievement.name}
                    </p>
                    <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
                        +{achievement.points}
                        <Star className="h-3 w-3" />
                    </span>
                </div>
                <p className="mt-0.5 text-sm text-gray-500">
                    {achievement.secret && !isCompleted ? "Complete the challenge to reveal" : achievement.description}
                </p>

                {/* Progress bar */}
                {!isCompleted && (
                    <div className="mt-2">
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <motion.div
                                className="h-full rounded-full bg-purple-500"
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.5 }}
                            />
                        </div>
                        <p className="mt-1 text-xs text-gray-400">
                            {achievement.progress} / {achievement.maxProgress}
                        </p>
                    </div>
                )}
            </div>

            <ChevronRight className="h-5 w-5 text-gray-400" />
        </motion.button>
    );
}

// ============================================================================
// GAMIFICATION CONTEXT
// ============================================================================

interface GamificationContextType {
    state: GamificationState;
    addXP: (amount: number) => void;
    unlockBadge: (badgeId: string) => void;
    updateAchievement: (achievementId: string, progress: number) => void;
    getLevel: () => Level;
    getNextLevel: () => Level | undefined;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function GamificationProvider({ children, initialState }: { children: React.ReactNode; initialState?: Partial<GamificationState> }) {
    const [state, setState] = useState<GamificationState>({
        xp: 0,
        level: 1,
        badges: [],
        achievements: [],
        streaks: [],
        points: 0,
        ...initialState,
    });

    useSocketEvent('xp_gained', (data) => {
        setState(prev => ({ ...prev, xp: data.totalXp, level: data.level }));
    });

    useSocketEvent('badge_earned', (data) => {
        setState(prev => ({ ...prev, badges: [...prev.badges, mapBackendBadge(data.badge)] }));
    });

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                // Check if we have a valid token
                const profile = await gamificationApi.getProfile();

                // Map backend badges to frontend format
                const mappedBadges: Badge[] = profile.badges.map(mapBackendBadge);

                const mappedAchievements: Achievement[] = profile.achievements.map((ua: any) => ({
                    id: ua.achievement.id,
                    name: ua.achievement.name,
                    description: ua.achievement.description,
                    icon: <Trophy className="h-4 w-4" />, // Default or map if available
                    points: ua.achievement.points,
                    unlockedAt: ua.completed ? new Date(ua.completedAt) : undefined,
                    progress: ua.progress,
                    maxProgress: 100, // Assumption or fetch real max
                    category: ua.achievement.category?.toLowerCase() || 'general'
                }));

                setState(prev => ({
                    ...prev,
                    xp: profile.xp,
                    level: profile.level,
                    badges: mappedBadges,
                    achievements: mappedAchievements,
                    // Streaks are complex to map, assumes backend sends formatted streaks or we calculate
                    // For now, keep existing or map if possible
                }));
            } catch (e) {
                console.error("Failed to fetch gamification profile - using initial/mock state", e);
            }
        };
        fetchProfile();
    }, []);

    const getLevel = useCallback(() => {
        return LEVELS.find((l) => state.xp >= l.minXP && state.xp < l.maxXP) || LEVELS[0];
    }, [state.xp]);

    const getNextLevel = useCallback(() => {
        const currentLevel = getLevel();
        return LEVELS.find((l) => l.level === currentLevel.level + 1);
    }, [getLevel]);

    const addXP = useCallback((amount: number) => {
        setState((prev) => {
            const newXP = prev.xp + amount;
            const newLevel = LEVELS.findIndex((l) => newXP >= l.minXP && newXP < l.maxXP) + 1;
            return { ...prev, xp: newXP, level: newLevel };
        });
    }, []);

    const unlockBadge = useCallback((badgeId: string) => {
        setState((prev) => ({
            ...prev,
            badges: prev.badges.map((b) =>
                b.id === badgeId ? { ...b, unlockedAt: new Date() } : b
            ),
        }));
    }, []);

    const updateAchievement = useCallback((achievementId: string, progress: number) => {
        setState((prev) => ({
            ...prev,
            achievements: prev.achievements.map((a) =>
                a.id === achievementId
                    ? { ...a, progress: Math.min(progress, a.maxProgress), unlockedAt: progress >= a.maxProgress ? new Date() : undefined }
                    : a
            ),
        }));
    }, []);

    return (
        <GamificationContext.Provider value={{ state, addXP, unlockBadge, updateAchievement, getLevel, getNextLevel }}>
            {children}
        </GamificationContext.Provider>
    );
}

export function useGamification() {
    const context = useContext(GamificationContext);
    if (!context) {
        throw new Error("useGamification must be used within a GamificationProvider");
    }
    return context;
}

// ============================================================================
// EXPORTS
// ============================================================================

export { LEVELS, RARITY_COLORS };
export type { Badge, Achievement, Level, Streak, LeaderboardEntry, GamificationState, BadgeRarity };
