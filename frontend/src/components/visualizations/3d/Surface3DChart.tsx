'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface SurfacePoint {
  x: number;
  z: number;
  y: number; // Height value
}

export interface Surface3DChartProps {
  data: SurfacePoint[][] | ((x: number, z: number) => number);
  width?: number;
  height?: number;
  resolution?: number;
  xRange?: [number, number];
  zRange?: [number, number];
  colorMode?: 'height' | 'gradient' | 'solid';
  solidColor?: string;
  wireframe?: boolean;
  showGrid?: boolean;
  axisLabels?: { x: string; y: string; z: string };
  enableRotation?: boolean;
  backgroundColor?: string;
  className?: string;
}

export function Surface3DChart({
  data,
  width = 600,
  height = 400,
  resolution = 50,
  xRange = [-1, 1],
  zRange = [-1, 1],
  colorMode = 'height',
  solidColor = '#3b82f6',
  wireframe = false,
  showGrid = true,
  axisLabels = { x: 'X', y: 'Y', z: 'Z' },
  enableRotation = true,
  backgroundColor = '#0f172a',
  className = '',
}: Surface3DChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  // Generate surface data
  const surfaceData = useMemo(() => {
    if (typeof data === 'function') {
      const points: SurfacePoint[][] = [];
      const xStep = (xRange[1] - xRange[0]) / (resolution - 1);
      const zStep = (zRange[1] - zRange[0]) / (resolution - 1);

      for (let i = 0; i < resolution; i++) {
        const row: SurfacePoint[] = [];
        for (let j = 0; j < resolution; j++) {
          const x = xRange[0] + i * xStep;
          const z = zRange[0] + j * zStep;
          row.push({ x, z, y: data(x, z) });
        }
        points.push(row);
      }
      return points;
    }
    return data;
  }, [data, resolution, xRange, zRange]);

  // Calculate height bounds
  const heightBounds = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    surfaceData.forEach(row => {
      row.forEach(point => {
        min = Math.min(min, point.y);
        max = Math.max(max, point.y);
      });
    });

    return { min, max, range: max - min || 1 };
  }, [surfaceData]);

  // Get color based on height
  const getVertexColor = useCallback((height: number) => {
    if (colorMode === 'solid') {
      return new THREE.Color(solidColor);
    }

    const normalized = (height - heightBounds.min) / heightBounds.range;

    if (colorMode === 'height') {
      // Blue (low) to Red (high) gradient
      return new THREE.Color().setHSL(0.7 - normalized * 0.7, 0.8, 0.5);
    }

    // Gradient mode
    return new THREE.Color().setHSL(normalized * 0.8, 0.7, 0.5);
  }, [colorMode, solidColor, heightBounds]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
    camera.position.set(2, 1.5, 2);
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
    controls.autoRotateSpeed = 0.5;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambientLight);

    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 5);
    scene.add(directionalLight1);

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.3);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    // Grid
    if (showGrid) {
      const gridHelper = new THREE.GridHelper(2, 10, 0x444444, 0x333333);
      gridHelper.position.y = -0.5;
      scene.add(gridHelper);
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
  }, [width, height, backgroundColor, showGrid, enableRotation]);

  // Update surface when data changes
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing mesh
    if (meshRef.current) {
      sceneRef.current.remove(meshRef.current);
      meshRef.current.geometry.dispose();
      if (Array.isArray(meshRef.current.material)) {
        meshRef.current.material.forEach(m => m.dispose());
      } else {
        meshRef.current.material.dispose();
      }
    }

    const rows = surfaceData.length;
    const cols = surfaceData[0]?.length || 0;

    if (rows < 2 || cols < 2) return;

    // Create geometry
    const geometry = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // Normalize positions
    const xMin = surfaceData[0][0].x;
    const xMax = surfaceData[rows - 1][0].x;
    const zMin = surfaceData[0][0].z;
    const zMax = surfaceData[0][cols - 1].z;
    const xRange_v = xMax - xMin || 1;
    const zRange_v = zMax - zMin || 1;

    // Add vertices
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        const point = surfaceData[i][j];
        const x = ((point.x - xMin) / xRange_v) * 2 - 1;
        const y = ((point.y - heightBounds.min) / heightBounds.range) - 0.5;
        const z = ((point.z - zMin) / zRange_v) * 2 - 1;

        vertices.push(x, y, z);

        const color = getVertexColor(point.y);
        colors.push(color.r, color.g, color.b);
      }
    }

    // Add indices for triangles
    for (let i = 0; i < rows - 1; i++) {
      for (let j = 0; j < cols - 1; j++) {
        const a = i * cols + j;
        const b = i * cols + j + 1;
        const c = (i + 1) * cols + j;
        const d = (i + 1) * cols + j + 1;

        indices.push(a, c, b);
        indices.push(b, c, d);
      }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();

    // Create material
    const material = new THREE.MeshPhongMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      wireframe,
      shininess: 30,
    });

    // Create mesh
    const mesh = new THREE.Mesh(geometry, material);
    sceneRef.current.add(mesh);
    meshRef.current = mesh;
  }, [surfaceData, heightBounds, wireframe, getVertexColor]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width, height }}
    />
  );
}

export default Surface3DChart;
