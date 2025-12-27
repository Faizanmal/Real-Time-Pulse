'use client';

import { createContext, useContext, ReactNode, useState, useEffect } from 'react';

interface FeatureFlags {
  [key: string]: boolean;
}

interface FeatureFlagContextType {
  flags: FeatureFlags;
  isEnabled: (flag: string) => boolean;
  setFlag: (flag: string, enabled: boolean) => void;
  loadFlags: (flags: FeatureFlags) => void;
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(undefined);

export function FeatureFlagProvider({ children }: { children: ReactNode }) {
  const [flags, setFlags] = useState<FeatureFlags>({
    // Default feature flags
    'advanced-analytics': true,
    'real-time-alerts': true,
    'ar-visualization': false,
    'workflow-automation': false,
    'ai-insights': true,
    'enterprise-features': false,
  });

  const isEnabled = (flag: string): boolean => {
    return flags[flag] ?? false;
  };

  const setFlag = (flag: string, enabled: boolean) => {
    setFlags(prev => ({ ...prev, [flag]: enabled }));
  };

  const loadFlags = (newFlags: FeatureFlags) => {
    setFlags(prev => ({ ...prev, ...newFlags }));
  };

  // Load flags from localStorage or API
  useEffect(() => {
    const stored = localStorage.getItem('feature-flags');
    if (stored) {
      try {
        loadFlags(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse stored feature flags:', error);
      }
    }
  }, []);

  // Save flags to localStorage
  useEffect(() => {
    localStorage.setItem('feature-flags', JSON.stringify(flags));
  }, [flags]);

  return (
    <FeatureFlagContext.Provider value={{
      flags,
      isEnabled,
      setFlag,
      loadFlags,
    }}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

export function useFeatureFlags() {
  const context = useContext(FeatureFlagContext);
  if (context === undefined) {
    throw new Error('useFeatureFlags must be used within a FeatureFlagProvider');
  }
  return context;
}