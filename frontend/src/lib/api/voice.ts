'use client';

import { apiClient } from './client';

export interface VoiceTranscription {
  id?: string;
  text: string;
  confidence: number;
  language: string;
  duration: number;
}

export interface VoiceCommandResult {
  command: string;
  action: string;
  parameters: Record<string, unknown>;
  executed: boolean;
  result?: unknown;
  error?: string;
}

export interface VoiceAnnotation {
  id: string;
  portalId: string;
  widgetId?: string;
  audioUrl: string;
  transcription: string;
  duration: number;
  createdAt: string;
  createdBy: string;
}

export interface TTSVoice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  premium?: boolean;
  preview?: string;
}

export interface SupportedLanguage {
  code: string;
  name: string;
  nativeName: string;
}

export interface VoiceCommand {
  id?: string;
  command: string;
  description: string;
  examples: string[];
  category: string;
  enabled: boolean;
  parameters?: { name: string; type: string; required: boolean }[];
  phrase?: string;
}

export const voiceApi = {
  transcribe: async (audio: File, language?: string): Promise<VoiceTranscription> => {
    const formData = new FormData();
    formData.append('audio', audio);
    if (language) {
      formData.append('language', language);
    }
    const response = await apiClient.post('/voice/transcribe', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response as VoiceTranscription;
  },

  processCommand: async (data: {
    text: string;
    context?: Record<string, unknown>;
  }): Promise<VoiceCommandResult> => {
    const response = await apiClient.post('/voice/command', data);
    return response as VoiceCommandResult;
  },

  textToSpeech: async (data: {
    text: string;
    voiceId?: string;
    language?: string;
    speed?: number;
  }): Promise<Blob> => {
    const response = await apiClient.post('/voice/synthesize', data, {
      responseType: 'blob',
    });
    return response as Blob;
  },

  createAnnotation: async (data: {
    portalId: string;
    widgetId?: string;
    audio: File;
    transcription?: string;
  }): Promise<VoiceAnnotation> => {
    const formData = new FormData();
    formData.append('portalId', data.portalId);
    if (data.widgetId) formData.append('widgetId', data.widgetId);
    formData.append('audio', data.audio);
    if (data.transcription) formData.append('transcription', data.transcription);
    const response = await apiClient.post('/voice/annotations', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response as VoiceAnnotation;
  },

  getAnnotations: async (portalId: string): Promise<VoiceAnnotation[]> => {
    const response = await apiClient.get<VoiceAnnotation[]>(`/voice/annotations/${portalId}`);
    return response;
  },

  deleteAnnotation: async (portalId: string, annotationId: string): Promise<void> => {
    await apiClient.delete(`/voice/annotations/${portalId}/${annotationId}`);
  },

  getVoices: async (): Promise<TTSVoice[]> => {
    const response = await apiClient.get<TTSVoice[]>('/voice/voices');
    return response as TTSVoice[];
  },

  getLanguages: async (): Promise<SupportedLanguage[]> => {
    const response = await apiClient.get<SupportedLanguage[]>('/voice/languages');
    return response as SupportedLanguage[];
  },

  getCommands: async (): Promise<VoiceCommand[]> => {
    const response = await apiClient.get<VoiceCommand[]>('/voice/commands');
    return response;
  },

  generateAccessibilityDescription: async (data: {
    widgetId: string;
    widgetType: string;
    data: Record<string, unknown>;
  }): Promise<{ description: string }> => {
    const response = await apiClient.post('/voice/accessibility', data);
    return response as { description: string };
  },
};

export const voiceControlApi = {
  processCommand: async (data: {
    command: string;
    context?: Record<string, unknown>;
  }): Promise<VoiceCommandResult> => {
    const response = await apiClient.post('/voice-control/command', data);
    return response as VoiceCommandResult;
  },

  getHistory: async (limit?: number): Promise<VoiceCommandResult[]> => {
    const response = await apiClient.get<VoiceCommandResult[]>('/voice-control/history', { params: { limit } });
    return response;
  },
};

