'use client';

import React, { useState } from 'react';
import { useVoice } from '@/hooks/useAdvancedFeatures';
import { voiceAPI } from '@/lib/advanced-features-api';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  Settings,
  Wand2,
  HelpCircle,
  Play,
  Pause,
  RefreshCw,
  X,
} from 'lucide-react';

interface VoiceCommand {
  command: string;
  description: string;
  examples: string[];
}

interface VoiceAnnotation {
  id: string;
  transcript: string;
  timestamp: number;
  createdAt: string;
}

export function VoiceDashboardPanel() {
  const {
    isListening,
    transcript,
    voices,
    startListening,
    stopListening,
    speak,
  } = useVoice();

  const [selectedVoice, setSelectedVoice] = useState<string>('');
  const [speechRate, setSpeechRate] = useState(1);
  const [textToSpeak, setTextToSpeak] = useState('');
  const [annotations, setAnnotations] = useState<VoiceAnnotation[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [commandHistory, setCommandHistory] = useState<{ text: string; action: string; time: Date }[]>([]);
  const [activeTab, setActiveTab] = useState<'voice' | 'commands' | 'annotations'>('voice');

  const handleStartListening = async () => {
    await startListening();
  };

  const handleStopListening = () => {
    stopListening();
    if (transcript) {
      setCommandHistory((prev) => [
        { text: transcript, action: 'Processing...', time: new Date() },
        ...prev,
      ]);
    }
  };

  const handleSpeak = async () => {
    if (!textToSpeak.trim()) return;
    
    setIsSpeaking(true);
    try {
      await speak(textToSpeak, { voice: selectedVoice, rate: speechRate });
    } finally {
      setIsSpeaking(false);
    }
  };

  const handleSaveAnnotation = async () => {
    if (!transcript) return;
    
    try {
      const annotation = await voiceAPI.createAnnotation({
        transcript,
        timestamp: Date.now(),
        portalId: 'current', // Would be dynamic in real app
      });
      setAnnotations((prev) => [annotation, ...prev]);
    } catch (error) {
      console.error('Failed to save annotation:', error);
    }
  };

  const availableCommands: VoiceCommand[] = [
    {
      command: 'Navigate to [page]',
      description: 'Navigate to a specific page or portal',
      examples: ['Navigate to dashboard', 'Open settings', 'Go to analytics'],
    },
    {
      command: 'Show [data type]',
      description: 'Display specific data or metrics',
      examples: ['Show revenue', 'Display users chart', 'Show alerts'],
    },
    {
      command: 'Filter by [criteria]',
      description: 'Apply filters to current view',
      examples: ['Filter by date', 'Show only active items', 'Filter last week'],
    },
    {
      command: 'Export [format]',
      description: 'Export current view to file',
      examples: ['Export to PDF', 'Download as CSV', 'Export Excel'],
    },
    {
      command: 'Create [item]',
      description: 'Create new items',
      examples: ['Create new portal', 'Add widget', 'Create alert'],
    },
    {
      command: 'Describe [element]',
      description: 'Get AI description of element (accessibility)',
      examples: ['Describe this chart', 'What does this show', 'Explain data'],
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-linear-to-br from-indigo-500 to-purple-500 rounded-lg">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">Voice Dashboard</h2>
            <p className="text-sm text-gray-600">Control your dashboard with voice commands</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => setShowSettings(!showSettings)}>
          <Settings className="h-4 w-4 mr-2" />
          Settings
        </Button>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          {(['voice', 'commands', 'annotations'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 border-b-2 font-medium text-sm capitalize ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Voice Interface */}
        <div className="lg:col-span-2">
          {activeTab === 'voice' && (
            <Card className="p-6">
              {/* Voice Input */}
              <div className="text-center mb-8">
                <button
                  onClick={isListening ? handleStopListening : handleStartListening}
                  className={`w-32 h-32 rounded-full flex items-center justify-center transition-all ${
                    isListening
                      ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                      : 'bg-indigo-600 hover:bg-indigo-700'
                  }`}
                >
                  {isListening ? (
                    <MicOff className="h-16 w-16 text-white" />
                  ) : (
                    <Mic className="h-16 w-16 text-white" />
                  )}
                </button>
                <p className="mt-4 text-lg font-medium">
                  {isListening ? 'Listening...' : 'Click to start'}
                </p>
                <p className="text-sm text-gray-500">
                  {isListening
                    ? 'Speak your command clearly'
                    : 'Press the microphone to activate voice control'}
                </p>
              </div>

              {/* Transcript Display */}
              {transcript && (
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-600">Transcript</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSaveAnnotation}
                      >
                        Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => {}}>
                        <RefreshCw className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-lg">{transcript}</p>
                </div>
              )}

              {/* Text-to-Speech */}
              <div className="border-t pt-6">
                <h3 className="font-medium mb-4 flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Text-to-Speech
                </h3>
                <textarea
                  className="w-full p-3 border rounded-lg mb-3"
                  rows={3}
                  placeholder="Enter text to speak..."
                  value={textToSpeak}
                  onChange={(e) => setTextToSpeak(e.target.value)}
                />
                <div className="flex items-center gap-4">
                  <Button onClick={handleSpeak} disabled={isSpeaking || !textToSpeak.trim()}>
                    {isSpeaking ? (
                      <>
                        <Pause className="h-4 w-4 mr-2" />
                        Speaking...
                      </>
                    ) : (
                      <>
                        <Play className="h-4 w-4 mr-2" />
                        Speak
                      </>
                    )}
                  </Button>
                  <select
                    className="px-3 py-2 border rounded-lg text-sm"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                  >
                    <option value="">Default Voice</option>
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-600">Speed:</span>
                    <input
                      type="range"
                      min={0.5}
                      max={2}
                      step={0.1}
                      value={speechRate}
                      onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                      className="w-24"
                    />
                    <span className="text-sm w-8">{speechRate}x</span>
                  </div>
                </div>
              </div>
            </Card>
          )}

          {activeTab === 'commands' && (
            <Card className="p-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <Wand2 className="h-5 w-5" />
                Available Voice Commands
              </h3>
              <div className="space-y-4">
                {availableCommands.map((cmd, idx) => (
                  <div key={idx} className="border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="bg-indigo-50 text-indigo-700">
                        {cmd.command}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{cmd.description}</p>
                    <div className="flex flex-wrap gap-2">
                      {cmd.examples.map((example, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-1 bg-gray-100 rounded-full text-gray-600"
                        >
                          &quot;{example}&quot;
                        </span>
                      ))}
                    </div>
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              </div>
                ))}
              </div>
            </Card>
          )}

          {activeTab === 'annotations' && (
            <Card className="p-6">
              <h3 className="font-medium mb-4 flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Voice Annotations
              </h3>
              {annotations.length > 0 ? (
                <div className="space-y-3">
                  {annotations.map((annotation) => (
                    <div
                      key={annotation.id}
                      className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg"
                    >
                      <Mic className="h-5 w-5 text-indigo-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm">{annotation.transcript}</p>
                        <span className="text-xs text-gray-500">
                          {new Date(annotation.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <Button variant="ghost" size="sm">
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                  <p className="text-gray-600">No annotations yet</p>
                  <p className="text-sm text-gray-500">
                    Save voice transcripts as annotations
                  </p>
                </div>
              )}
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Command History */}
          <Card className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Recent Commands
            </h4>
            {commandHistory.length > 0 ? (
              <div className="space-y-2">
                {commandHistory.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="text-sm p-2 bg-gray-50 rounded-lg">
                    <p className="font-medium truncate">{item.text}</p>
                    <div className="flex items-center justify-between mt-1">
                      <Badge variant="outline" className="text-xs">
                        {item.action}
                      </Badge>
                      <span className="text-xs text-gray-400">
                        {item.time.toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">
                No commands yet
              </p>
            )}
          </Card>

          {/* Settings */}
          {showSettings && (
            <Card className="p-4">
              <h4 className="font-medium mb-3 flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Voice Settings
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Language</label>
                  <select className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                    <option value="es-ES">Spanish</option>
                    <option value="fr-FR">French</option>
                    <option value="de-DE">German</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Voice Output</label>
                  <select
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    value={selectedVoice}
                    onChange={(e) => setSelectedVoice(e.target.value)}
                  >
                    <option value="">System Default</option>
                    {voices.map((voice) => (
                      <option key={voice.id} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Speech Rate: {speechRate}x
                  </label>
                  <input
                    type="range"
                    min={0.5}
                    max={2}
                    step={0.1}
                    value={speechRate}
                    onChange={(e) => setSpeechRate(parseFloat(e.target.value))}
                    className="w-full"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Auto-listen on page load</span>
                  <input type="checkbox" className="rounded" />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Speak confirmations</span>
                  <input type="checkbox" className="rounded" defaultChecked />
                </div>
              </div>
            </Card>
          )}

          {/* Help */}
          <Card className="p-4">
            <h4 className="font-medium mb-3 flex items-center gap-2">
              <HelpCircle className="h-4 w-4" />
              Quick Tips
            </h4>
            <div className="space-y-2 text-sm text-gray-600">
              <p>• Speak clearly and at a normal pace</p>
              <p>• Wait for the beep before speaking</p>
              <p>• Use command keywords like &quot;show&quot;, &quot;navigate&quot;, &quot;create&quot;</p>
              <p>• Say &quot;help&quot; to see available commands</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
