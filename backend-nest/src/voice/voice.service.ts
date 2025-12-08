import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.service';
import { VoiceCommandService } from './voice-command.service';

export interface VoiceCommand {
  id: string;
  phrase: string;
  action: string;
  parameters?: Record<string, any>;
  confidence: number;
}

export interface VoiceAnnotation {
  id: string;
  portalId: string;
  widgetId?: string;
  userId: string;
  audioUrl?: string;
  transcript: string;
  timestamp: number;
  createdAt: Date;
}

export interface SpeechSynthesisOptions {
  voice?: string;
  rate?: number;
  pitch?: number;
  language?: string;
}

export interface WhisperResponse {
  text: string;
  words?: Array<{ word: string; start: number; end: number }>;
}

export interface ChartData {
  chartType?: string;
  title?: string;
  series?: Array<{ data: number[] }>;
  labels?: string[];
}

export interface MetricData {
  title?: string;
  value: number;
  change?: number;
  unit?: string;
}

export interface TableData {
  title?: string;
  rows?: unknown[];
  columns?: string[];
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);
  private readonly openAiApiKey?: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly cache: CacheService,
    private readonly commandService: VoiceCommandService,
  ) {
    this.openAiApiKey = this.configService.get<string>('OPENAI_API_KEY');
  }

  /**
   * Transcribe audio to text using Whisper API
   */
  async transcribeAudio(
    audioBuffer: Buffer,
    options?: { language?: string },
  ): Promise<{
    transcript: string;
    confidence: number;
    words?: Array<{ word: string; start: number; end: number }>;
  }> {
    if (!this.openAiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([new Uint8Array(audioBuffer)]),
        'audio.webm',
      );
      formData.append('model', 'whisper-1');
      formData.append('response_format', 'verbose_json');

      if (options?.language) {
        formData.append('language', options.language);
      }

      const response = await fetch(
        'https://api.openai.com/v1/audio/transcriptions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.openAiApiKey}`,
          },
          body: formData,
        },
      );

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.statusText}`);
      }

      const data: WhisperResponse = await response.json();

      return {
        transcript: data.text,
        confidence: 0.95, // Whisper doesn't return confidence, assume high
        words: data.words,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Transcription failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Process voice command
   */
  async processVoiceCommand(
    workspaceId: string,
    transcript: string,
  ): Promise<{
    command: VoiceCommand | null;
    response: string;
    action?: { type: string; payload: any };
  }> {
    // Parse command from transcript
    const command = await this.commandService.parseCommand(transcript);

    if (!command) {
      return {
        command: null,
        response:
          "I didn't understand that command. Try saying 'Show sales dashboard' or 'Filter by last month'.",
      };
    }

    // Execute command
    const result = await this.commandService.executeCommand(
      workspaceId,
      command,
    );

    return {
      command,
      response: result.response,
      action: result.action,
    };
  }

  /**
   * Generate speech from text
   */
  async synthesizeSpeech(
    text: string,
    options?: SpeechSynthesisOptions,
  ): Promise<{
    audioUrl: string;
    duration: number;
  }> {
    if (!this.openAiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    try {
      const response = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.openAiApiKey}`,
        },
        body: JSON.stringify({
          model: 'tts-1',
          input: text,
          voice: options?.voice || 'alloy',
          speed: options?.rate || 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`TTS API error: ${response.statusText}`);
      }

      const audioBuffer = await response.arrayBuffer();

      // In production, upload to storage and return URL
      // For now, return base64 data URL
      const base64Audio = Buffer.from(audioBuffer).toString('base64');
      const audioUrl = `data:audio/mp3;base64,${base64Audio}`;

      return {
        audioUrl,
        duration: text.length * 0.06, // Rough estimate
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Speech synthesis failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create voice annotation
   */
  async createAnnotation(
    workspaceId: string,
    userId: string,
    data: {
      portalId: string;
      widgetId?: string;
      transcript: string;
      audioUrl?: string;
      timestamp?: number;
    },
  ): Promise<VoiceAnnotation> {
    const annotationId = `annot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const annotation: VoiceAnnotation = {
      id: annotationId,
      portalId: data.portalId,
      widgetId: data.widgetId,
      userId,
      transcript: data.transcript,
      audioUrl: data.audioUrl,
      timestamp: data.timestamp || Date.now(),
      createdAt: new Date(),
    };

    // Save annotation
    const key = `voice_annotations:${workspaceId}:${data.portalId}`;
    const annotationsJson = await this.cache.get(key);
    const annotations: VoiceAnnotation[] = annotationsJson
      ? JSON.parse(annotationsJson)
      : [];
    annotations.push(annotation);

    await this.cache.set(key, JSON.stringify(annotations), 86400 * 365);

    return annotation;
  }

  async getAnnotations(
    workspaceId: string,
    portalId: string,
  ): Promise<VoiceAnnotation[]> {
    const key = `voice_annotations:${workspaceId}:${portalId}`;
    const annotationsJson = await this.cache.get(key);
    if (!annotationsJson) return [];

    try {
      const annotations: VoiceAnnotation[] = JSON.parse(annotationsJson);
      return annotations;
    } catch {
      return [];
    }
  }

  async deleteAnnotation(
    workspaceId: string,
    portalId: string,
    annotationId: string,
  ): Promise<void> {
    const key = `voice_annotations:${workspaceId}:${portalId}`;
    const annotationsJson = await this.cache.get(key);
    let annotations: VoiceAnnotation[] = [];

    if (annotationsJson) {
      try {
        annotations = JSON.parse(annotationsJson);
      } catch {
        // If parsing fails, start with empty array
      }
    }

    const filtered = annotations.filter((a) => a.id !== annotationId);
    await this.cache.set(key, JSON.stringify(filtered), 86400 * 365);
  }

  /**
   * Get available voices for TTS
   */
  getAvailableVoices() {
    return [
      {
        id: 'alloy',
        name: 'Alloy',
        gender: 'neutral',
        description: 'Balanced and versatile',
      },
      {
        id: 'echo',
        name: 'Echo',
        gender: 'male',
        description: 'Clear and professional',
      },
      {
        id: 'fable',
        name: 'Fable',
        gender: 'female',
        description: 'Warm and expressive',
      },
      {
        id: 'onyx',
        name: 'Onyx',
        gender: 'male',
        description: 'Deep and authoritative',
      },
      {
        id: 'nova',
        name: 'Nova',
        gender: 'female',
        description: 'Friendly and conversational',
      },
      {
        id: 'shimmer',
        name: 'Shimmer',
        gender: 'female',
        description: 'Soft and calm',
      },
    ];
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English' },
      { code: 'es', name: 'Spanish' },
      { code: 'fr', name: 'French' },
      { code: 'de', name: 'German' },
      { code: 'it', name: 'Italian' },
      { code: 'pt', name: 'Portuguese' },
      { code: 'zh', name: 'Chinese' },
      { code: 'ja', name: 'Japanese' },
      { code: 'ko', name: 'Korean' },
      { code: 'ar', name: 'Arabic' },
    ];
  }

  /**
   * Generate accessibility description
   */
  generateAccessibilityDescription(
    widgetType: string,
    widgetData: ChartData | MetricData | TableData | Record<string, unknown>,
  ): string {
    // Generate natural language description of widget content
    switch (widgetType) {
      case 'chart':
        return this.describeChart(widgetData as ChartData);
      case 'metric':
        return this.describeMetric(widgetData as MetricData);
      case 'table':
        return this.describeTable(widgetData as TableData);
      default:
        return `This is a ${widgetType} widget.`;
    }
  }

  private describeChart(data: ChartData): string {
    const { chartType, title, series } = data;
    const dataPoints = series?.[0]?.data?.length || 0;
    const maxValue = series?.[0]?.data ? Math.max(...series[0].data) : 0;
    const minValue = series?.[0]?.data ? Math.min(...series[0].data) : 0;

    return (
      `${title || 'Chart'}. This is a ${chartType || 'unknown'} chart with ${dataPoints} data points. ` +
      `Values range from ${minValue} to ${maxValue}.`
    );
  }

  private describeMetric(data: MetricData): string {
    const { title, value, change, unit } = data;
    const changeText = change
      ? `${change > 0 ? 'up' : 'down'} ${Math.abs(change)}%`
      : '';

    return `${title || 'Metric'}. Current value is ${value}${unit || ''}. ${changeText}`;
  }

  private describeTable(data: TableData): string {
    const { title, rows, columns } = data;
    const rowCount = rows?.length || 0;
    const colCount = columns?.length || 0;

    return `${title || 'Table'}. Contains ${rowCount} rows and ${colCount} columns.`;
  }
}
