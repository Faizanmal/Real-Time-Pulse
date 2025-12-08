'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { apiClient } from '@/lib/api/client';

interface User {
  id: string;
  email: string;
  name: string;
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
  setCurrentWorkspace: (workspace: Workspace) => void;
  isAuthenticated: boolean;
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

  useEffect(() => {
    // Initialize workspace and user from localStorage or API
    const initializeWorkspace = async () => {
      try {
        // Check for stored auth token
        const token = localStorage.getItem('auth_token');
        if (token) {
          apiClient.setAuthToken(token);
        }

        // Get stored workspace ID
        const storedWorkspaceId = localStorage.getItem('current_workspace_id');
        const storedWorkspaceName = localStorage.getItem('current_workspace_name');
        
        if (storedWorkspaceId && storedWorkspaceName) {
          setCurrentWorkspace({
            id: storedWorkspaceId,
            name: storedWorkspaceName,
            slug: storedWorkspaceId,
          });
        }

        // Mock user data (replace with actual API call)
        setUser({
          id: 'user-1',
          email: 'user@example.com',
          name: 'Demo User',
        });

        // Mock workspaces (replace with actual API call)
        setWorkspaces([
          {
            id: storedWorkspaceId || 'workspace-1',
            name: storedWorkspaceName || 'Default Workspace',
            slug: storedWorkspaceId || 'workspace-1',
          },
        ]);
      } catch (error) {
        console.error('Failed to initialize workspace:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeWorkspace();
  }, []);

  const handleSetCurrentWorkspace = (workspace: Workspace) => {
    setCurrentWorkspace(workspace);
    localStorage.setItem('current_workspace_id', workspace.id);
    localStorage.setItem('current_workspace_name', workspace.name);
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        workspaces,
        user,
        loading,
        setCurrentWorkspace: handleSetCurrentWorkspace,
        isAuthenticated: !!user,
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
