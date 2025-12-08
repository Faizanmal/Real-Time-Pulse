import { useState, useEffect, useCallback, useRef } from 'react';

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

export function useVoiceControl(options: VoiceControlOptions = {}) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const recognitionRef = useRef<any>(null);
  const onCommandRef = useRef<((command: VoiceCommand) => void) | null>(null);

  useEffect(() => {
    // Check if browser supports Web Speech API
    const SpeechRecognition = 
      (window as any).SpeechRecognition || 
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setIsSupported(false);
      setError('Voice recognition not supported in this browser');
      return;
    }

    setIsSupported(true);

    // Initialize speech recognition
    const recognition = new SpeechRecognition();
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

    recognition.onresult = (event: any) => {
      const results = event.results;
      const lastResult = results[results.length - 1];
      
      if (lastResult.isFinal) {
        const command: VoiceCommand = {
          text: lastResult[0].transcript,
          timestamp: new Date(),
          confidence: lastResult[0].confidence,
        };

        setTranscript(command.text);

        // Call the command handler
        if (onCommandRef.current) {
          onCommandRef.current(command);
        }
      } else {
        // Interim results
        setTranscript(lastResult[0].transcript);
      }
    };

    recognition.onerror = (event: any) => {
      setError(`Voice recognition error: ${event.error}`);
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
    } catch (err: any) {
      if (err.message.includes('already started')) {
        // Already listening, ignore
        return;
      }
      setError(err.message);
    }
  }, [isSupported]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
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
