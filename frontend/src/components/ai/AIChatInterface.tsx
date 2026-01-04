'use client';

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  KeyboardEvent,
} from 'react';
import { Send, Mic, MicOff, Sparkles, X, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    suggestions?: string[];
    charts?: ChartSuggestion[];
    interpretation?: string;
  };
}

interface ChartSuggestion {
  type: string;
  title: string;
  dataQuery: string;
  config: Record<string, any>;
}

interface AIChatInterfaceProps {
  workspaceId: string;
  portalId?: string;
  onChartCreate?: (chart: ChartSuggestion) => void;
  className?: string;
}

export function AIChatInterface({
  workspaceId,
  portalId,
  onChartCreate,
  className,
}: AIChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([
    'Show me the top performing metrics',
    'What are the main trends?',
    'Compare this month vs last month',
    'Show anomalies in recent data',
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = true;
      recognitionRef.current.lang = 'en-US';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = Array.from(event.results)
          .map((result: any) => result[0].transcript)
          .join('');
        setInput(transcript);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => {
        setIsListening(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Toggle voice input
  const toggleVoice = useCallback(() => {
    if (!recognitionRef.current) {
      alert('Speech recognition is not supported in your browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  }, [isListening]);

  // Send message
  const sendMessage = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/ai/conversation/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: userMessage.content,
          portalId,
        }),
      });

      const data = await response.json();

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data?.response || data.interpretation || 'I understood your question. Let me help you with that.',
        timestamp: new Date(),
        metadata: {
          suggestions: data.followUpQuestions,
          charts: data.chartSuggestions,
          interpretation: data.interpretation,
        },
      };

      setMessages(prev => [...prev, assistantMessage]);

      // Update suggestions
      if (data.followUpQuestions?.length > 0) {
        setSuggestions(data.followUpQuestions);
      }

      // Speak response if voice was used
      if (isListening && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(assistantMessage.content);
        window.speechSynthesis.speak(utterance);
      }
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your request. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, portalId, isListening]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage]
  );

  // Handle suggestion click
  const handleSuggestion = useCallback((suggestion: string) => {
    setInput(suggestion);
    inputRef.current?.focus();
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col bg-slate-900 border border-slate-700 rounded-xl shadow-2xl',
        isExpanded ? 'fixed inset-4 z-50' : 'h-[500px]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-blue-400" />
          <span className="font-semibold text-white">AI Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          {isExpanded && (
            <button
              onClick={() => setIsExpanded(false)}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Sparkles className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">
              Ask me anything about your data
            </h3>
            <p className="text-slate-400 text-sm mb-6">
              I can help you analyze trends, find insights, and create visualizations.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {suggestions.map((suggestion, i) => (
                <button
                  key={i}
                  onClick={() => handleSuggestion(suggestion)}
                  className="px-3 py-1.5 text-sm bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700 transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map(message => (
          <div
            key={message.id}
            className={cn(
              'flex',
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            <div
              className={cn(
                'max-w-[80%] rounded-xl px-4 py-3',
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-800 text-slate-200'
              )}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>

              {/* Chart suggestions */}
              {message.metadata?.charts && message.metadata.charts.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-xs text-slate-400 mb-2">Suggested visualizations:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.metadata.charts.map((chart, i) => (
                      <button
                        key={i}
                        onClick={() => onChartCreate?.(chart)}
                        className="px-2 py-1 text-xs bg-slate-700 text-blue-400 rounded hover:bg-slate-600 transition-colors"
                      >
                        📊 {chart.title}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Follow-up suggestions */}
              {message.metadata?.suggestions && message.metadata.suggestions.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-600">
                  <p className="text-xs text-slate-400 mb-2">You might also ask:</p>
                  <div className="flex flex-wrap gap-2">
                    {message.metadata.suggestions.map((suggestion, i) => (
                      <button
                        key={i}
                        onClick={() => handleSuggestion(suggestion)}
                        className="px-2 py-1 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <span className="text-xs text-slate-500 mt-2 block">
                {message.timestamp.toLocaleTimeString()}
              </span>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-xl px-4 py-3">
              <div className="flex gap-1">
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-700">
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask me anything..."
              rows={1}
              className={cn(
                'w-full px-4 py-3 pr-12 bg-slate-800 border border-slate-600 rounded-xl',
                'text-white placeholder:text-slate-500',
                'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'resize-none',
                isListening && 'ring-2 ring-red-500 border-red-500'
              )}
              style={{ maxHeight: '120px' }}
            />
            <button
              onClick={toggleVoice}
              className={cn(
                'absolute right-3 bottom-3 p-1.5 rounded-lg transition-colors',
                isListening
                  ? 'bg-red-500 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700'
              )}
              title={isListening ? 'Stop listening' : 'Start voice input'}
            >
              {isListening ? (
                <MicOff className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
          </div>
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={cn(
              'p-3 rounded-xl transition-colors',
              input.trim() && !isLoading
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-slate-700 text-slate-500 cursor-not-allowed'
            )}
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default AIChatInterface;
