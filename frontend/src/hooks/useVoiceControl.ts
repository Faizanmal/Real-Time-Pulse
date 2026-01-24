import { useState, useLayoutEffect, useCallback, useRef } from 'react';

interface VoiceControlOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}

interface VoiceCommand {
  text: string;
  timestamp: Date;
  confidence: number;
}

// Minimal local typing for the parts of the Web Speech API we use
type SpeechRecognitionResultItem = { transcript?: string; confidence?: number };
type SpeechRecognitionResultLike = { isFinal?: boolean; 0?: SpeechRecognitionResultItem };
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };

interface SpeechRecognitionLike {
  lang?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onstart?: () => void;
  onend?: () => void;
  onresult?: (e: SpeechRecognitionEventLike) => void;
  onerror?: (e: { error?: string } & Record<string, unknown>) => void;
  start: () => void;
  stop: () => void;
}

export function useVoiceControl(options: VoiceControlOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const isSupported = (() => {
    const win = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    return !!(win.SpeechRecognition ?? win.webkitSpeechRecognition);
  })();
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onCommandRef = useRef<((command: VoiceCommand) => void) | null>(null);

  useLayoutEffect(() => {
    // Check if browser supports Web Speech API
    const win = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const impl: unknown = win.SpeechRecognition ?? win.webkitSpeechRecognition;

    if (!impl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError('Voice recognition not supported in this browser');
      return;
    }

    // Initialize speech recognition
    const RecognitionCtor = impl as unknown as new () => SpeechRecognitionLike;
    const recognition = new RecognitionCtor();
    recognition.lang = options.language || 'en-US';
    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = options.interimResults ?? true;

    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult && lastResult.isFinal) {
        const item = lastResult[0] || {};
        const command: VoiceCommand = {
          text: item.transcript || '',
          timestamp: new Date(),
          confidence: item.confidence ?? 0,
        };

        setTranscript(command.text);

        // Call the command handler
        if (onCommandRef.current) {
          onCommandRef.current(command);
        }
      } else if (lastResult) {
        // Interim results
        setTranscript(lastResult[0]?.transcript || '');
      }
    };

    recognition.onerror = (event) => {
      setError(`Voice recognition error: ${event?.error ?? 'unknown'}`);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [options.language, options.continuous, options.interimResults]);

  const startListening = useCallback(() => {
    if (!isSupported || !recognitionRef.current) {
      setError('Voice recognition not available');
      return;
    }

    try {
      setTranscript('');
      recognitionRef.current.start();
    } catch (err: unknown) {
      const maybeMessage = (err as Record<string, unknown>).message;
      const msg = typeof maybeMessage === 'string' ? maybeMessage : String(err);
      if (msg.includes('already started')) {
        // Already listening, ignore
        return;
      }
      setError(msg);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const setOnCommand = useCallback((handler: (command: VoiceCommand) => void) => {
    onCommandRef.current = handler;
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
    setOnCommand,
  };
}
