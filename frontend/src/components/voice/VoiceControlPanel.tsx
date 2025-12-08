'use client';

import React, { useEffect, useState } from 'react';
import { useVoiceControl } from '@/hooks/useVoiceControl';
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface VoiceControlPanelProps {
  workspaceId: string;
  onCommand?: (command: any) => void;
}

export function VoiceControlPanel({ workspaceId, onCommand }: VoiceControlPanelProps) {
  const router = useRouter();
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);

  const {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    setOnCommand: setOnVoiceCommand,
  } = useVoiceControl({
    language: 'en-US',
    continuous: false,
    interimResults: true,
  });

  useEffect(() => {
    // Set up command handler
    setOnVoiceCommand(async (voiceCommand) => {
      setIsProcessing(true);
      setFeedback('Processing command...');

      try {
        // Send command to backend
        const response = await fetch('/api/voice/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: voiceCommand.text,
            workspaceId,
          }),
        });

        const result = await response.json();

        if (result.success) {
          setFeedback(result.message);
          setCommandHistory(prev => [voiceCommand.text, ...prev.slice(0, 4)]);

          // Execute the command action
          await executeCommand(result);

          // Speak the response
          speakResponse(result.message);

          // Call external handler if provided
          if (onCommand) {
            onCommand(result);
          }
        } else {
          setFeedback(result.message || 'Command failed');
          speakResponse(result.message);
        }
      } catch (err: any) {
        setFeedback('Failed to process command');
        console.error('Voice command error:', err);
      } finally {
        setIsProcessing(false);
      }
    });
  }, [workspaceId, onCommand, setOnVoiceCommand]);

  const executeCommand = async (result: any) => {
    switch (result.action) {
      case 'show_dashboard':
        if (result.data?.dashboard?.id) {
          router.push(`/dashboard/${result.data.dashboard.id}`);
        }
        break;

      case 'show_project':
        if (result.data?.project?.id) {
          router.push(`/projects/${result.data.project.id}`);
        }
        break;

      case 'create_alert':
        router.push('/alerts/new');
        break;

      case 'create_dashboard':
        router.push('/dashboard/new');
        break;

      case 'generate_report':
        // Trigger report generation
        if (result.data) {
          await fetch('/api/reports/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(result.data),
          });
        }
        break;

      case 'navigate':
        if (result.data?.route) {
          router.push(result.data.route);
        }
        break;

      case 'apply_filter':
        // This would be handled by the parent component
        if (onCommand) {
          onCommand(result);
        }
        break;

      case 'show_status':
        // Display status in UI
        if (onCommand) {
          onCommand(result);
        }
        break;
    }
  };

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      window.speechSynthesis.speak(utterance);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  if (!isSupported) {
    return (
      <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <p className="text-sm text-yellow-800 dark:text-yellow-200">
          Voice control is not supported in your browser. Please use Chrome, Edge, or Safari.
        </p>
      </div>
    );
  }

  return (
    <div className="voice-control-panel bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Voice Control
        </h3>

        <button
          onClick={toggleListening}
          disabled={isProcessing}
          className={`
            p-3 rounded-full transition-all duration-200 
            ${isListening 
              ? 'bg-red-500 hover:bg-red-600 animate-pulse' 
              : 'bg-blue-500 hover:bg-blue-600'
            }
            ${isProcessing ? 'opacity-50 cursor-not-allowed' : ''}
            text-white shadow-lg
          `}
        >
          {isListening ? (
            <MicOff className="w-6 h-6" />
          ) : (
            <Mic className="w-6 h-6" />
          )}
        </button>
      </div>

      {/* Transcript Display */}
      {(transcript || isListening) && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            {isListening ? 'Listening...' : 'Last command:'}
          </p>
          <p className="text-gray-900 dark:text-white font-medium">
            {transcript || 'Speak now...'}
          </p>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className={`
          rounded-lg p-4 
          ${isProcessing 
            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800' 
            : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
          }
        `}>
          <p className={`text-sm ${isProcessing ? 'text-blue-800 dark:text-blue-200' : 'text-green-800 dark:text-green-200'}`}>
            {feedback}
          </p>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Command Examples */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Try saying:
        </p>
        <ul className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
          <li>• "Show me project X status"</li>
          <li>• "Create alert for budget overruns"</li>
          <li>• "Generate weekly report"</li>
          <li>• "Show dashboard overview"</li>
          <li>• "Go to analytics"</li>
        </ul>
      </div>

      {/* Command History */}
      {commandHistory.length > 0 && (
        <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Recent Commands:
          </p>
          <ul className="space-y-1">
            {commandHistory.map((cmd, index) => (
              <li 
                key={index}
                className="text-xs text-gray-600 dark:text-gray-400 truncate"
              >
                {cmd}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
