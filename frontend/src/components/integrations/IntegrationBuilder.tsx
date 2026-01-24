'use client';

import React, { useState, useEffect } from 'react';
import { Puzzle, Plus, Play, Settings } from 'lucide-react';

interface IntegrationBuilderProps {
  workspaceId: string;
}

interface Integration {
  id: string;
  name: string;
  description: string;
  authType: string;
  endpoints: Array<{ id: string }>;
}

export function IntegrationBuilder({ workspaceId }: IntegrationBuilderProps) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [showBuilder, setShowBuilder] = useState(false);

  useEffect(() => {
    const loadIntegrations = async () => {
      try {
        const response = await fetch(`/api/integration-builder/integrations?workspaceId=${workspaceId}`);
        const data = await response.json();
        setIntegrations(data);
      } catch (error) {
        console.error('Failed to load integrations', error);
      }
    };
    loadIntegrations();
  }, [workspaceId]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Puzzle className="w-5 h-5" />
          Custom Integrations
        </h2>
        <button
          onClick={() => setShowBuilder(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          New Integration
        </button>
      </div>

      <div className="space-y-3">
        {integrations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p className="mb-2">No custom integrations yet</p>
            <p className="text-sm">Create your first integration to connect to any API</p>
          </div>
        ) : (
          integrations.map((integration) => (
            <div
              key={integration.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <div>
                <p className="font-medium text-gray-900 dark:text-white">{integration.name}</p>
                <p className="text-sm text-gray-500">{integration.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded">
                    {integration.authType}
                  </span>
                  <span className="text-xs text-gray-500">
                    {integration.endpoints.length} endpoints
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  title="Test Integration"
                >
                  <Play className="w-4 h-4" />
                </button>
                <button
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showBuilder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Create Custom Integration</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Integration builder interface would go here with forms for OAuth2, API keys, endpoints, and data transformations.
            </p>
            <button
              onClick={() => setShowBuilder(false)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded hover:bg-gray-300 dark:hover:bg-gray-600"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
