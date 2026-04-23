import { create } from 'zustand';
import type { StateCreator } from 'zustand';
import { persist } from 'zustand/middleware';

import type { User } from '@/types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string) => void;
  clearAuth: () => void;
  logout: () => void;
  isAuthenticated: boolean;
  isHydrated: boolean;
  setHydrated: (state: boolean) => void;
}

// Create the store without persist first
const createAuthStore: StateCreator<AuthState> = (set) => ({
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isHydrated: false,
  setHydrated: (state: boolean) => set({ isHydrated: state }),
  setAuth: (user: User, accessToken: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('access_token', accessToken);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, accessToken, isAuthenticated: true });
  },
  clearAuth: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
  },
  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
    }
    set({ user: null, accessToken: null, isAuthenticated: false });
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login';
    }
  },
});

// Conditionally apply persist middleware only on client side
export const useAuthStore = typeof window !== 'undefined'
  ? create<AuthState>()(
      persist(createAuthStore, {
        name: 'auth-storage',
        partialize: (state) => ({
          user: state.user,
          accessToken: state.accessToken,
          isAuthenticated: state.isAuthenticated
        }),
        onRehydrateStorage: () => (state) => {
          state?.setHydrated(true);
        },
      })
    )
  : create<AuthState>()(createAuthStore);
