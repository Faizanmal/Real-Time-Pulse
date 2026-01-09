/**
 * Enhanced Gamification Service
 * Provides badges, leaderboards, streaks, and achievement system
 */

import { Injectable } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { LoggingService } from '../common/logger/logging.service';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../cache/cache.service';
import { v4 as uuidv4 } from 'uuid';

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'engagement' | 'performance' | 'collaboration' | 'learning' | 'special';
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  criteria: BadgeCriteria;
  points: number;
}

interface BadgeCriteria {
  type: 'count' | 'streak' | 'threshold' | 'combination';
  metric: string;
  target: number;
  timeframe?: 'daily' | 'weekly' | 'monthly' | 'all-time';
  subCriteria?: BadgeCriteria[];
}

interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  avatar?: string;
  score: number;
  badges: number;
  streak: number;
  change: number; // Rank change since last period
}

interface UserGamificationStats {
  userId: string;
  totalPoints: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  badgeCount: number;
  badges: Badge[];
  recentAchievements: Achievement[];
  rank: number;
  percentile: number;
}

interface Achievement {
  id: string;
  badgeId: string;
  badge: Badge;
  unlockedAt: Date;
  progress: number; // 0-100
}

@Injectable()
export class EnhancedGamificationService {
  private badges: Badge[];
  private readonly levelThresholds: number[];

  constructor(
    private readonly configService: ConfigService,
    private readonly logger: LoggingService,
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {
    this.initializeBadges();
    // Level thresholds follow a curve
    this.levelThresholds = Array.from({ length: 100 }, (_, i) => Math.floor(100 * Math.pow(1.5, i)));
  }

  private initializeBadges(): void {
    this.badges = [
      // Engagement badges
      {
        id: 'first-login',
        name: 'First Steps',
        description: 'Logged in for the first time',
        icon: '🚀',
        category: 'engagement',
        tier: 'bronze',
        criteria: { type: 'count', metric: 'logins', target: 1 },
        points: 10,
      },
      {
        id: 'week-warrior',
        name: 'Week Warrior',
        description: 'Logged in 7 days in a row',
        icon: '⚔️',
        category: 'engagement',
        tier: 'silver',
        criteria: { type: 'streak', metric: 'daily_login', target: 7 },
        points: 50,
      },
      {
        id: 'month-master',
        name: 'Month Master',
        description: 'Logged in 30 days in a row',
        icon: '👑',
        category: 'engagement',
        tier: 'gold',
        criteria: { type: 'streak', metric: 'daily_login', target: 30 },
        points: 200,
      },
      {
        id: 'year-legend',
        name: 'Yearly Legend',
        description: 'Logged in 365 days in a row',
        icon: '🏆',
        category: 'engagement',
        tier: 'diamond',
        criteria: { type: 'streak', metric: 'daily_login', target: 365 },
        points: 2000,
      },

      // Performance badges
      {
        id: 'dashboard-creator',
        name: 'Dashboard Creator',
        description: 'Created your first dashboard',
        icon: '📊',
        category: 'performance',
        tier: 'bronze',
        criteria: { type: 'count', metric: 'dashboards_created', target: 1 },
        points: 25,
      },
      {
        id: 'widget-wizard',
        name: 'Widget Wizard',
        description: 'Created 50 widgets',
        icon: '🧙',
        category: 'performance',
        tier: 'gold',
        criteria: { type: 'count', metric: 'widgets_created', target: 50 },
        points: 150,
      },
      {
        id: 'data-master',
        name: 'Data Master',
        description: 'Processed 1 million data points',
        icon: '📈',
        category: 'performance',
        tier: 'platinum',
        criteria: { type: 'threshold', metric: 'data_points_processed', target: 1000000 },
        points: 500,
      },

      // Collaboration badges
      {
        id: 'team-player',
        name: 'Team Player',
        description: 'Joined a team workspace',
        icon: '🤝',
        category: 'collaboration',
        tier: 'bronze',
        criteria: { type: 'count', metric: 'workspaces_joined', target: 1 },
        points: 20,
      },
      {
        id: 'helpful-hand',
        name: 'Helpful Hand',
        description: 'Received 10 thank-you reactions on comments',
        icon: '🙏',
        category: 'collaboration',
        tier: 'silver',
        criteria: { type: 'count', metric: 'reactions_received', target: 10 },
        points: 75,
      },
      {
        id: 'community-star',
        name: 'Community Star',
        description: 'Shared 25 dashboards publicly',
        icon: '⭐',
        category: 'collaboration',
        tier: 'gold',
        criteria: { type: 'count', metric: 'public_shares', target: 25 },
        points: 200,
      },

      // Learning badges
      {
        id: 'tutorial-complete',
        name: 'Quick Learner',
        description: 'Completed the getting started tutorial',
        icon: '📚',
        category: 'learning',
        tier: 'bronze',
        criteria: { type: 'count', metric: 'tutorials_completed', target: 1 },
        points: 30,
      },
      {
        id: 'certified-analyst',
        name: 'Certified Analyst',
        description: 'Completed all certification courses',
        icon: '🎓',
        category: 'learning',
        tier: 'platinum',
        criteria: { type: 'count', metric: 'certifications', target: 5 },
        points: 500,
      },

      // Special badges
      {
        id: 'early-adopter',
        name: 'Early Adopter',
        description: 'Joined during beta period',
        icon: '🌟',
        category: 'special',
        tier: 'gold',
        criteria: { type: 'threshold', metric: 'join_date', target: 0 },
        points: 100,
      },
      {
        id: 'bug-hunter',
        name: 'Bug Hunter',
        description: 'Reported a valid bug',
        icon: '🐛',
        category: 'special',
        tier: 'silver',
        criteria: { type: 'count', metric: 'bugs_reported', target: 1 },
        points: 100,
      },
      {
        id: 'api-pioneer',
        name: 'API Pioneer',
        description: 'Made 1000 API calls',
        icon: '🔌',
        category: 'special',
        tier: 'silver',
        criteria: { type: 'threshold', metric: 'api_calls', target: 1000 },
        points: 75,
      },
    ];
  }

  // ==================== BADGE MANAGEMENT ====================

  /**
   * Check and award badges for a user
   */
  async checkAndAwardBadges(userId: string): Promise<Badge[]> {
    const userStats = await this.getUserMetrics(userId);
    const existingBadges = await this.getUserBadges(userId);
    const existingBadgeIds = new Set(existingBadges.map((b) => b.id));

    const newBadges: Badge[] = [];

    for (const badge of this.badges) {
      if (existingBadgeIds.has(badge.id)) continue;

      const earned = await this.evaluateCriteria(userStats, badge.criteria);
      if (earned) {
        await this.awardBadge(userId, badge);
        newBadges.push(badge);
      }
    }

    return newBadges;
  }

  /**
   * Award a badge to a user
   */
  private async awardBadge(userId: string, badge: Badge): Promise<void> {
    await this.prisma.userBadge.create({
      data: {
        id: uuidv4(),
        userId,
        badgeId: badge.id,
        awardedAt: new Date(),
      },
    });

    // Award points
    await this.addPoints(userId, badge.points, `Earned badge: ${badge.name}`);

    // Create notification
    await this.prisma.notification.create({
      data: {
        id: uuidv4(),
        userId,
        type: 'achievement',
        title: `🎉 New Badge Earned!`,
        message: `You earned the "${badge.name}" badge: ${badge.description}`,
        data: { badgeId: badge.id, icon: badge.icon },
        createdAt: new Date(),
      },
    });

    this.logger.log(`Badge awarded: ${badge.name} to user ${userId}`, 'GamificationService');
  }

  /**
   * Get user's badges
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const userBadges = await this.prisma.userBadge.findMany({
      where: { userId },
    });

    const badgeIds = new Set(userBadges.map((ub) => ub.badgeId));
    return this.badges.filter((b) => badgeIds.has(b.id));
  }

  /**
   * Get badge progress for a user
   */
  async getBadgeProgress(userId: string): Promise<{ badge: Badge; progress: number; current: number; target: number }[]> {
    const userStats = await this.getUserMetrics(userId);
    const existingBadges = await this.getUserBadges(userId);
    const existingBadgeIds = new Set(existingBadges.map((b) => b.id));

    const progress: { badge: Badge; progress: number; current: number; target: number }[] = [];

    for (const badge of this.badges) {
      if (existingBadgeIds.has(badge.id)) {
        progress.push({ badge, progress: 100, current: badge.criteria.target, target: badge.criteria.target });
      } else {
        const current = this.getMetricValue(userStats, badge.criteria.metric);
        const percent = Math.min(100, (current / badge.criteria.target) * 100);
        progress.push({ badge, progress: percent, current, target: badge.criteria.target });
      }
    }

    return progress;
  }

  // ==================== POINTS & LEVELS ====================

  /**
   * Add points to a user
   */
  async addPoints(userId: string, points: number, reason: string): Promise<{ newTotal: number; levelUp: boolean; newLevel: number }> {
    const user = await this.prisma.userGamification.upsert({
      where: { userId },
      create: { userId, totalPoints: points },
      update: { totalPoints: { increment: points } },
    });

    const oldLevel = this.calculateLevel(user.totalPoints - points);
    const newLevel = this.calculateLevel(user.totalPoints);
    const levelUp = newLevel > oldLevel;

    // Log points transaction
    await this.prisma.pointsTransaction.create({
      data: {
        id: uuidv4(),
        userId,
        points,
        reason,
        createdAt: new Date(),
      },
    });

    if (levelUp) {
      await this.prisma.notification.create({
        data: {
          id: uuidv4(),
          userId,
          type: 'level_up',
          title: `🎊 Level Up!`,
          message: `Congratulations! You've reached level ${newLevel}!`,
          data: { level: newLevel },
          createdAt: new Date(),
        },
      });
    }

    // Invalidate leaderboard cache
    await this.cache.del('leaderboard:*');

    return { newTotal: user.totalPoints, levelUp, newLevel };
  }

  /**
   * Calculate level from points
   */
  private calculateLevel(points: number): number {
    for (let i = this.levelThresholds.length - 1; i >= 0; i--) {
      if (points >= this.levelThresholds[i]) {
        return i + 1;
      }
    }
    return 1;
  }

  // ==================== STREAKS ====================

  /**
   * Update user streak
   */
  async updateStreak(userId: string): Promise<{ currentStreak: number; isNewRecord: boolean }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const user = await this.prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!user) {
      await this.prisma.userGamification.create({
        data: {
          userId,
          currentStreak: 1,
          longestStreak: 1,
          lastActiveDate: today,
        },
      });
      return { currentStreak: 1, isNewRecord: true };
    }

    const lastActive = user.lastActiveDate ? new Date(user.lastActiveDate) : null;
    
    if (lastActive) {
      lastActive.setHours(0, 0, 0, 0);
      const daysDiff = Math.floor((today.getTime() - lastActive.getTime()) / (24 * 60 * 60 * 1000));

      if (daysDiff === 0) {
        // Already updated today
        return { currentStreak: user.currentStreak, isNewRecord: false };
      } else if (daysDiff === 1) {
        // Consecutive day
        const newStreak = user.currentStreak + 1;
        const isNewRecord = newStreak > user.longestStreak;

        await this.prisma.userGamification.update({
          where: { userId },
          data: {
            currentStreak: newStreak,
            longestStreak: isNewRecord ? newStreak : user.longestStreak,
            lastActiveDate: today,
          },
        });

        // Award streak milestones
        if ([7, 30, 100, 365].includes(newStreak)) {
          await this.addPoints(userId, newStreak * 2, `${newStreak}-day streak milestone`);
        }

        return { currentStreak: newStreak, isNewRecord };
      } else {
        // Streak broken
        await this.prisma.userGamification.update({
          where: { userId },
          data: {
            currentStreak: 1,
            lastActiveDate: today,
          },
        });
        return { currentStreak: 1, isNewRecord: false };
      }
    } else {
      await this.prisma.userGamification.update({
        where: { userId },
        data: {
          currentStreak: 1,
          longestStreak: Math.max(1, user.longestStreak),
          lastActiveDate: today,
        },
      });
      return { currentStreak: 1, isNewRecord: user.longestStreak === 0 };
    }
  }

  // ==================== LEADERBOARDS ====================

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    type: 'points' | 'streak' | 'badges' = 'points',
    timeframe: 'weekly' | 'monthly' | 'all-time' = 'all-time',
    limit: number = 100,
  ): Promise<LeaderboardEntry[]> {
    const cacheKey = `leaderboard:${type}:${timeframe}:${limit}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let orderBy: any;
    switch (type) {
      case 'points':
        orderBy = { totalPoints: 'desc' };
        break;
      case 'streak':
        orderBy = { currentStreak: 'desc' };
        break;
      case 'badges':
        orderBy = { badgeCount: 'desc' };
        break;
    }

    const users = await this.prisma.userGamification.findMany({
      take: limit,
      orderBy,
      include: {
        user: { select: { id: true, name: true, avatar: true } },
        _count: { select: { badges: true } },
      },
    });

    // Get previous rankings for change calculation
    const previousRankings = await this.getPreviousRankings(type, timeframe);

    const entries: LeaderboardEntry[] = users.map((u, index) => {
      const previousRank = previousRankings.get(u.userId) || index + 1;
      return {
        rank: index + 1,
        userId: u.userId,
        userName: u.user?.name || 'Anonymous',
        avatar: u.user?.avatar || undefined,
        score: u.totalPoints,
        badges: u._count.badges,
        streak: u.currentStreak,
        change: previousRank - (index + 1),
      };
    });

    await this.cache.set(cacheKey, JSON.stringify(entries), 300); // 5 min cache
    return entries;
  }

  /**
   * Get user's rank
   */
  async getUserRank(userId: string): Promise<{ rank: number; total: number; percentile: number }> {
    const user = await this.prisma.userGamification.findUnique({
      where: { userId },
    });

    if (!user) {
      return { rank: 0, total: 0, percentile: 0 };
    }

    const higherRanked = await this.prisma.userGamification.count({
      where: { totalPoints: { gt: user.totalPoints } },
    });

    const total = await this.prisma.userGamification.count();
    const rank = higherRanked + 1;
    const percentile = Math.round(((total - rank) / total) * 100);

    return { rank, total, percentile };
  }

  // ==================== USER STATS ====================

  /**
   * Get user gamification stats
   */
  async getUserStats(userId: string): Promise<UserGamificationStats> {
    const [gamification, badges, rankInfo] = await Promise.all([
      this.prisma.userGamification.findUnique({ where: { userId } }),
      this.getUserBadges(userId),
      this.getUserRank(userId),
    ]);

    const recentAchievements = await this.prisma.userBadge.findMany({
      where: { userId },
      orderBy: { awardedAt: 'desc' },
      take: 5,
    });

    return {
      userId,
      totalPoints: gamification?.totalPoints || 0,
      level: this.calculateLevel(gamification?.totalPoints || 0),
      currentStreak: gamification?.currentStreak || 0,
      longestStreak: gamification?.longestStreak || 0,
      badgeCount: badges.length,
      badges,
      recentAchievements: recentAchievements.map((a) => ({
        id: a.id,
        badgeId: a.badgeId,
        badge: this.badges.find((b) => b.id === a.badgeId)!,
        unlockedAt: a.awardedAt,
        progress: 100,
      })),
      rank: rankInfo.rank,
      percentile: rankInfo.percentile,
    };
  }

  // ==================== CHALLENGES ====================

  /**
   * Get active challenges
   */
  async getActiveChallenges(): Promise<any[]> {
    return await this.prisma.challenge.findMany({
      where: {
        isActive: true,
        startDate: { lte: new Date() },
        endDate: { gte: new Date() },
      },
      include: {
        _count: { select: { participants: true } },
      },
    });
  }

  /**
   * Join a challenge
   */
  async joinChallenge(userId: string, challengeId: string): Promise<void> {
    await this.prisma.challengeParticipant.create({
      data: {
        id: uuidv4(),
        challengeId,
        userId,
        joinedAt: new Date(),
      },
    });
  }

  // ==================== SCHEDULED TASKS ====================

  /**
   * Reset weekly leaderboards
   */
  @Cron(CronExpression.EVERY_WEEK)
  async resetWeeklyLeaderboards(): Promise<void> {
    // Archive current leaderboard
    const leaderboard = await this.getLeaderboard('points', 'weekly');
    
    await this.prisma.leaderboardArchive.create({
      data: {
        id: uuidv4(),
        type: 'weekly',
        data: leaderboard as any,
        periodEnd: new Date(),
      },
    });

    // Award weekly top performers
    for (let i = 0; i < Math.min(3, leaderboard.length); i++) {
      const winner = leaderboard[i];
      const prizes = [100, 50, 25];
      await this.addPoints(winner.userId, prizes[i], `Weekly leaderboard - Rank ${i + 1}`);
    }

    await this.cache.del('leaderboard:*');
    this.logger.log('Weekly leaderboards reset', 'GamificationService');
  }

  // ==================== HELPER METHODS ====================

  private async getUserMetrics(userId: string): Promise<Record<string, number>> {
    const [gamification, counts] = await Promise.all([
      this.prisma.userGamification.findUnique({ where: { userId } }),
      this.prisma.$transaction([
        this.prisma.portal.count({ where: { createdById: userId } }),
        this.prisma.widget.count({ where: { createdById: userId } }),
        this.prisma.workspace.count({ where: { members: { some: { userId } } } }),
        this.prisma.comment.count({ where: { userId } }),
        this.prisma.session.count({ where: { userId } }),
      ]),
    ]);

    return {
      logins: counts[4],
      dashboards_created: counts[0],
      widgets_created: counts[1],
      workspaces_joined: counts[2],
      comments_made: counts[3],
      daily_login: gamification?.currentStreak || 0,
      data_points_processed: 0, // Would need actual tracking
      api_calls: 0, // Would need actual tracking
    };
  }

  private getMetricValue(stats: Record<string, number>, metric: string): number {
    return stats[metric] || 0;
  }

  private async evaluateCriteria(stats: Record<string, number>, criteria: BadgeCriteria): Promise<boolean> {
    const value = this.getMetricValue(stats, criteria.metric);

    switch (criteria.type) {
      case 'count':
      case 'threshold':
        return value >= criteria.target;
      case 'streak':
        return value >= criteria.target;
      case 'combination':
        if (!criteria.subCriteria) return false;
        return criteria.subCriteria.every((sub) => this.evaluateCriteria(stats, sub));
      default:
        return false;
    }
  }

  private async getPreviousRankings(type: string, timeframe: string): Promise<Map<string, number>> {
    const archive = await this.prisma.leaderboardArchive.findFirst({
      where: { type: timeframe },
      orderBy: { periodEnd: 'desc' },
    });

    const rankings = new Map<string, number>();
    if (archive && Array.isArray(archive.data)) {
      (archive.data as any[]).forEach((entry: any, index: number) => {
        rankings.set(entry.userId, index + 1);
      });
    }

    return rankings;
  }

  /**
   * Get all available badges
   */
  getAllBadges(): Badge[] {
    return this.badges;
  }

  /**
   * Get badges by category
   */
  getBadgesByCategory(category: Badge['category']): Badge[] {
    return this.badges.filter((b) => b.category === category);
  }
}
