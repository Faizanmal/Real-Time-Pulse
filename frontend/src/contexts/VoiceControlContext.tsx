'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useVoiceCommands } from '@/hooks/useVoiceCommands';

interface VoiceCommand {
  intent: string;
  action: string;
  parameters: Record<string, any>;
  confidence: number;
}

interface VoiceControlContextType {
  isSupported: boolean;
  isEnabled: boolean;
  isListening: boolean;
  isSpeaking: boolean;
  transcript: string;
  error: string | null;
  lastCommand: VoiceCommand | null;
  enable: () => void;
  disable: () => void;
  startListening: () => void;
  stopListening: () => void;
  speak: (text: string) => void;
  registerCommandHandler: (action: string, handler: (params: Record<string, any>) => void) => void;
  unregisterCommandHandler: (action: string) => void;
}

const VoiceControlContext = createContext<VoiceControlContextType | null>(null);

export function VoiceControlProvider({ children }: { children: React.ReactNode }) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [lastCommand, setLastCommand] = useState<VoiceCommand | null>(null);
  const [commandHandlers, setCommandHandlers] = useState<Record<string, (params: Record<string, any>) => void>>({});

  const handleVoiceResult = useCallback(
    async (transcript: string, isFinal: boolean) => {
      if (!isFinal) return;

      try {
        const response = await fetch('/api/v1/voice/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcript }),
        });

        if (response.ok) {
          const command: VoiceCommand = await response.json();
          setLastCommand(command);

          if (command.confidence > 0.5) {
            // Execute command
            const handler = commandHandlers[command.action];
            if (handler) {
              handler(command.parameters);
            }
          }
        }
      } catch (error) {
        console.error('Voice command processing error:', error);
      }
    },
    [commandHandlers]
  );

  const {
    isSupported,
    isListening,
    transcript,
    error,
    startListening: start,
    stopListening: stop,
    speak,
    isSpeaking,
  } = useVoiceCommands({
    continuous: true,
    interimResults: true,
    onResult: handleVoiceResult,
  });

  const enable = useCallback(() => {
    setIsEnabled(true);
    localStorage.setItem('voiceControlEnabled', 'true');
  }, []);

  const disable = useCallback(() => {
    setIsEnabled(false);
    stop();
    localStorage.setItem('voiceControlEnabled', 'false');
  }, [stop]);

  const startListening = useCallback(() => {
    if (isEnabled && isSupported) {
      start();
    }
  }, [isEnabled, isSupported, start]);

  const stopListening = useCallback(() => {
    stop();
  }, [stop]);

  const registerCommandHandler = useCallback(
    (action: string, handler: (params: Record<string, any>) => void) => {
      setCommandHandlers((prev) => ({ ...prev, [action]: handler }));
    },
    []
  );

  const unregisterCommandHandler = useCallback((action: string) => {
    setCommandHandlers((prev) => {
      const { [action]: _, ...rest } = prev;
      return rest;
    });
  }, []);

  // Load preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('voiceControlEnabled');
    if (saved === 'true') {
      setIsEnabled(true);
    }
  }, []);

  return (
    <VoiceControlContext.Provider
      value={{
        isSupported,
        isEnabled,
        isListening,
        isSpeaking,
        transcript,
        error,
        lastCommand,
        enable,
        disable,
        startListening,
        stopListening,
        speak,
        registerCommandHandler,
        unregisterCommandHandler,
      }}
    >
      {children}
    </VoiceControlContext.Provider>
  );
}

export function useVoiceControl() {
  const context = useContext(VoiceControlContext);
  if (!context) {
    throw new Error('useVoiceControl must be used within a VoiceControlProvider');
  }
  return context;
}
