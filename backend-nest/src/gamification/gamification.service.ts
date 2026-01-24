import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateBadgeDto } from './dto/gamification.dto';

const LEVELS = [0, 100, 250, 500, 1000, 2000, 4000, 8000, 16000, 32000];

@Injectable()
export class GamificationService {
  private readonly logger = new Logger(GamificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  async getProfile(userId: string) {
    let profile = await this.prisma.gamificationProfile.findUnique({
      where: { userId },
      include: {
        badges: { include: { badge: true } },
        achievements: { include: { achievement: true } },
      },
    });

    if (!profile) {
      profile = await this.prisma.gamificationProfile.create({
        data: { userId },
        include: {
          badges: { include: { badge: true } },
          achievements: { include: { achievement: true } },
        },
      });
    }

    return profile;
  }

  async addXp(userId: string, amount: number, reason: string) {
    const profile = await this.getProfile(userId);

    // Calculate new level
    const newXp = profile.xp + amount;
    let newLevel = profile.level;

    // Simple level calculation
    for (let i = 0; i < LEVELS.length; i++) {
      if (newXp >= LEVELS[i]) {
        newLevel = i + 1;
      }
    }

    const updated = await this.prisma.gamificationProfile.update({
      where: { id: profile.id },
      data: {
        xp: newXp,
        level: newLevel,
        lastActivityDate: new Date(),
      },
    });

    // Notify user
    this.realtimeGateway.broadcastToUser(userId, 'gamification:xp_gained', {
      amount,
      reason,
      totalXp: newXp,
    });

    if (newLevel > profile.level) {
      this.realtimeGateway.broadcastToUser(userId, 'gamification:level_up', {
        level: newLevel,
        unlockedFeatures: [], // Placeholder
      });

      // Broadcast to workspace (social)
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (user) {
        this.realtimeGateway.broadcastToWorkspace(user.workspaceId, 'gamification:user_level_up', {
          userId: user.id,
          userName: user.firstName,
          level: newLevel,
        });
      }
    }

    return updated;
  }

  async createBadge(dto: CreateBadgeDto) {
    return this.prisma.badge.create({
      data: {
        ...dto,
        category: dto.category as any,
        rarity: dto.rarity as any,
      },
    });
  }

  async awardBadge(userId: string, badgeId: string) {
    const profile = await this.getProfile(userId);
    const badge = await this.prisma.badge.findUnique({
      where: { id: badgeId },
    });

    if (!badge) throw new NotFoundException('Badge not found');

    // Check if already awarded
    const existing = await this.prisma.userBadge.findUnique({
      where: {
        profileId_badgeId: {
          profileId: profile.id,
          badgeId: badgeId,
        },
      },
    });

    if (existing) return existing;

    const userBadge = await this.prisma.userBadge.create({
      data: {
        profileId: profile.id,
        badgeId: badgeId,
      },
      include: { badge: true },
    });

    // Celebration event!
    this.realtimeGateway.broadcastToUser(userId, 'gamification:badge_earned', {
      badge: badge,
    });

    return userBadge;
  }

  async getLeaderboard(workspaceId: string) {
    // Get all users in workspace
    const users = await this.prisma.user.findMany({
      where: { workspaceId },
      select: { id: true },
    });

    const userIds = users.map((u) => u.id);

    const profiles = await this.prisma.gamificationProfile.findMany({
      where: { userId: { in: userIds } },
      orderBy: { xp: 'desc' },
      take: 50,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
      },
    });

    return profiles.map((p, index) => ({
      rank: index + 1,
      userId: p.userId,
      name: `${p.user.firstName} ${p.user.lastName}`.trim(),
      avatar: p.user.avatar,
      xp: p.xp,
      level: p.level,
    }));
  }
}
