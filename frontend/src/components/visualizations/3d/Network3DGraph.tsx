'use client';

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface NetworkNode {
  id: string;
  label?: string;
  value?: number;
  category?: string;
  color?: string;
  x?: number;
  y?: number;
  z?: number;
}

export interface NetworkEdge {
  source: string;
  target: string;
  weight?: number;
  color?: string;
}

export interface Network3DGraphProps {
  nodes: NetworkNode[];
  edges: NetworkEdge[];
  width?: number;
  height?: number;
  nodeSize?: number;
  edgeWidth?: number;
  showLabels?: boolean;
  layoutType?: 'force' | 'random' | 'sphere' | 'grid';
  enableRotation?: boolean;
  onNodeClick?: (node: NetworkNode) => void;
  onNodeHover?: (node: NetworkNode | null) => void;
  backgroundColor?: string;
  className?: string;
}

const categoryColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// Simple force-directed layout
function forceDirectedLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  iterations: number = 50
): Map<string, { x: number; y: number; z: number }> {
  const positions = new Map<string, { x: number; y: number; z: number }>();
  
  // Initialize random positions
  nodes.forEach(node => {
    positions.set(node.id, {
      x: node.x ?? (Math.random() - 0.5) * 2,
      y: node.y ?? (Math.random() - 0.5) * 2,
      z: node.z ?? (Math.random() - 0.5) * 2,
    });
  });

  // Create adjacency lookup
  const adjacency = new Map<string, Set<string>>();
  nodes.forEach(node => adjacency.set(node.id, new Set()));
  edges.forEach(edge => {
    adjacency.get(edge.source)?.add(edge.target);
    adjacency.get(edge.target)?.add(edge.source);
  });

  // Iterate force simulation
  for (let iter = 0; iter < iterations; iter++) {
    const forces = new Map<string, { x: number; y: number; z: number }>();
    nodes.forEach(node => forces.set(node.id, { x: 0, y: 0, z: 0 }));

    // Repulsion between all nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const pos1 = positions.get(nodes[i].id)!;
        const pos2 = positions.get(nodes[j].id)!;
        
        const dx = pos1.x - pos2.x;
        const dy = pos1.y - pos2.y;
        const dz = pos1.z - pos2.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
        
        const force = 0.1 / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        const fz = (dz / dist) * force;
        
        forces.get(nodes[i].id)!.x += fx;
        forces.get(nodes[i].id)!.y += fy;
        forces.get(nodes[i].id)!.z += fz;
        forces.get(nodes[j].id)!.x -= fx;
        forces.get(nodes[j].id)!.y -= fy;
        forces.get(nodes[j].id)!.z -= fz;
      }
    }

    // Attraction along edges
    edges.forEach(edge => {
      const pos1 = positions.get(edge.source);
      const pos2 = positions.get(edge.target);
      if (!pos1 || !pos2) return;
      
      const dx = pos2.x - pos1.x;
      const dy = pos2.y - pos1.y;
      const dz = pos2.z - pos1.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.01;
      
      const force = dist * 0.1;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      const fz = (dz / dist) * force;
      
      forces.get(edge.source)!.x += fx;
      forces.get(edge.source)!.y += fy;
      forces.get(edge.source)!.z += fz;
      forces.get(edge.target)!.x -= fx;
      forces.get(edge.target)!.y -= fy;
      forces.get(edge.target)!.z -= fz;
    });

    // Apply forces with damping
    const damping = 0.8 * (1 - iter / iterations);
    nodes.forEach(node => {
      const pos = positions.get(node.id)!;
      const force = forces.get(node.id)!;
      pos.x += force.x * damping;
      pos.y += force.y * damping;
      pos.z += force.z * damping;
      
      // Keep within bounds
      pos.x = Math.max(-2, Math.min(2, pos.x));
      pos.y = Math.max(-2, Math.min(2, pos.y));
      pos.z = Math.max(-2, Math.min(2, pos.z));
    });
  }

  return positions;
}

// Sphere layout
function sphereLayout(nodes: NetworkNode[]): Map<string, { x: number; y: number; z: number }> {
  const positions = new Map<string, { x: number; y: number; z: number }>();
  const n = nodes.length;
  
  nodes.forEach((node, i) => {
    const phi = Math.acos(-1 + (2 * i) / n);
    const theta = Math.sqrt(n * Math.PI) * phi;
    
    positions.set(node.id, {
      x: Math.cos(theta) * Math.sin(phi),
      y: Math.sin(theta) * Math.sin(phi),
      z: Math.cos(phi),
    });
  });
  
  return positions;
}

// Grid layout
function gridLayout(nodes: NetworkNode[]): Map<string, { x: number; y: number; z: number }> {
  const positions = new Map<string, { x: number; y: number; z: number }>();
  const n = nodes.length;
  const size = Math.ceil(Math.cbrt(n));
  
  nodes.forEach((node, i) => {
    const x = (i % size) / (size - 1 || 1) * 2 - 1;
    const y = (Math.floor(i / size) % size) / (size - 1 || 1) * 2 - 1;
    const z = (Math.floor(i / (size * size))) / (size - 1 || 1) * 2 - 1;
    
    positions.set(node.id, { x, y, z });
  });
  
  return positions;
}

export function Network3DGraph({
  nodes,
  edges,
  width = 600,
  height = 400,
  nodeSize = 0.08,
  edgeWidth = 0.01,
  showLabels = false,
  layoutType = 'force',
  enableRotation = true,
  onNodeClick,
  onNodeHover,
  backgroundColor = '#0f172a',
  className = '',
}: Network3DGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const nodeMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [hoveredNode, setHoveredNode] = useState<NetworkNode | null>(null);

  // Calculate node positions based on layout
  const nodePositions = useMemo(() => {
    switch (layoutType) {
      case 'sphere':
        return sphereLayout(nodes);
      case 'grid':
        return gridLayout(nodes);
      case 'random':
        const random = new Map<string, { x: number; y: number; z: number }>();
        nodes.forEach(node => {
          random.set(node.id, {
            x: node.x ?? (Math.random() - 0.5) * 2,
            y: node.y ?? (Math.random() - 0.5) * 2,
            z: node.z ?? (Math.random() - 0.5) * 2,
          });
        });
        return random;
      case 'force':
      default:
        return forceDirectedLayout(nodes, edges);
    }
  }, [nodes, edges, layoutType]);

  // Get node color
  const getNodeColor = useCallback((node: NetworkNode, index: number) => {
    if (node.color) return new THREE.Color(node.color);
    
    if (node.category) {
      const categories = [...new Set(nodes.map(n => n.category))];
      const categoryIndex = categories.indexOf(node.category);
      return new THREE.Color(categoryColors[categoryIndex % categoryColors.length]);
    }
    
    return new THREE.Color(categoryColors[index % categoryColors.length]);
  }, [nodes]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(2.5, 2, 2.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = enableRotation;
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [width, height, backgroundColor, enableRotation]);

  // Update nodes and edges
  useEffect(() => {
    if (!sceneRef.current) return;

    // Clear existing
    nodeMeshesRef.current.forEach(mesh => sceneRef.current?.remove(mesh));
    nodeMeshesRef.current = [];

    // Remove edges (line objects)
    const toRemove: THREE.Object3D[] = [];
    sceneRef.current.traverse(obj => {
      if (obj instanceof THREE.Line || (obj as any).isEdge) {
        toRemove.push(obj);
      }
    });
    toRemove.forEach(obj => sceneRef.current?.remove(obj));

    // Create edges
    edges.forEach(edge => {
      const sourcePos = nodePositions.get(edge.source);
      const targetPos = nodePositions.get(edge.target);
      if (!sourcePos || !targetPos) return;

      const points = [
        new THREE.Vector3(sourcePos.x, sourcePos.y, sourcePos.z),
        new THREE.Vector3(targetPos.x, targetPos.y, targetPos.z),
      ];

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const material = new THREE.LineBasicMaterial({
        color: edge.color ? new THREE.Color(edge.color) : 0x666666,
        opacity: 0.6,
        transparent: true,
      });

      const line = new THREE.Line(geometry, material);
      (line as any).isEdge = true;
      sceneRef.current?.add(line);
    });

    // Create nodes
    const nodeGeometry = new THREE.SphereGeometry(nodeSize, 16, 16);

    nodes.forEach((node, index) => {
      const pos = nodePositions.get(node.id);
      if (!pos) return;

      const size = node.value ? nodeSize * (0.5 + node.value * 0.5) : nodeSize;
      const geometry = node.value ? new THREE.SphereGeometry(size, 16, 16) : nodeGeometry;

      const material = new THREE.MeshPhongMaterial({
        color: getNodeColor(node, index),
        shininess: 50,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { node };

      sceneRef.current?.add(mesh);
      nodeMeshesRef.current.push(mesh);
    });
  }, [nodes, edges, nodePositions, nodeSize, getNodeColor]);

  // Handle mouse events
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(nodeMeshesRef.current);

    if (intersects.length > 0) {
      const node = intersects[0].object.userData.node;
      if (hoveredNode?.id !== node.id) {
        setHoveredNode(node);
        onNodeHover?.(node);
      }
    } else if (hoveredNode !== null) {
      setHoveredNode(null);
      onNodeHover?.(null);
    }
  }, [width, height, hoveredNode, onNodeHover]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(nodeMeshesRef.current);

    if (intersects.length > 0) {
      onNodeClick?.(intersects[0].object.userData.node);
    }
  }, [width, height, onNodeClick]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width, height }}
      onMouseMove={handleMouseMove}
      onClick={handleClick}
    />
  );
}

export default Network3DGraph;
