import { Injectable, Logger } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';

export interface SceneObject {
  id: string;
  type: 'mesh' | 'light' | 'camera' | 'text' | 'particle';
  name: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  properties: Record<string, any>;
  children: SceneObject[];
}

export interface ARSceneDefinition {
  id: string;
  version: string;
  root: SceneObject;
  lighting: {
    ambient: { color: string; intensity: number };
    directional: Array<{
      color: string;
      intensity: number;
      direction: [number, number, number];
    }>;
  };
  environment: {
    skybox?: string;
    fog?: { color: string; density: number };
    ground?: { visible: boolean; color: string };
  };
  physics?: {
    gravity: [number, number, number];
    collisions: boolean;
  };
}

@Injectable()
export class ARSceneService {
  private readonly logger = new Logger(ARSceneService.name);

  constructor(private readonly cache: CacheService) {}

  /**
   * Generate AR scene definition for a portal/widget
   */
  async generateSceneDefinition(
    workspaceId: string,
    options: {
      type: 'portal' | 'widget';
      targetId: string;
      visualizationType: string;
      data: any;
    },
  ): Promise<ARSceneDefinition> {
    const sceneId = `scene_${Date.now()}`;

    const root: SceneObject = {
      id: 'root',
      type: 'mesh',
      name: 'Root',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {},
      children: [],
    };

    // Add visualization based on type
    switch (options.visualizationType) {
      case '3d-chart':
        root.children.push(this.createChartObject(options.data));
        break;
      case 'spatial-data':
        root.children.push(this.createSpatialDataObject(options.data));
        break;
      case 'holographic':
        root.children.push(this.createHolographicObject(options.data));
        break;
      default:
        root.children.push(this.createDefaultObject(options.data));
    }

    // Add interactive elements
    root.children.push(this.createInteractionPoints(options.data));

    // Add labels
    root.children.push(this.createLabels(options.data));

    const scene: ARSceneDefinition = {
      id: sceneId,
      version: '1.0',
      root,
      lighting: {
        ambient: { color: '#ffffff', intensity: 0.5 },
        directional: [
          { color: '#ffffff', intensity: 0.8, direction: [1, 1, 1] },
        ],
      },
      environment: {
        ground: { visible: true, color: '#cccccc' },
      },
    };

    // Cache the scene
    await this.cache.set(
      `ar_scene_def:${sceneId}`,
      JSON.stringify(scene),
      3600,
    );

    return scene;
  }

  /**
   * Create a chart visualization object
   */
  private createChartObject(data: any): SceneObject {
    const chartData = data?.series?.[0]?.data || [1, 2, 3, 4, 5];

    return {
      id: 'chart-container',
      type: 'mesh',
      name: 'Chart Container',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {
        geometry: 'group',
      },
      children: chartData.map((value: number, index: number) => ({
        id: `bar-${index}`,
        type: 'mesh',
        name: `Bar ${index + 1}`,
        position: [index * 0.5 - chartData.length * 0.25, value / 20, 0],
        rotation: [0, 0, 0],
        scale: [0.4, value / 10, 0.4],
        properties: {
          geometry: 'box',
          material: {
            color: this.getColorForIndex(index, chartData.length),
            metalness: 0.3,
            roughness: 0.7,
          },
          interactive: true,
          dataValue: value,
        },
        children: [],
      })),
    };
  }

  /**
   * Create spatial data visualization
   */
  private createSpatialDataObject(data: any): SceneObject {
    const points = data?.points || [];

    return {
      id: 'spatial-container',
      type: 'particle',
      name: 'Spatial Data',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {
        particleCount: points.length || 100,
        particleSize: 0.05,
        particleColor: '#4a90d9',
        animation: 'float',
      },
      children: points.map((point: any, index: number) => ({
        id: `point-${index}`,
        type: 'mesh',
        name: `Point ${index}`,
        position: [point.x || 0, point.y || 0, point.z || 0],
        rotation: [0, 0, 0],
        scale: [0.1, 0.1, 0.1],
        properties: {
          geometry: 'sphere',
          material: {
            color: point.color || '#4a90d9',
            emissive: point.color || '#4a90d9',
            emissiveIntensity: 0.5,
          },
        },
        children: [],
      })),
    };
  }

  /**
   * Create holographic visualization
   */
  private createHolographicObject(data: any): SceneObject {
    return {
      id: 'holographic-container',
      type: 'mesh',
      name: 'Holographic Display',
      position: [0, 1, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {
        geometry: 'plane',
        material: {
          color: '#00ffff',
          transparent: true,
          opacity: 0.7,
          wireframe: true,
        },
        shader: 'holographic',
        animation: {
          type: 'rotation',
          axis: 'y',
          speed: 0.5,
        },
      },
      children: [
        {
          id: 'holographic-frame',
          type: 'mesh',
          name: 'Frame',
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1.1, 1.1, 0.01],
          properties: {
            geometry: 'box',
            material: {
              color: '#00ffff',
              emissive: '#00ffff',
              emissiveIntensity: 0.3,
            },
          },
          children: [],
        },
        {
          id: 'holographic-content',
          type: 'text',
          name: 'Content',
          position: [0, 0, 0.05],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          properties: {
            text: data?.title || 'Dashboard',
            fontSize: 0.1,
            color: '#ffffff',
          },
          children: [],
        },
      ],
    };
  }

  /**
   * Create default visualization
   */
  private createDefaultObject(data: any): SceneObject {
    return {
      id: 'default-container',
      type: 'mesh',
      name: 'Default Visualization',
      position: [0, 0.5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {
        geometry: 'box',
        material: {
          color: '#4a90d9',
          metalness: 0.5,
          roughness: 0.5,
        },
      },
      children: [],
    };
  }

  /**
   * Create interaction points for AR gestures
   */
  private createInteractionPoints(data: any): SceneObject {
    return {
      id: 'interaction-points',
      type: 'mesh',
      name: 'Interaction Points',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {},
      children: [
        {
          id: 'rotate-control',
          type: 'mesh',
          name: 'Rotate Control',
          position: [1.5, 0.5, 0],
          rotation: [0, 0, 0],
          scale: [0.2, 0.2, 0.2],
          properties: {
            geometry: 'torus',
            material: { color: '#ff9900', transparent: true, opacity: 0.8 },
            interaction: {
              gesture: 'rotate',
              action: 'rotateVisualization',
            },
          },
          children: [],
        },
        {
          id: 'scale-control',
          type: 'mesh',
          name: 'Scale Control',
          position: [-1.5, 0.5, 0],
          rotation: [0, 0, 0],
          scale: [0.2, 0.2, 0.2],
          properties: {
            geometry: 'sphere',
            material: { color: '#00ff00', transparent: true, opacity: 0.8 },
            interaction: {
              gesture: 'pinch',
              action: 'scaleVisualization',
            },
          },
          children: [],
        },
        {
          id: 'info-button',
          type: 'mesh',
          name: 'Info Button',
          position: [0, 1.5, 0],
          rotation: [0, 0, 0],
          scale: [0.15, 0.15, 0.15],
          properties: {
            geometry: 'sphere',
            material: {
              color: '#0099ff',
              emissive: '#0099ff',
              emissiveIntensity: 0.5,
            },
            interaction: {
              gesture: 'tap',
              action: 'showInfo',
            },
          },
          children: [],
        },
      ],
    };
  }

  /**
   * Create text labels
   */
  private createLabels(data: any): SceneObject {
    const labels = data?.labels || [];
    const title = data?.title || 'Visualization';

    return {
      id: 'labels-container',
      type: 'mesh',
      name: 'Labels',
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      properties: {},
      children: [
        {
          id: 'title-label',
          type: 'text',
          name: 'Title',
          position: [0, 2, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          properties: {
            text: title,
            fontSize: 0.15,
            color: '#ffffff',
            anchorX: 'center',
            anchorY: 'middle',
          },
          children: [],
        },
        ...labels.map((label: string, index: number) => ({
          id: `label-${index}`,
          type: 'text',
          name: `Label ${index}`,
          position: [index * 0.5 - labels.length * 0.25, -0.3, 0],
          rotation: [-Math.PI / 4, 0, 0],
          scale: [1, 1, 1],
          properties: {
            text: label,
            fontSize: 0.08,
            color: '#cccccc',
            anchorX: 'center',
            anchorY: 'top',
          },
          children: [],
        })),
      ],
    };
  }

  /**
   * Get color for chart bar based on index
   */
  private getColorForIndex(index: number, total: number): string {
    const colors = [
      '#4a90d9',
      '#50c878',
      '#ff6b6b',
      '#ffd93d',
      '#6bcb77',
      '#9d65c9',
      '#ff9a3c',
      '#0096c7',
    ];
    return colors[index % colors.length];
  }

  /**
   * Export scene for AR.js / A-Frame
   */
  async exportToAFrame(sceneDefinition: ARSceneDefinition): Promise<string> {
    let html = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://aframe.io/releases/1.4.0/aframe.min.js"></script>
  <script src="https://raw.githack.com/AR-js-org/AR.js/master/aframe/build/aframe-ar.js"></script>
</head>
<body style="margin: 0; overflow: hidden;">
  <a-scene embedded arjs>
`;

    const renderObject = (
      obj: SceneObject,
      indent: string = '    ',
    ): string => {
      let result = '';
      const pos = obj.position.join(' ');
      const rot = obj.rotation.map((r) => (r * 180) / Math.PI).join(' ');
      const scale = obj.scale.join(' ');

      if (obj.type === 'mesh') {
        const geo = obj.properties.geometry || 'box';
        const color = obj.properties.material?.color || '#ffffff';
        result += `${indent}<a-${geo} position="${pos}" rotation="${rot}" scale="${scale}" color="${color}"></a-${geo}>\n`;
      } else if (obj.type === 'text') {
        result += `${indent}<a-text value="${obj.properties.text}" position="${pos}" rotation="${rot}" color="${obj.properties.color}"></a-text>\n`;
      }

      obj.children.forEach((child) => {
        result += renderObject(child, indent + '  ');
      });

      return result;
    };

    html += renderObject(sceneDefinition.root);
    html += `
    <a-entity camera></a-entity>
  </a-scene>
</body>
</html>`;

    return html;
  }

  /**
   * Export scene for Three.js
   */
  async exportToThreeJS(sceneDefinition: ARSceneDefinition): Promise<object> {
    return {
      metadata: {
        version: 4.5,
        type: 'Object',
        generator: 'RealTimePulse AR Exporter',
      },
      geometries: [],
      materials: [],
      object: {
        type: 'Scene',
        name: sceneDefinition.id,
        children: this.convertToThreeJSFormat(sceneDefinition.root),
      },
    };
  }

  private convertToThreeJSFormat(obj: SceneObject): any[] {
    const result: any[] = [];

    const threeObj: any = {
      type:
        obj.type === 'mesh'
          ? 'Mesh'
          : obj.type === 'text'
            ? 'Text'
            : 'Object3D',
      name: obj.name,
      position: obj.position,
      rotation: obj.rotation,
      scale: obj.scale,
      userData: obj.properties,
    };

    if (obj.children.length > 0) {
      threeObj.children = [];
      obj.children.forEach((child) => {
        threeObj.children.push(...this.convertToThreeJSFormat(child));
      });
    }

    result.push(threeObj);
    return result;
  }
}
