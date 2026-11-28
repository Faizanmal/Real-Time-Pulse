'use client';

import { createContext, useContext, ReactNode, useEffect, useState } from 'react';

import { useAuthStore } from '@/store/auth';
import { authApi } from '@/lib/api-client';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  setAuth: (user: User) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const authStore = useAuthStore();
  const [sessionChecked, setSessionChecked] = useState(false);

  useEffect(() => {
    if (!authStore.isHydrated) return;
    if (!authStore.isAuthenticated) {
      setSessionChecked(true);
      return;
    }
    void authApi.me()
      .then((user) => authStore.setAuth(user))
      .catch(() => authStore.clearAuth())
      .finally(() => setSessionChecked(true));
  }, [authStore.isHydrated, authStore.isAuthenticated, authStore.setAuth, authStore.clearAuth]);

  // Prevent hydration mismatch by not rendering until hydrated
  if (!authStore.isHydrated || !sessionChecked) {
    return null;
  }

  return (
    <AuthContext.Provider value={authStore}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
