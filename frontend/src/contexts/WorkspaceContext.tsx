'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  name: string;
  firstName?: string;
  lastName?: string;
}

interface Workspace {
  id: string;
  name: string;
  slug: string;
}

interface WorkspaceContextType {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[];
  user: User | null;
  loading: boolean;
  error: string | null;
  setCurrentWorkspace: (workspace: Workspace) => void;
  isAuthenticated: boolean;
  refreshUser: () => Promise<void>;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextType | undefined>(undefined);

interface WorkspaceProviderProps {
  children: ReactNode;
}

export function WorkspaceProvider({ children }: WorkspaceProviderProps) {
  const [currentWorkspace, setCurrentWorkspace] = useState<Workspace | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUserData = useCallback(async (token: string): Promise<User | null> => {
    try {
      apiClient.setAuthToken(token);
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Token expired, clear storage
          localStorage.removeItem('auth_token');
          return null;
        }
        throw new Error(`Failed to fetch user: ${response.status}`);
      }
      
      const data = await response.json();
      const userData = data.data || data;
      
      return {
        id: userData.id,
        email: userData.email,
        name: userData.firstName && userData.lastName 
          ? `${userData.firstName} ${userData.lastName}` 
          : userData.email.split('@')[0],
        firstName: userData.firstName,
        lastName: userData.lastName,
      };
    } catch (err) {
      console.error('Failed to fetch user data:', err);
      return null;
    }
  }, []);

  const fetchWorkspaces = useCallback(async (token: string): Promise<Workspace[]> => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/v1/workspaces`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
      }
      
      const data = await response.json();
      const workspacesData = data.data || data;
      
      if (Array.isArray(workspacesData)) {
        return workspacesData.map((ws: { id: string; name: string; slug?: string }) => ({
          id: ws.id,
          name: ws.name,
          slug: ws.slug || ws.id,
        }));
      }
      
      // If single workspace is returned (user's default workspace)
      if (workspacesData.id) {
        return [{
          id: workspacesData.id,
          name: workspacesData.name,
          slug: workspacesData.slug || workspacesData.id,
        }];
      }
      
      return [];
    } catch (err) {
      console.error('Failed to fetch workspaces:', err);
      return [];
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const userData = await fetchUserData(token);
      if (userData) {
        setUser(userData);
      }
    }
  }, [fetchUserData]);

  const refreshWorkspaces = useCallback(async () => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      const workspacesData = await fetchWorkspaces(token);
      setWorkspaces(workspacesData);
    }
  }, [fetchWorkspaces]);

  useEffect(() => {
    const initializeWorkspace = async () => {
      setError(null);
      try {
        const token = localStorage.getItem('auth_token');
        
        if (!token) {
          // No token - use demo mode with stored workspace if available
          const storedWorkspaceId = localStorage.getItem('current_workspace_id');
          const storedWorkspaceName = localStorage.getItem('current_workspace_name');
          
          if (storedWorkspaceId && storedWorkspaceName) {
            const demoWorkspace = {
              id: storedWorkspaceId,
              name: storedWorkspaceName,
              slug: storedWorkspaceId,
            };
            setCurrentWorkspace(demoWorkspace);
            setWorkspaces([demoWorkspace]);
          }
          setLoading(false);
          return;
        }

        // Fetch real user data and workspaces in parallel
        const [userData, workspacesData] = await Promise.all([
          fetchUserData(token),
          fetchWorkspaces(token),
        ]);

        if (userData) {
          setUser(userData);
        }

        if (workspacesData.length > 0) {
          setWorkspaces(workspacesData);
          
          // Restore previously selected workspace or use first one
          const storedWorkspaceId = localStorage.getItem('current_workspace_id');
          const savedWorkspace = workspacesData.find(ws => ws.id === storedWorkspaceId);
          
          if (savedWorkspace) {
            setCurrentWorkspace(savedWorkspace);
          } else {
            setCurrentWorkspace(workspacesData[0]);
            localStorage.setItem('current_workspace_id', workspacesData[0].id);
            localStorage.setItem('current_workspace_name', workspacesData[0].name);
          }
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to initialize workspace';
        setError(errorMessage);
        console.error('Failed to initialize workspace:', err);
      } finally {
        setLoading(false);
      }
    };

    initializeWorkspace();
  }, [fetchUserData, fetchWorkspaces]);

  const handleSetCurrentWorkspace = useCallback((workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('current_workspace_id', workspace.id);
    localStorage.setItem('current_workspace_name', workspace.name);
  }, []);

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        user,
        loading,
        error,
        setCurrentWorkspace: handleSetCurrentWorkspace,
        isAuthenticated: !!user,
        refreshUser,
        refreshWorkspaces,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (context === undefined) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }
  return context;
}
