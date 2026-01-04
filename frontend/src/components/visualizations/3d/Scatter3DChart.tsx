'use client';

import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface ScatterPoint3D {
  x: number;
  y: number;
  z: number;
  label?: string;
  value?: number;
  category?: string;
  color?: string;
}

export interface Scatter3DChartProps {
  data: ScatterPoint3D[];
  width?: number;
  height?: number;
  pointSize?: number;
  colorScale?: 'category' | 'value' | 'gradient';
  axisLabels?: { x: string; y: string; z: string };
  showGrid?: boolean;
  showAxes?: boolean;
  enableRotation?: boolean;
  onPointClick?: (point: ScatterPoint3D, index: number) => void;
  onPointHover?: (point: ScatterPoint3D | null, index: number | null) => void;
  backgroundColor?: string;
  className?: string;
}

const categoryColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export function Scatter3DChart({
  data,
  width = 600,
  height = 400,
  pointSize = 0.1,
  colorScale = 'category',
  axisLabels = { x: 'X', y: 'Y', z: 'Z' },
  showGrid = true,
  showAxes = true,
  enableRotation = true,
  onPointClick,
  onPointHover,
  backgroundColor = '#0f172a',
  className = '',
}: Scatter3DChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const pointsRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Calculate data bounds
  const bounds = useMemo(() => {
    if (data.length === 0) return { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } };
    
    const xs = data.map(d => d.x);
    const ys = data.map(d => d.y);
    const zs = data.map(d => d.z);
    
    return {
      min: { x: Math.min(...xs), y: Math.min(...ys), z: Math.min(...zs) },
      max: { x: Math.max(...xs), y: Math.max(...ys), z: Math.max(...zs) },
    };
  }, [data]);

  // Normalize point position to -1 to 1 range
  const normalizePosition = useCallback((point: ScatterPoint3D) => {
    const range = {
      x: bounds.max.x - bounds.min.x || 1,
      y: bounds.max.y - bounds.min.y || 1,
      z: bounds.max.z - bounds.min.z || 1,
    };
    
    return {
      x: ((point.x - bounds.min.x) / range.x) * 2 - 1,
      y: ((point.y - bounds.min.y) / range.y) * 2 - 1,
      z: ((point.z - bounds.min.z) / range.z) * 2 - 1,
    };
  }, [bounds]);

  // Get color for a point
  const getPointColor = useCallback((point: ScatterPoint3D, index: number) => {
    if (point.color) return new THREE.Color(point.color);
    
    if (colorScale === 'category' && point.category) {
      const categoryIndex = Array.from(new Set(data.map(d => d.category))).indexOf(point.category);
      return new THREE.Color(categoryColors[categoryIndex % categoryColors.length]);
    }
    
    if (colorScale === 'value' && point.value !== undefined) {
      const values = data.map(d => d.value || 0);
      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const normalized = (point.value - minVal) / (maxVal - minVal || 1);
      return new THREE.Color().setHSL(0.6 - normalized * 0.6, 0.8, 0.5);
    }
    
    if (colorScale === 'gradient') {
      const normalized = index / (data.length - 1 || 1);
      return new THREE.Color().setHSL(normalized * 0.8, 0.7, 0.5);
    }
    
    return new THREE.Color(categoryColors[index % categoryColors.length]);
  }, [data, colorScale]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(2, 2, 2);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = enableRotation;
    controls.autoRotateSpeed = 1;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    // Grid
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(2, 10, 0x444444, 0x333333);
      gridHelper.position.y = -1;
      scene.add(gridHelper);
    }

    // Axes
    if (showAxes) {
      const axesHelper = new THREE.AxesHelper(1.5);
      scene.add(axesHelper);

      // Axis labels would require HTML overlays or sprite text
    }

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Cleanup
    return () => {
      renderer.dispose();
      containerRef.current?.removeChild(renderer.domElement);
    };
  }, [width, height, backgroundColor, showGrid, showAxes, enableRotation]);

  // Update points when data changes
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing points
    pointsRef.current.forEach(mesh => sceneRef.current?.remove(mesh));
    pointsRef.current = [];

    // Create new points
    const geometry = new THREE.SphereGeometry(pointSize, 16, 16);

    data.forEach((point, index) => {
      const material = new THREE.MeshPhongMaterial({
        color: getPointColor(point, index),
        shininess: 50,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const pos = normalizePosition(point);
      mesh.position.set(pos.x, pos.y, pos.z);
      mesh.userData = { point, index };

      sceneRef.current?.add(mesh);
      pointsRef.current.push(mesh);
    });
  }, [data, pointSize, getPointColor, normalizePosition]);

  // Handle mouse events
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !sceneRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(pointsRef.current);

    if (intersects.length > 0) {
      const { point, index } = intersects[0].object.userData;
      if (hoveredIndex !== index) {
        setHoveredIndex(index);
        onPointHover?.(point, index);
      }
    } else if (hoveredIndex !== null) {
      setHoveredIndex(null);
      onPointHover?.(null, null);
    }
  }, [width, height, hoveredIndex, onPointHover]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(pointsRef.current);

    if (intersects.length > 0) {
      const { point, index } = intersects[0].object.userData;
      onPointClick?.(point, index);
    }
  }, [width, height, onPointClick]);

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

export default Scatter3DChart;
