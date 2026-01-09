'use client';

/**
 * Voice Management Dashboard
 * Manage voice transcription, text-to-speech, and voice commands
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Mic, 
  MicOff,
  Volume2,
  Play,
  Pause,
  Settings,
  History,
  Command,
  FileAudio,
  Languages,
  Upload,
  Trash2,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { voiceApi } from '@/lib/api/index';
import type { VoiceTranscription, VoiceAnnotation, TTSVoice, VoiceCommand } from '@/lib/api/index';
import { toast } from 'sonner';

export default function VoicePage() {
  const [activeTab, setActiveTab] = useState('transcribe');
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [transcriptions, setTranscriptions] = useState<VoiceTranscription[]>([]);
  const [annotations] = useState<VoiceAnnotation[]>([]);
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const [voices, setVoices] = useState<TTSVoice[]>([]);
  const [languages, setLanguages] = useState<{ code: string; name: string }[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState('en-US');
  const [selectedVoice, setSelectedVoice] = useState('');
  const [ttsText, setTtsText] = useState('');
  const [ttsRate, setTtsRate] = useState([1.0]);
  const [ttsPitch, setTtsPitch] = useState([1.0]);
  const [loading, setLoading] = useState(true);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [voicesData, languagesData, commandsData] = await Promise.all([
        voiceApi.getVoices(),
        voiceApi.getLanguages(),
        voiceApi.getCommands(),
      ]);
      setVoices(voicesData);
      setLanguages(languagesData);
      setCommands(commandsData);
      if (voicesData.length > 0) {
        setSelectedVoice(voicesData[0].id);
      }
    } catch (error) {
      console.error('Failed to load voice data:', error);
      toast.error('Failed to load voice data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        await transcribeAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording started...');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to access microphone');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const transcribeAudio = async (audioBlob: Blob) => {
    try {
      const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
      const result = await voiceApi.transcribe(audioFile, selectedLanguage);
      setTranscriptions(prev => [result, ...prev]);
      toast.success('Transcription complete!');
    } catch (error) {
      console.error('Transcription failed:', error);
      toast.error('Failed to transcribe audio');
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const result = await voiceApi.transcribe(file, selectedLanguage);
      setTranscriptions(prev => [result, ...prev]);
      toast.success('Audio file transcribed!');
    } catch (error) {
      console.error('Failed to transcribe file:', error);
      toast.error('Failed to transcribe audio file');
    }
  };

  const synthesizeSpeech = async () => {
    if (!ttsText.trim()) {
      toast.error('Please enter text to synthesize');
      return;
    }

    try {
      setIsPlaying(true);
      const result = await voiceApi.textToSpeech({
        text: ttsText,
        voiceId: selectedVoice,
        speed: ttsRate[0],
      });
      
      // Play audio from blob
      const audioUrl = URL.createObjectURL(result);
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPlaying(false);
      audio.play();
      toast.success('Speech generated!');
    } catch (error) {
      console.error('TTS failed:', error);
      toast.error('Failed to generate speech');
      setIsPlaying(false);
    }
  };

  const executeVoiceCommand = async (transcript: string) => {
    try {
      const result = await voiceApi.processCommand({ text: transcript });
      toast.success(`Command executed: ${result.action}`);
    } catch (error) {
      console.error('Command execution failed:', error);
      toast.error('Failed to execute voice command');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Voice Control</h1>
          <p className="text-muted-foreground">Transcription, text-to-speech, and voice commands</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Voice Settings</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Default Language</Label>
                <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {languages.map(lang => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Default Voice</Label>
                <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {voices.map(voice => (
                      <SelectItem key={voice.id} value={voice.id}>
                        {voice.name} ({voice.language})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <FileAudio className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Transcriptions</p>
                  <p className="text-2xl font-bold">{transcriptions.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
                  <Command className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Commands</p>
                  <p className="text-2xl font-bold">{commands.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
                  <Volume2 className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Voices</p>
                  <p className="text-2xl font-bold">{voices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-orange-100 dark:bg-orange-900 rounded-lg">
                  <Languages className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Languages</p>
                  <p className="text-2xl font-bold">{languages.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Main Content Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transcribe">
            <Mic className="w-4 h-4 mr-2" />
            Transcribe
          </TabsTrigger>
          <TabsTrigger value="tts">
            <Volume2 className="w-4 h-4 mr-2" />
            Text-to-Speech
          </TabsTrigger>
          <TabsTrigger value="commands">
            <Command className="w-4 h-4 mr-2" />
            Commands
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
        </TabsList>

        {/* Transcribe Tab */}
        <TabsContent value="transcribe" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Recording Card */}
            <Card>
              <CardHeader>
                <CardTitle>Record Audio</CardTitle>
                <CardDescription>Click the microphone to start recording</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col items-center py-8">
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={isRecording ? stopRecording : startRecording}
                    className={`w-24 h-24 rounded-full flex items-center justify-center transition-colors ${
                      isRecording
                        ? 'bg-red-500 hover:bg-red-600'
                        : 'bg-primary hover:bg-primary/90'
                    }`}
                  >
                    {isRecording ? (
                      <MicOff className="w-10 h-10 text-white" />
                    ) : (
                      <Mic className="w-10 h-10 text-white" />
                    )}
                  </motion.button>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {isRecording ? 'Click to stop recording' : 'Click to start recording'}
                  </p>
                  {isRecording && (
                    <motion.div
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className="flex items-center gap-2 mt-4 text-red-500"
                    >
                      <Mic className="w-5 h-5" />
                      <span>Recording...</span>
                    </motion.div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Language</Label>
                  <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map(lang => (
                        <SelectItem key={lang.code} value={lang.code}>
                          {lang.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Upload Card */}
            <Card>
              <CardHeader>
                <CardTitle>Upload Audio File</CardTitle>
                <CardDescription>Upload an audio file for transcription</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed rounded-lg p-8 text-center">
                  <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-4" />
                  <p className="text-sm text-muted-foreground mb-4">
                    Drag and drop an audio file, or click to browse
                  </p>
                  <Input
                    type="file"
                    accept="audio/*"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="audio-upload"
                  />
                  <Label htmlFor="audio-upload" className="cursor-pointer">
                    <Button variant="outline" asChild>
                      <span>Choose File</span>
                    </Button>
                  </Label>
                  <p className="text-xs text-muted-foreground mt-4">
                    Supported formats: MP3, WAV, WebM, OGG
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent Transcriptions */}
          {transcriptions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Transcriptions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <AnimatePresence>
                    {transcriptions.slice(0, 5).map((t, index) => (
                      <motion.div
                        key={t.id || index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="p-4 bg-muted rounded-lg"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-medium">{t.text}</p>
                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Badge variant="outline">{t.language}</Badge>
                              <span>Confidence: {(t.confidence * 100).toFixed(1)}%</span>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => executeVoiceCommand(t.text)}
                          >
                            <Command className="w-4 h-4" />
                          </Button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Text-to-Speech Tab */}
        <TabsContent value="tts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Generate Speech</CardTitle>
              <CardDescription>Convert text to natural-sounding speech</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Text to Speak</Label>
                <Textarea
                  placeholder="Enter the text you want to convert to speech..."
                  value={ttsText}
                  onChange={(e) => setTtsText(e.target.value)}
                  rows={4}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>Voice</Label>
                  <Select value={selectedVoice} onValueChange={setSelectedVoice}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {voices.map(voice => (
                        <SelectItem key={voice.id} value={voice.id}>
                          {voice.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Speed: {ttsRate[0].toFixed(1)}x</Label>
                  <Slider
                    value={ttsRate}
                    onValueChange={setTtsRate}
                    min={0.5}
                    max={2}
                    step={0.1}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Pitch: {ttsPitch[0].toFixed(1)}</Label>
                  <Slider
                    value={ttsPitch}
                    onValueChange={setTtsPitch}
                    min={0.5}
                    max={2}
                    step={0.1}
                  />
                </div>
              </div>

              <Button 
                onClick={synthesizeSpeech} 
                disabled={isPlaying || !ttsText.trim()}
                className="w-full"
              >
                {isPlaying ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Playing...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Generate & Play
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Available Voices */}
          <Card>
            <CardHeader>
              <CardTitle>Available Voices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {voices.map(voice => (
                  <div
                    key={voice.id}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedVoice === voice.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedVoice(voice.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{voice.name}</p>
                        <p className="text-sm text-muted-foreground">{voice.language}</p>
                      </div>
                      <Badge variant={voice.premium ? 'default' : 'secondary'}>
                        {voice.premium ? 'Premium' : 'Free'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Commands Tab */}
        <TabsContent value="commands" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice Commands</CardTitle>
              <CardDescription>Available voice commands and their actions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {commands.map((command, index) => (
                  <motion.div
                    key={command.id || index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center justify-between p-4 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium">&ldquo;{command.phrase}&rdquo;</p>
                      <p className="text-sm text-muted-foreground">{command.description}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{command.category}</Badge>
                      {command.enabled ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Voice Annotations</CardTitle>
              <CardDescription>Voice notes and annotations across portals</CardDescription>
            </CardHeader>
            <CardContent>
              {annotations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No voice annotations yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {annotations.map((annotation, index) => (
                    <motion.div
                      key={annotation.id || index}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center justify-between p-4 bg-muted rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{annotation.transcription}</p>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span>{new Date(annotation.createdAt).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {annotation.audioUrl && (
                          <Button variant="ghost" size="sm">
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
