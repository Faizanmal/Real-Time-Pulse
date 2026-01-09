'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useVoiceControl } from '@/contexts/VoiceControlContext';

interface VoiceControlButtonProps {
  className?: string;
  showTranscript?: boolean;
}

export function VoiceControlButton({ className = '', showTranscript = true }: VoiceControlButtonProps) {
  const {
    isSupported,
    isEnabled,
    isListening,
    isSpeaking,
    transcript,
    error,
    enable,
    disable,
    startListening,
    stopListening,
  } = useVoiceControl();

  const [showTooltip, setShowTooltip] = useState(false);

  if (!isSupported) {
    return null;
  }

  const handleClick = () => {
    if (!isEnabled) {
      enable();
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const toggleEnabled = () => {
    if (isEnabled) {
      disable();
    } else {
      enable();
    }
  };

  return (
    <div className={`relative inline-flex items-center ${className}`}>
      {/* Main button */}
      <button
        onClick={handleClick}
        disabled={!isEnabled}
        className={`
          relative flex items-center justify-center w-10 h-10 rounded-full
          transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2
          ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 focus:ring-red-500'
              : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-500'
          }
          ${!isEnabled ? 'opacity-50 cursor-not-allowed' : ''}
        `}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label={isListening ? 'Stop voice command' : 'Start voice command'}
      >
        {/* Microphone icon */}
        <svg
          className="w-5 h-5 text-white"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          {isListening ? (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
            />
          ) : (
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          )}
        </svg>

        {/* Listening indicator */}
        {isListening && (
          <span className="absolute inset-0 rounded-full animate-ping bg-red-400 opacity-75" />
        )}

        {/* Speaking indicator */}
        {isSpeaking && (
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>

      {/* Enable/disable toggle */}
      <button
        onClick={toggleEnabled}
        className="ml-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        aria-label={isEnabled ? 'Disable voice control' : 'Enable voice control'}
      >
        {isEnabled ? 'On' : 'Off'}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-sm text-white bg-gray-900 rounded-lg shadow-lg whitespace-nowrap z-50">
          {isListening ? 'Listening... Click to stop' : 'Click to start voice command'}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900" />
        </div>
      )}

      {/* Transcript display */}
      {showTranscript && transcript && isListening && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 min-w-64 z-50">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Heard:</span> {transcript}
          </p>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="absolute top-full left-0 right-0 mt-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 min-w-64 z-50">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}
    </div>
  );
}

// Voice command help panel
export function VoiceCommandHelp({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const commands = [
    { category: 'Navigation', examples: ['Go to dashboard', 'Open settings', 'Navigate to analytics'] },
    { category: 'Widgets', examples: ['Add a chart widget', 'Remove the sales widget', 'Create a new KPI'] },
    { category: 'Data', examples: ['Show last 30 days', 'Filter by region', 'Refresh data'] },
    { category: 'Reports', examples: ['Generate executive report', 'Export as PDF', 'Download data'] },
    { category: 'Queries', examples: ['What are the total sales?', 'Show me the top customers', 'Compare Q1 and Q2'] },
  ];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Voice Commands Help
            </h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Use your voice to control the dashboard. Here are some example commands:
          </p>
        </div>

        <div className="p-6 space-y-6">
          {commands.map((section) => (
            <div key={section.category}>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                {section.category}
              </h3>
              <div className="flex flex-wrap gap-2">
                {section.examples.map((example) => (
                  <span
                    key={example}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                  >
                    "{example}"
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Tip: Speak clearly and wait for the listening indicator before speaking.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
