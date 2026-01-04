'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface Bar3DData {
  x: string;
  z: string;
  value: number;
  color?: string;
}

export interface Bar3DChartProps {
  data: Bar3DData[];
  width?: number;
  height?: number;
  barWidth?: number;
  barDepth?: number;
  maxHeight?: number;
  colorMode?: 'value' | 'category' | 'solid';
  solidColor?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  enableRotation?: boolean;
  onBarClick?: (bar: Bar3DData) => void;
  backgroundColor?: string;
  className?: string;
}

const categoryColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export function Bar3DChart({
  data,
  width = 600,
  height = 400,
  barWidth = 0.3,
  barDepth = 0.3,
  maxHeight = 1.5,
  colorMode = 'value',
  solidColor = '#3b82f6',
  showGrid = true,
  showLabels = true,
  enableRotation = true,
  onBarClick,
  backgroundColor = '#0f172a',
  className = '',
}: Bar3DChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const barsRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Process data
  const processedData = useMemo(() => {
    const xLabels = [...new Set(data.map(d => d.x))];
    const zLabels = [...new Set(data.map(d => d.z))];
    const maxValue = Math.max(...data.map(d => d.value), 1);

    return {
      xLabels,
      zLabels,
      maxValue,
      bars: data.map(bar => ({
        ...bar,
        xIndex: xLabels.indexOf(bar.x),
        zIndex: zLabels.indexOf(bar.z),
        normalizedHeight: (bar.value / maxValue) * maxHeight,
      })),
    };
  }, [data, maxHeight]);

  // Get bar color
  const getBarColor = useCallback((bar: Bar3DData, index: number) => {
    if (bar.color) return new THREE.Color(bar.color);

    if (colorMode === 'solid') {
      return new THREE.Color(solidColor);
    }

    if (colorMode === 'value') {
      const normalized = bar.value / processedData.maxValue;
      return new THREE.Color().setHSL(0.6 - normalized * 0.5, 0.7, 0.5);
    }

    // Category mode - use x label as category
    const categoryIndex = processedData.xLabels.indexOf(bar.x);
    return new THREE.Color(categoryColors[categoryIndex % categoryColors.length]);
  }, [colorMode, solidColor, processedData]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(3, 2.5, 3);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.autoRotate = enableRotation;
    controls.autoRotateSpeed = 0.5;
    controls.maxPolarAngle = Math.PI / 2.1;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.3);
    pointLight.position.set(-5, 5, -5);
    scene.add(pointLight);

    // Floor
    if (showGrid) {
      const floorGeometry = new THREE.PlaneGeometry(4, 4);
      const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        side: THREE.DoubleSide,
      });
      const floor = new THREE.Mesh(floorGeometry, floorMaterial);
      floor.rotation.x = -Math.PI / 2;
      floor.position.y = 0;
      floor.receiveShadow = true;
      scene.add(floor);

      const gridHelper = new THREE.GridHelper(4, 10, 0x334155, 0x1e293b);
      gridHelper.position.y = 0.001;
      scene.add(gridHelper);
    }

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
  }, [width, height, backgroundColor, showGrid, enableRotation]);

  // Update bars
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing bars
    barsRef.current.forEach(mesh => {
      sceneRef.current?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    barsRef.current = [];

    const xCount = processedData.xLabels.length || 1;
    const zCount = processedData.zLabels.length || 1;
    const spacing = 0.6;

    processedData.bars.forEach((bar, index) => {
      const height = bar.normalizedHeight;
      const geometry = new THREE.BoxGeometry(barWidth, height, barDepth);
      
      const material = new THREE.MeshStandardMaterial({
        color: getBarColor(bar, index),
        metalness: 0.3,
        roughness: 0.7,
      });

      const mesh = new THREE.Mesh(geometry, material);
      
      // Position - center the grid
      const xOffset = ((bar.xIndex - (xCount - 1) / 2) * spacing);
      const zOffset = ((bar.zIndex - (zCount - 1) / 2) * spacing);
      mesh.position.set(xOffset, height / 2, zOffset);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData = { bar };

      sceneRef.current?.add(mesh);
      barsRef.current.push(mesh);
    });
  }, [processedData, barWidth, barDepth, getBarColor]);

  // Handle click
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(barsRef.current);

    if (intersects.length > 0) {
      onBarClick?.(intersects[0].object.userData.bar);
    }
  }, [width, height, onBarClick]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width, height }}
      onClick={handleClick}
    />
  );
}

export default Bar3DChart;
