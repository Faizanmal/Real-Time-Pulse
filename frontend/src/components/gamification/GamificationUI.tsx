'use client';

/**
 * Gamification UI Components
 * Badges, leaderboard, streaks, and achievement displays
 */

import React, { useState, useEffect, createContext, useContext, useCallback } from 'react';
import Image from 'next/image';

// Types
interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'engagement' | 'performance' | 'collaboration' | 'learning' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  earnedAt?: string;
  progress?: number;
  requirement?: number;
}

interface UserStats {
  level: number;
  points: number;
  pointsToNextLevel: number;
  currentStreak: number;
  longestStreak: number;
  badges: Badge[];
  rank?: number;
}

interface LeaderboardEntry {
  userId: string;
  userName: string;
  avatarUrl?: string;
  points: number;
  level: number;
  rank: number;
  badges: number;
  streak: number;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  expiresAt: string;
  type: 'daily' | 'weekly' | 'special';
}

interface GamificationContextType {
  stats: UserStats | null;
  loading: boolean;
  refreshStats: () => Promise<void>;
  claimBadge: (badgeId: string) => Promise<void>;
}

const GamificationContext = createContext<GamificationContextType | null>(null);

export function useGamification() {
  const context = useContext(GamificationContext);
  if (!context) {
    throw new Error('useGamification must be used within GamificationProvider');
  }
  return context;
}

// ==================== PROVIDER ====================

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshStats = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gamification/stats');
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to fetch gamification stats:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const claimBadge = useCallback(async (badgeId: string) => {
    try {
      await fetch(`/api/gamification/badges/${badgeId}/claim`, { method: 'POST' });
      await refreshStats();
    } catch (error) {
      console.error('Failed to claim badge:', error);
    }
  }, [refreshStats]);

  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  return (
    <GamificationContext.Provider value={{ stats, loading, refreshStats, claimBadge }}>
      {children}
    </GamificationContext.Provider>
  );
}

// ==================== BADGE COMPONENTS ====================

const tierColors: Record<Badge['tier'], string> = {
  bronze: 'from-amber-600 to-amber-800',
  silver: 'from-gray-300 to-gray-500',
  gold: 'from-yellow-400 to-yellow-600',
  platinum: 'from-cyan-300 to-cyan-500',
  diamond: 'from-purple-400 to-pink-500',
};

const tierBorders: Record<Badge['tier'], string> = {
  bronze: 'border-amber-600',
  silver: 'border-gray-400',
  gold: 'border-yellow-500',
  platinum: 'border-cyan-400',
  diamond: 'border-purple-500',
};

export function BadgeIcon({
  badge,
  size = 'md',
  showProgress = false,
}: {
  badge: Badge;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showProgress?: boolean;
}) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-lg',
    md: 'w-12 h-12 text-2xl',
    lg: 'w-16 h-16 text-3xl',
    xl: 'w-24 h-24 text-5xl',
  };

  const isEarned = !!badge.earnedAt;
  const progress = badge.progress && badge.requirement 
    ? (badge.progress / badge.requirement) * 100 
    : 0;

  return (
    <div className="relative group">
      <div
        className={`
          ${sizeClasses[size]} 
          rounded-full flex items-center justify-center
          border-2 ${tierBorders[badge.tier]}
          ${isEarned 
            ? `bg-linear-to-br ${tierColors[badge.tier]}` 
            : 'bg-gray-200 dark:bg-gray-700'
          }
          ${!isEarned && 'opacity-50 grayscale'}
          transition-all duration-300
          group-hover:scale-110
        `}
      >
        <span className={isEarned ? 'text-white' : 'text-gray-400'}>
          {badge.icon}
        </span>
      </div>
      
      {showProgress && !isEarned && progress > 0 && (
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 36 36">
          <path
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeDasharray={`${progress}, 100`}
            className="text-blue-500"
          />
        </svg>
      )}

      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        <div className="bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
          <p className="font-semibold">{badge.name}</p>
          <p className="text-gray-300">{badge.description}</p>
          {!isEarned && badge.progress && badge.requirement && (
            <p className="text-blue-300 mt-1">
              Progress: {badge.progress}/{badge.requirement}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function BadgeGrid({
  badges,
  showLocked = true,
}: {
  badges: Badge[];
  showLocked?: boolean;
}) {
  const earnedBadges = badges.filter((b) => b.earnedAt);
  // const lockedBadges = badges.filter((b) => !b.earnedAt);

  const displayBadges = showLocked ? badges : earnedBadges;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Badges
        </h3>
        <span className="text-sm text-gray-500">
          {earnedBadges.length}/{badges.length} earned
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
        {displayBadges.map((badge) => (
          <BadgeIcon key={badge.id} badge={badge} showProgress />
        ))}
      </div>
    </div>
  );
}

// ==================== LEVEL PROGRESS ====================

export function LevelProgress({
  level,
  points,
  pointsToNextLevel,
}: {
  level: number;
  points: number;
  pointsToNextLevel: number;
}) {
  const progress = (points / (points + pointsToNextLevel)) * 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-full bg-linear-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-bold">
            {level}
          </div>
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              Level {level}
            </p>
            <p className="text-sm text-gray-500">
              {points.toLocaleString()} XP
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-500">Next level</p>
          <p className="font-semibold text-gray-900 dark:text-white">
            {pointsToNextLevel.toLocaleString()} XP
          </p>
        </div>
      </div>

      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-blue-500 to-purple-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ==================== STREAK DISPLAY ====================

export function StreakDisplay({
  currentStreak,
  longestStreak,
}: {
  currentStreak: number;
  longestStreak: number;
}) {
  const streakMilestones = [7, 14, 30, 60, 100, 365];
  const nextMilestone = streakMilestones.find((m) => m > currentStreak) || 365;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-full bg-linear-to-br from-orange-400 to-red-500 flex items-center justify-center">
          <span className="text-2xl">🔥</span>
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">
            {currentStreak} days
          </p>
          <p className="text-sm text-gray-500">Current streak</p>
        </div>
      </div>

      <div className="flex justify-between text-sm text-gray-500 mb-2">
        <span>Progress to {nextMilestone}-day streak</span>
        <span>{currentStreak}/{nextMilestone}</span>
      </div>
      <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-linear-to-r from-orange-400 to-red-500"
          style={{ width: `${(currentStreak / nextMilestone) * 100}%` }}
        />
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-gray-500">Longest streak</span>
        <span className="font-semibold text-gray-900 dark:text-white">
          {longestStreak} days 🏆
        </span>
      </div>
    </div>
  );
}

// ==================== LEADERBOARD ====================

export function Leaderboard({
  type = 'points',
}: {
  type?: 'points' | 'streak' | 'badges';
}) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState(type);

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true);
        const response = await fetch(`/api/gamification/leaderboard?type=${selectedType}`);
        if (response.ok) {
          const data = await response.json();
          setEntries(data.entries || []);
        }
      } catch (error) {
        console.error('Failed to fetch leaderboard:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchLeaderboard();
  }, [selectedType]);

  const getRankStyle = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-400';
      case 2:
        return 'bg-gray-100 dark:bg-gray-700 border-gray-400';
      case 3:
        return 'bg-amber-100 dark:bg-amber-900/30 border-amber-600';
      default:
        return 'bg-white dark:bg-gray-800 border-transparent';
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return rank.toString();
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Leaderboard
        </h3>

        <div className="flex gap-2">
          {(['points', 'streak', 'badges'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`
                px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                ${selectedType === t
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }
              `}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="p-8 text-center text-gray-500">No entries yet</div>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.userId}
              className={`
                flex items-center gap-4 p-4 border-l-4 transition-colors
                ${getRankStyle(entry.rank)}
              `}
            >
              <div className="w-8 text-center text-lg font-bold">
                {getRankBadge(entry.rank)}
              </div>

              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
                {entry.avatarUrl ? (
                  <Image
                    src={entry.avatarUrl}
                    alt={entry.userName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-500">
                    {entry.userName.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="flex-1">
                <p className="font-medium text-gray-900 dark:text-white">
                  {entry.userName}
                </p>
                <p className="text-sm text-gray-500">
                  Level {entry.level} • {entry.badges} badges
                </p>
              </div>

              <div className="text-right">
                <p className="font-bold text-gray-900 dark:text-white">
                  {selectedType === 'points' && `${entry.points.toLocaleString()} XP`}
                  {selectedType === 'streak' && `${entry.streak} days`}
                  {selectedType === 'badges' && `${entry.badges} badges`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ==================== CHALLENGES ====================

export function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const progress = (challenge.progress / challenge.target) * 100;
  const isExpired = new Date(challenge.expiresAt) < new Date();
  const isCompleted = challenge.progress >= challenge.target;

  const typeColors = {
    daily: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    weekly: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    special: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  };

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm
        ${isCompleted ? 'ring-2 ring-green-500' : ''}
        ${isExpired ? 'opacity-50' : ''}
      `}
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${typeColors[challenge.type]}`}>
            {challenge.type.charAt(0).toUpperCase() + challenge.type.slice(1)}
          </span>
          <h4 className="mt-2 font-semibold text-gray-900 dark:text-white">
            {challenge.title}
          </h4>
        </div>
        <div className="text-right">
          <span className="text-2xl">🎯</span>
          <p className="text-sm font-semibold text-yellow-600">
            +{challenge.reward} XP
          </p>
        </div>
      </div>

      <p className="text-sm text-gray-500 mb-3">{challenge.description}</p>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Progress</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {challenge.progress}/{challenge.target}
          </span>
        </div>
        <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isCompleted
                ? 'bg-green-500'
                : 'bg-linear-to-r from-blue-500 to-purple-500'
            }`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      </div>

      {!isExpired && !isCompleted && (
        <p className="mt-2 text-xs text-gray-400">
          Expires {new Date(challenge.expiresAt).toLocaleDateString()}
        </p>
      )}

      {isCompleted && (
        <div className="mt-3 flex items-center gap-2 text-green-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span className="text-sm font-medium">Completed!</span>
        </div>
      )}
    </div>
  );
}

export function ChallengeList() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchChallenges() {
      try {
        const response = await fetch('/api/gamification/challenges');
        if (response.ok) {
          const data = await response.json();
          setChallenges(data);
        }
      } catch (error) {
        console.error('Failed to fetch challenges:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchChallenges();
  }, []);

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading challenges...</div>;
  }

  const dailyChallenges = challenges.filter((c) => c.type === 'daily');
  const weeklyChallenges = challenges.filter((c) => c.type === 'weekly');
  const specialChallenges = challenges.filter((c) => c.type === 'special');

  return (
    <div className="space-y-6">
      {dailyChallenges.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Challenges
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {dailyChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </div>
      )}

      {weeklyChallenges.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Weekly Challenges
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {weeklyChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </div>
      )}

      {specialChallenges.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Special Challenges
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {specialChallenges.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== ACHIEVEMENT NOTIFICATION ====================

export function AchievementNotification({
  badge,
  onClose,
}: {
  badge: Badge;
  onClose: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(onClose, 5000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-slide-up">
      <div className="bg-linear-to-r from-purple-600 to-pink-600 rounded-lg shadow-xl p-4 flex items-center gap-4 max-w-sm">
        <div className="shrink-0">
          <BadgeIcon badge={badge} size="lg" />
        </div>
        <div className="flex-1">
          <p className="text-white text-sm font-medium">Achievement Unlocked!</p>
          <p className="text-white text-lg font-bold">{badge.name}</p>
          <p className="text-purple-200 text-sm">{badge.description}</p>
        </div>
        <button
          onClick={onClose}
          className="text-white/70 hover:text-white transition-colors"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ==================== GAMIFICATION DASHBOARD ====================

export function GamificationDashboard() {
  const { stats, loading } = useGamification();

  if (loading) {
    return (
      <div className="p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto" />
        <p className="mt-4 text-gray-500">Loading your achievements...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-8 text-center text-gray-500">
        Unable to load gamification data
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
        Your Achievements
      </h2>

      <div className="grid gap-6 md:grid-cols-2">
        <LevelProgress
          level={stats.level}
          points={stats.points}
          pointsToNextLevel={stats.pointsToNextLevel}
        />
        <StreakDisplay
          currentStreak={stats.currentStreak}
          longestStreak={stats.longestStreak}
        />
      </div>

      <BadgeGrid badges={stats.badges} showLocked />

      <div className="grid gap-6 lg:grid-cols-2">
        <ChallengeList />
        <Leaderboard />
      </div>
    </div>
  );
}
