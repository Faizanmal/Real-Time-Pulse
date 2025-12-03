import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import * as QRCode from 'qrcode';

export interface ARScene {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  type: 'portal' | 'widget' | 'custom';
  targetId?: string;
  config: ARSceneConfig;
  qrCode?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ARSceneConfig {
  visualizationType: '3d-chart' | 'spatial-data' | 'holographic' | 'overlay';
  dimensions: { width: number; height: number; depth: number };
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
  animations: ARAnimation[];
  interactions: ARInteraction[];
  dataBinding?: DataBinding;
}

export interface ARAnimation {
  id: string;
  type: 'rotation' | 'pulse' | 'float' | 'morph';
  duration: number;
  repeat: boolean;
  config: Record<string, any>;
}

export interface ARInteraction {
  id: string;
  gesture: 'tap' | 'pinch' | 'swipe' | 'hold' | 'rotate';
  action: string;
  params?: Record<string, any>;
}

export interface DataBinding {
  sourceType: 'widget' | 'api' | 'realtime';
  sourceId: string;
  refreshInterval: number;
  mapping: Record<string, string>;
}

export interface ARMarker {
  id: string;
  workspaceId: string;
  sceneId: string;
  type: 'qr' | 'image' | 'location';
  data: string;
  location?: { lat: number; lng: number; radius: number };
  createdAt: Date;
}

@Injectable()
export class ARVisualizationService {
  private readonly logger = new Logger(ARVisualizationService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * Create a new AR scene
   */
  async createScene(
    workspaceId: string,
    data: {
      name: string;
      description?: string;
      type: ARScene['type'];
      targetId?: string;
      config: Partial<ARSceneConfig>;
    },
  ): Promise<ARScene> {
    const sceneId = `ar_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const defaultConfig: ARSceneConfig = {
      visualizationType: '3d-chart',
      dimensions: { width: 1, height: 1, depth: 1 },
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: 1,
      animations: [],
      interactions: [],
    };

    const scene: ARScene = {
      id: sceneId,
      workspaceId,
      name: data.name,
      description: data.description,
      type: data.type,
      targetId: data.targetId,
      config: { ...defaultConfig, ...data.config },
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Generate QR code for scene
    scene.qrCode = await this.generateQRCode(sceneId);

    // Save scene
    const key = `ar_scenes:${workspaceId}`;
    const scenesJson = await this.cache.get(key);
    const scenes: ARScene[] = scenesJson ? JSON.parse(scenesJson) : [];
    scenes.push(scene);

    await this.cache.set(key, JSON.stringify(scenes), 86400 * 365);

    return scene;
  }

  /**
   * Get all scenes for workspace
   */
  async getScenes(workspaceId: string): Promise<ARScene[]> {
    const key = `ar_scenes:${workspaceId}`;
    const scenesJson = await this.cache.get(key);
    return scenesJson ? JSON.parse(scenesJson) : [];
  }

  /**
   * Get scene by ID
   */
  async getScene(workspaceId: string, sceneId: string): Promise<ARScene | null> {
    const scenes = await this.getScenes(workspaceId);
    return scenes.find((s) => s.id === sceneId) || null;
  }

  /**
   * Update scene
   */
  async updateScene(
    workspaceId: string,
    sceneId: string,
    updates: Partial<Omit<ARScene, 'id' | 'workspaceId' | 'createdAt'>>,
  ): Promise<ARScene | null> {
    const key = `ar_scenes:${workspaceId}`;
    const scenesJson = await this.cache.get(key);
    const scenes: ARScene[] = scenesJson ? JSON.parse(scenesJson) : [];

    const index = scenes.findIndex((s) => s.id === sceneId);
    if (index === -1) return null;

    scenes[index] = {
      ...scenes[index],
      ...updates,
      updatedAt: new Date(),
    };

    await this.cache.set(key, JSON.stringify(scenes), 86400 * 365);

    return scenes[index];
  }

  /**
   * Delete scene
   */
  async deleteScene(workspaceId: string, sceneId: string): Promise<void> {
    const key = `ar_scenes:${workspaceId}`;
    const scenesJson = await this.cache.get(key);
    const scenes: ARScene[] = scenesJson ? JSON.parse(scenesJson) : [];

    const filtered = scenes.filter((s) => s.id !== sceneId);
    await this.cache.set(key, JSON.stringify(filtered), 86400 * 365);

    // Also delete associated markers
    const markerKey = `ar_markers:${workspaceId}`;
    const markersJson = await this.cache.get(markerKey);
    if (markersJson) {
      const markers: ARMarker[] = JSON.parse(markersJson);
      const filteredMarkers = markers.filter((m) => m.sceneId !== sceneId);
      await this.cache.set(markerKey, JSON.stringify(filteredMarkers), 86400 * 365);
    }
  }

  /**
   * Generate QR code for AR scene
   */
  async generateQRCode(sceneId: string, baseUrl?: string): Promise<string> {
    const url = `${baseUrl || 'https://app.realtimepulse.io'}/ar/${sceneId}`;
    return QRCode.toDataURL(url, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
  }

  /**
   * Create AR marker for scene
   */
  async createMarker(
    workspaceId: string,
    sceneId: string,
    data: {
      type: ARMarker['type'];
      location?: { lat: number; lng: number; radius: number };
    },
  ): Promise<ARMarker> {
    const marker: ARMarker = {
      id: `marker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      workspaceId,
      sceneId,
      type: data.type,
      data:
        data.type === 'qr'
          ? await this.generateQRCode(sceneId)
          : data.type === 'location'
            ? JSON.stringify(data.location)
            : sceneId,
      location: data.location,
      createdAt: new Date(),
    };

    const key = `ar_markers:${workspaceId}`;
    const markersJson = await this.cache.get(key);
    const markers: ARMarker[] = markersJson ? JSON.parse(markersJson) : [];
    markers.push(marker);

    await this.cache.set(key, JSON.stringify(markers), 86400 * 365);

    return marker;
  }

  /**
   * Get markers for scene
   */
  async getMarkers(workspaceId: string, sceneId?: string): Promise<ARMarker[]> {
    const key = `ar_markers:${workspaceId}`;
    const markersJson = await this.cache.get(key);
    const markers: ARMarker[] = markersJson ? JSON.parse(markersJson) : [];

    if (sceneId) {
      return markers.filter((m) => m.sceneId === sceneId);
    }
    return markers;
  }

  /**
   * Convert widget data to 3D visualization format
   */
  convertToAR3D(
    widgetType: string,
    widgetData: any,
  ): {
    vertices: number[];
    indices: number[];
    colors: number[];
    metadata: Record<string, any>;
  } {
    switch (widgetType) {
      case 'bar':
        return this.convertBarChartTo3D(widgetData);
      case 'line':
        return this.convertLineChartTo3D(widgetData);
      case 'pie':
        return this.convertPieChartTo3D(widgetData);
      case 'scatter':
        return this.convertScatterTo3D(widgetData);
      default:
        return this.convertGenericTo3D(widgetData);
    }
  }

  private convertBarChartTo3D(data: any): any {
    const series = data.series?.[0]?.data || [];
    const labels = data.labels || [];
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    series.forEach((value: number, i: number) => {
      const x = i * 1.5;
      const height = value / Math.max(...series);
      const width = 1;
      const depth = 1;

      // Add cube vertices
      const baseIndex = vertices.length / 3;

      // Front face
      vertices.push(x, 0, 0, x + width, 0, 0, x + width, height, 0, x, height, 0);
      // Back face
      vertices.push(x, 0, depth, x + width, 0, depth, x + width, height, depth, x, height, depth);

      // Generate color based on value
      const hue = (1 - value / Math.max(...series)) * 0.7;
      const [r, g, b] = this.hslToRgb(hue, 0.8, 0.5);

      for (let j = 0; j < 8; j++) {
        colors.push(r, g, b, 1);
      }

      // Add indices for faces
      const faces = [
        [0, 1, 2, 2, 3, 0], // Front
        [4, 5, 6, 6, 7, 4], // Back
        [0, 4, 7, 7, 3, 0], // Left
        [1, 5, 6, 6, 2, 1], // Right
        [3, 2, 6, 6, 7, 3], // Top
        [0, 1, 5, 5, 4, 0], // Bottom
      ];

      faces.forEach((face) => {
        face.forEach((idx) => indices.push(baseIndex + idx));
      });
    });

    return {
      vertices,
      indices,
      colors,
      metadata: { type: 'bar3d', labels, values: series },
    };
  }

  private convertLineChartTo3D(data: any): any {
    const series = data.series?.[0]?.data || [];
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    series.forEach((value: number, i: number) => {
      const x = i * 0.5;
      const y = value / Math.max(...series);
      vertices.push(x, y, 0);
      colors.push(0.2, 0.6, 1, 1);

      if (i > 0) {
        indices.push(i - 1, i);
      }
    });

    // Add ribbon effect
    series.forEach((value: number, i: number) => {
      const x = i * 0.5;
      const y = value / Math.max(...series);
      vertices.push(x, y, 0.1);
      colors.push(0.1, 0.4, 0.8, 1);
    });

    return {
      vertices,
      indices,
      colors,
      metadata: { type: 'line3d', values: series },
    };
  }

  private convertPieChartTo3D(data: any): any {
    const values = data.series?.[0]?.data || [];
    const total = values.reduce((a: number, b: number) => a + b, 0);
    const vertices: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];

    let startAngle = 0;
    const segments = 32;
    const height = 0.3;

    values.forEach((value: number, i: number) => {
      const angle = (value / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const baseIndex = vertices.length / 3;

      const hue = i / values.length;
      const [r, g, b] = this.hslToRgb(hue, 0.7, 0.5);

      // Create wedge
      for (let s = 0; s <= segments; s++) {
        const a = startAngle + (s / segments) * angle;
        const x = Math.cos(a);
        const z = Math.sin(a);

        // Bottom
        vertices.push(x, 0, z);
        colors.push(r, g, b, 1);

        // Top
        vertices.push(x, height, z);
        colors.push(r * 1.2, g * 1.2, b * 1.2, 1);
      }

      // Center vertices
      vertices.push(0, 0, 0, 0, height, 0);
      colors.push(r, g, b, 1, r * 1.2, g * 1.2, b * 1.2, 1);

      startAngle = endAngle;
    });

    return {
      vertices,
      indices,
      colors,
      metadata: { type: 'pie3d', values },
    };
  }

  private convertScatterTo3D(data: any): any {
    const points = data.points || [];
    const vertices: number[] = [];
    const colors: number[] = [];

    points.forEach((point: { x: number; y: number; z?: number; value?: number }) => {
      vertices.push(point.x, point.y, point.z || 0);
      const intensity = (point.value || 0.5) / 1;
      colors.push(intensity, 0.5, 1 - intensity, 1);
    });

    return {
      vertices,
      indices: [],
      colors,
      metadata: { type: 'scatter3d', pointCount: points.length },
    };
  }

  private convertGenericTo3D(data: any): any {
    return {
      vertices: [],
      indices: [],
      colors: [],
      metadata: { type: 'generic', data },
    };
  }

  private hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return [r, g, b];
  }
}
