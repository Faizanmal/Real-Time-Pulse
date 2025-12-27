'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface PresenceUser {
  id: string;
  name: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen?: Date;
}

interface PresenceContextType {
  users: PresenceUser[];
  currentUser: PresenceUser | null;
  setPresence: (status: PresenceUser['status']) => void;
  updatePresence: (userId: string, updates: Partial<PresenceUser>) => void;
}

const PresenceContext = createContext<PresenceContextType | undefined>(undefined);

export function PresenceProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<PresenceUser[]>([]);
  const [currentUser, setCurrentUser] = useState<PresenceUser | null>(null);

  const setPresence = (status: PresenceUser['status']) => {
    if (currentUser) {
      setCurrentUser(prev => prev ? { ...prev, status } : null);
    }
  };

  const updatePresence = (userId: string, updates: Partial<PresenceUser>) => {
    setUsers(prev => prev.map(user =>
      user.id === userId ? { ...user, ...updates } : user
    ));
  };

  // Simulate presence updates
  useEffect(() => {
    const interval = setInterval(() => {
      // This would normally connect to a real-time service
      // For now, just maintain current state
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <PresenceContext.Provider value={{
      users,
      currentUser,
      setPresence,
      updatePresence,
    }}>
      {children}
    </PresenceContext.Provider>
  );
}

export function usePresence() {
  const context = useContext(PresenceContext);
  if (context === undefined) {
    throw new Error('usePresence must be used within a PresenceProvider');
  }
  return context;
}