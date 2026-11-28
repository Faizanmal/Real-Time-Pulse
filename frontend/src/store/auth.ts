import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@/types';

interface AuthState {
  user: User | null;
  setAuth: (user: User) => void;
  clearAuth: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setHydrated: (state: boolean) => void;
}

const removeLegacyCredentials = () => {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('accessToken');
};

const createAuthStore: StateCreator<AuthState> = (set) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  setHydrated: (state) => set({ isHydrated: state }),
  setAuth: (user) => set({ user, isAuthenticated: true }),
  clearAuth: () => {
    removeLegacyCredentials();
    set({ user: null, isAuthenticated: false });
  },
  logout: () => {
    removeLegacyCredentials();
    set({ user: null, isAuthenticated: false });
    if (typeof window !== 'undefined') window.location.href = '/auth/login';
  },
});

export const useAuthStore = typeof window !== 'undefined'
  ? create<AuthState>()(persist(createAuthStore, {
      name: 'auth-storage',
      version: 2,
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }) as AuthState,
      migrate: (persistedState) => {
        removeLegacyCredentials();
        const prior = persistedState as Partial<AuthState> | undefined;
        return { user: prior?.user || null, isAuthenticated: Boolean(prior?.isAuthenticated), isHydrated: false } as AuthState;
      },
      onRehydrateStorage: () => (state) => {
        removeLegacyCredentials();
        state?.setHydrated(true);
      },
    }))
  : create<AuthState>()(createAuthStore);
