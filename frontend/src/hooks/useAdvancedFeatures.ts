/**
 * React Hooks for Advanced Features
 * 
 * Custom hooks for using the 10 advanced features in React components
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  collaborationAPI,
  scriptingAPI,
  pipelineAPI,
  roleManagementAPI,
  federatedSearchAPI,
  mlMarketplaceAPI,
  voiceAPI,
  blockchainAPI,
  arVisualizationAPI,
  apiMarketplaceAPI,
} from '../lib/advanced-features-api';
import {
  CollaborationSession,
  CollaborationParticipant,
  CollaborationOperation,
  UserScript,
  Role,
  RoleTemplate,
  SearchResult,
  SearchResponse,
  SearchSource,
  SearchOptions,
  MLModel,
  MLTrainingConfig,
  Voice,
  VoiceCommand,
  VoiceResult,
  IntegrityResult,
  AuditEntry,
  ARScene,
  APIConnector,
  InstalledConnector,
  CustomEndpoint,
  EndpointCategory,
} from './useAdvancedFeatures.types';
import { Pipeline, ARSceneInput, EndpointCreationInput } from '../lib/advanced-features-api';

// ==================== Collaboration Hooks ====================
export function useCollaboration(portalId: string) {
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [participants, setParticipants] = useState<CollaborationParticipant[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const joinSession = useCallback(async () => {
    try {
      const newSession = await collaborationAPI.createSession(portalId);
      setSession(newSession as CollaborationSession);
      
      // Connect to WebSocket for real-time updates
      const wsUrl = `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000'}/collaboration`;
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        setIsConnected(true);
        wsRef.current?.send(JSON.stringify({
          event: 'join_session',
          data: { sessionId: (newSession as CollaborationSession).id, portalId },
        }));
      };
      
      wsRef.current.onmessage = (event) => {
        const message = JSON.parse(event.data) as { event: string; data: { participants: CollaborationParticipant[] } };
        if (message.event === 'participant_update') {
          setParticipants(message.data.participants);
        }
      };
      
      wsRef.current.onclose = () => {
        setIsConnected(false);
      };
      
      return newSession;
    } catch (error) {
      console.error('Failed to join collaboration session:', error);
      throw error;
    }
  }, [portalId]);

  const leaveSession = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setSession(null);
    setIsConnected(false);
  }, []);

  const sendOperation = useCallback((operation: CollaborationOperation) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        event: 'operation',
        data: { sessionId: session?.id, operation },
      }));
    }
  }, [session, isConnected]);

  const updateCursor = useCallback((position: { x: number; y: number }) => {
    if (wsRef.current && isConnected) {
      wsRef.current.send(JSON.stringify({
        event: 'cursor_move',
        data: { sessionId: session?.id, position },
      }));
    }
  }, [session, isConnected]);

  useEffect(() => {
    return () => {
      leaveSession();
    };
  }, [leaveSession]);

  return {
    session,
    participants,
    isConnected,
    joinSession,
    leaveSession,
    sendOperation,
    updateCursor,
  };
}

// ==================== Scripting Hooks ====================
export function useScripts() {
  const [scripts, setScripts] = useState<UserScript[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchScripts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await scriptingAPI.listScripts();
      setScripts(data as UserScript[]);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createScript = useCallback(async (scriptData: UserScript) => {
    const newScript = await scriptingAPI.createScript(scriptData);
    setScripts((prev) => [...prev, newScript as UserScript]);
    return newScript;
  }, []);

  const validateScript = useCallback(async (code: string) => {
    return scriptingAPI.validateScript(code);
  }, []);

  useEffect(() => {
    fetchScripts();
  }, [fetchScripts]);

  return {
    scripts,
    loading,
    error,
    fetchScripts,
    createScript,
    validateScript,
  };
}

// ==================== Pipeline Hooks ====================
export function usePipelines() {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await pipelineAPI.listPipelines();
      setPipelines(data as Pipeline[]);
      setError(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  const createPipeline = useCallback(async (pipelineData: Partial<Pipeline>) => {
    const newPipeline = await pipelineAPI.createPipeline(pipelineData);
    setPipelines((prev) => [...prev, newPipeline as Pipeline]);
    return newPipeline;
  }, []);

  const executePipeline = useCallback(async (pipelineId: string, inputData?: unknown) => {
    return pipelineAPI.executePipeline(pipelineId, inputData);
  }, []);

  useEffect(() => {
    fetchPipelines();
  }, [fetchPipelines]);

  return {
    pipelines,
    loading,
    error,
    fetchPipelines,
    createPipeline,
    executePipeline,
  };
}

// ==================== Role Management Hooks ====================
export function useRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const [rolesData, templatesData] = await Promise.all([
        roleManagementAPI.listRoles(),
        roleManagementAPI.getTemplates(),
      ]);
      setRoles(rolesData as Role[]);
      setTemplates(templatesData as RoleTemplate[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createRole = useCallback(async (roleData: Partial<Role>) => {
    const newRole = await roleManagementAPI.createRole(roleData as Partial<Role>);
    setRoles((prev) => [...prev, newRole as Role]);
    return newRole;
  }, []);

  const checkPermission = useCallback(
    async (resourceType: string, resourceId: string, action: string) => {
      return roleManagementAPI.checkPermission(resourceType, resourceId, action);
    },
    []
  );

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  return {
    roles,
    templates,
    loading,
    fetchRoles,
    createRole,
    checkPermission,
  };
}

// ==================== Federated Search Hooks ====================
export function useFederatedSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<SearchSource[]>([]);

  const search = useCallback(async (query: string, options?: SearchOptions) => {
    setLoading(true);
    try {
      const data = await federatedSearchAPI.search(query, options);
      const response = data as SearchResponse;
      setResults(response.results);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const semanticSearch = useCallback(async (query: string, options?: SearchOptions) => {
    setLoading(true);
    try {
      const data = await federatedSearchAPI.semanticSearch(query, options);
      const response = data as SearchResponse;
      setResults(response.results);
      return data;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSources = useCallback(async () => {
    const data = await federatedSearchAPI.getSources();
    setSources(data as SearchSource[]);
  }, []);

  useEffect(() => {
    fetchSources();
  }, [fetchSources]);

  return {
    results,
    loading,
    sources,
    search,
    semanticSearch,
  };
}

// ==================== ML Marketplace Hooks ====================
export function useMLModels() {
  const [models, setModels] = useState<MLModel[]>([]);
  const [marketplace, setMarketplace] = useState<MLModel[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchModels = useCallback(async () => {
    setLoading(true);
    try {
      const data = await mlMarketplaceAPI.listModels();
      setModels(data as MLModel[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMarketplace = useCallback(async (filters?: Record<string, unknown>) => {
    const data = await mlMarketplaceAPI.browseMarketplace(filters);
    setMarketplace(data as MLModel[]);
  }, []);

  const predict = useCallback(async (modelId: string, data: unknown) => {
    return mlMarketplaceAPI.predict(modelId, data);
  }, []);

  const trainModel = useCallback(async (modelId: string, trainingData: unknown, config?: MLTrainingConfig) => {
    return mlMarketplaceAPI.trainModel(modelId, trainingData, config);
  }, []);

  useEffect(() => {
    fetchModels();
    fetchMarketplace();
  }, [fetchModels, fetchMarketplace]);

  return {
    models,
    marketplace,
    loading,
    fetchModels,
    fetchMarketplace,
    predict,
    trainModel,
  };
}

// ==================== Voice Hooks ====================
export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [voices, setVoices] = useState<Voice[]>([]);
  const [commands, setCommands] = useState<VoiceCommand[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startListening = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      chunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const audioFile = new File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        
        try {
          const result = await voiceAPI.transcribe(audioFile);
          const voiceResult = result as VoiceResult;
          setTranscript(voiceResult.transcript || '');
          
          // Process as command
          const commandResult = await voiceAPI.processCommand(voiceResult.transcript || '');
          return commandResult;
        } catch (error) {
          console.error('Transcription failed:', error);
        }
      };

      mediaRecorderRef.current.start();
      setIsListening(true);
    } catch (error) {
      console.error('Failed to start recording:', error);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && isListening) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      setIsListening(false);
    }
  }, [isListening]);

  const speak = useCallback(async (text: string, options?: Record<string, unknown>) => {
    const result = await voiceAPI.synthesize(text, options);
    const voiceResult = result as VoiceResult;
    if (voiceResult.audioUrl) {
      const audio = new Audio(voiceResult.audioUrl);
      await audio.play();
    }
    return result;
  }, []);

  const fetchVoicesAndCommands = useCallback(async () => {
    const [voicesData, commandsData] = await Promise.all([
      voiceAPI.getVoices(),
      voiceAPI.getCommands(),
    ]);
    return { voices: voicesData as Voice[], commands: commandsData as VoiceCommand[] };
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const data = await fetchVoicesAndCommands();
      if (!mounted) return;
      setVoices(data.voices);
      setCommands(data.commands);
    })();
    return () => {
      mounted = false;
    };
  }, [fetchVoicesAndCommands]);

  return {
    isListening,
    transcript,
    voices,
    commands,
    startListening,
    stopListening,
    speak,
  };
}

// ==================== Blockchain Hooks ====================
export function useBlockchain() {
  const [integrity, setIntegrity] = useState<IntegrityResult | null>(null);
  const [loading, setLoading] = useState(false);

  const verifyIntegrity = useCallback(async () => {
    setLoading(true);
    try {
      const result = await blockchainAPI.verifyIntegrity();
      setIntegrity(result as IntegrityResult);
      return result;
    } finally {
      setLoading(false);
    }
  }, []);

  const createAuditEntry = useCallback(async (data: AuditEntry) => {
    // Ensure data field exists for blockchain audit input
    const input = { ...data, data: data.data || {} };
    return blockchainAPI.createAuditEntry(input);
  }, []);

  const getAuditTrail = useCallback(async (entityType: string, entityId: string) => {
    return blockchainAPI.getAuditTrail(entityType, entityId);
  }, []);

  const generateReport = useCallback(async (options?: Record<string, unknown>) => {
    return blockchainAPI.generateComplianceReport(options);
  }, []);

  return {
    integrity,
    loading,
    verifyIntegrity,
    createAuditEntry,
    getAuditTrail,
    generateReport,
  };
}

// ==================== AR Visualization Hooks ====================
export function useARVisualization() {
  const [scenes, setScenes] = useState<ARScene[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchScenes = useCallback(async () => {
    setLoading(true);
    try {
      const data = await arVisualizationAPI.getScenes();
      setScenes(data as ARScene[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createScene = useCallback(async (sceneData: ARSceneInput) => {
    const newScene = await arVisualizationAPI.createScene(sceneData);
    setScenes((prev) => [...prev, newScene as ARScene]);
    return newScene;
  }, []);

  const convertTo3D = useCallback(async (widgetType: string, widgetData: unknown) => {
    return arVisualizationAPI.convertTo3D(widgetType, widgetData);
  }, []);

  const getQRCode = useCallback(async (sceneId: string) => {
    return arVisualizationAPI.getQRCode(sceneId);
  }, []);

  useEffect(() => {
    fetchScenes();
  }, [fetchScenes]);

  return {
    scenes,
    loading,
    fetchScenes,
    createScene,
    convertTo3D,
    getQRCode,
  };
}

// ==================== API Marketplace Hooks ====================
export function useAPIMarketplace() {
  const [connectors, setConnectors] = useState<APIConnector[]>([]);
  const [installedConnectors, setInstalledConnectors] = useState<InstalledConnector[]>([]);
  const [endpoints, setEndpoints] = useState<CustomEndpoint[]>([]);
  const [categories, setCategories] = useState<EndpointCategory[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchConnectors = useCallback(async (filters?: Record<string, unknown>) => {
    setLoading(true);
    try {
      const [connectorsData, categoriesData] = await Promise.all([
        apiMarketplaceAPI.getConnectors(filters),
        apiMarketplaceAPI.getCategories(),
      ]);
      setConnectors(connectorsData as APIConnector[]);
      setCategories(categoriesData as EndpointCategory[]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInstalled = useCallback(async () => {
    const data = await apiMarketplaceAPI.getInstalledConnectors();
    setInstalledConnectors(data as InstalledConnector[]);
  }, []);

  const fetchEndpoints = useCallback(async () => {
    const data = await apiMarketplaceAPI.getEndpoints();
    setEndpoints(data as CustomEndpoint[]);
  }, []);

  const installConnector = useCallback(
    async (connectorId: string, config: Record<string, unknown>, credentials?: Record<string, unknown>) => {
      const installed = await apiMarketplaceAPI.installConnector(connectorId, config, credentials);
      setInstalledConnectors((prev) => [...prev, installed as InstalledConnector]);
      return installed;
    },
    []
  );

  const createEndpoint = useCallback(async (endpointData: EndpointCreationInput) => {
    const newEndpoint = await apiMarketplaceAPI.createEndpoint(endpointData);
    setEndpoints((prev) => [...prev, newEndpoint as CustomEndpoint]);
    return newEndpoint;
  }, []);

  useEffect(() => {
    fetchConnectors();
    fetchInstalled();
    fetchEndpoints();
  }, [fetchConnectors, fetchInstalled, fetchEndpoints]);

  return {
    connectors,
    installedConnectors,
    endpoints,
    categories,
    loading,
    fetchConnectors,
    fetchInstalled,
    fetchEndpoints,
    installConnector,
    createEndpoint,
  };
}
