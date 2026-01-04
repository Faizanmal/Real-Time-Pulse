import { apiClient } from '../api';

export interface GamificationProfile {
    id: string;
    userId: string;
    xp: number;
    level: number;
    currentStreak: number;
    longestStreak: number;
    badges: UserBadge[];
    achievements: UserAchievement[];
    user?: {
        id: string;
        firstName: string;
        lastName: string;
        avatar: string;
    }; // For leaderboard
}

export interface Badge {
    id: string;
    name: string;
    description: string;
    icon: string;
    rarity: 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
    category: string;
}

export interface UserBadge {
    id: string;
    badge: Badge;
    earnedAt: string;
}

export interface Achievement {
    id: string;
    name: string;
    description: string;
    points: number;
}

export interface UserAchievement {
    id: string;
    achievement: Achievement;
    progress: number;
    completed: boolean;
    completedAt?: string;
}

export const gamificationApi = {
    getProfile: async (): Promise<GamificationProfile> => {
        const response = await apiClient.get('/gamification/profile');
        return response.data;
    },

    getLeaderboard: async (): Promise<GamificationProfile[]> => {
        const response = await apiClient.get('/gamification/leaderboard');
        return response.data;
    },
};
