'use client';

import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface TimelineEvent {
  id: string;
  date: Date | string;
  category: string;
  value: number;
  label?: string;
  color?: string;
  description?: string;
}

export interface Timeline3DChartProps {
  events: TimelineEvent[];
  width?: number;
  height?: number;
  startDate?: Date;
  endDate?: Date;
  showConnections?: boolean;
  showLabels?: boolean;
  categorySpacing?: number;
  timelineLength?: number;
  onEventClick?: (event: TimelineEvent) => void;
  onEventHover?: (event: TimelineEvent | null) => void;
  backgroundColor?: string;
  className?: string;
}

const categoryColors = [
  '#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

export function Timeline3DChart({
  events,
  width = 800,
  height = 400,
  startDate: propStartDate,
  endDate: propEndDate,
  showConnections = true,
  showLabels = true,
  categorySpacing = 1,
  timelineLength = 6,
  onEventClick,
  onEventHover,
  backgroundColor = '#0f172a',
  className = '',
}: Timeline3DChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const eventMeshesRef = useRef<THREE.Mesh[]>([]);
  const labelsGroupRef = useRef<THREE.Group | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const hoveredRef = useRef<THREE.Mesh | null>(null);

  // Process events data
  const processedData = useMemo(() => {
    const dates = events.map(e => new Date(e.date).getTime());
    const minDate = propStartDate ? propStartDate.getTime() : Math.min(...dates);
    const maxDate = propEndDate ? propEndDate.getTime() : Math.max(...dates);
    const dateRange = maxDate - minDate || 1;

    const categories = [...new Set(events.map(e => e.category))];
    const maxValue = Math.max(...events.map(e => e.value), 1);

    return {
      minDate,
      maxDate,
      dateRange,
      categories,
      maxValue,
      events: events.map(event => {
        const timestamp = new Date(event.date).getTime();
        return {
          ...event,
          normalizedTime: (timestamp - minDate) / dateRange,
          categoryIndex: categories.indexOf(event.category),
          normalizedValue: event.value / maxValue,
        };
      }).sort((a, b) => a.normalizedTime - b.normalizedTime),
    };
  }, [events, propStartDate, propEndDate]);

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 3, 5);
    camera.lookAt(timelineLength / 2, 0, 0);
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
    controls.target.set(timelineLength / 2, 0, 0);
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Timeline base (central axis)
    const axisGeometry = new THREE.CylinderGeometry(0.02, 0.02, timelineLength, 16);
    const axisMaterial = new THREE.MeshStandardMaterial({ color: 0x64748b });
    const axis = new THREE.Mesh(axisGeometry, axisMaterial);
    axis.rotation.z = Math.PI / 2;
    axis.position.set(timelineLength / 2, 0, 0);
    scene.add(axis);

    // Timeline arrow head
    const arrowGeometry = new THREE.ConeGeometry(0.06, 0.15, 16);
    const arrow = new THREE.Mesh(arrowGeometry, axisMaterial);
    arrow.rotation.z = -Math.PI / 2;
    arrow.position.set(timelineLength + 0.05, 0, 0);
    scene.add(arrow);

    // Floor grid
    const gridHelper = new THREE.GridHelper(10, 20, 0x334155, 0x1e293b);
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // Labels group
    const labelsGroup = new THREE.Group();
    scene.add(labelsGroup);
    labelsGroupRef.current = labelsGroup;

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
  }, [width, height, backgroundColor, timelineLength]);

  // Update events
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing event meshes
    eventMeshesRef.current.forEach(mesh => {
      sceneRef.current?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    eventMeshesRef.current = [];

    // Clear labels
    if (labelsGroupRef.current) {
      while (labelsGroupRef.current.children.length > 0) {
        const child = labelsGroupRef.current.children[0];
        labelsGroupRef.current.remove(child);
      }
    }

    // Create category lanes (z-axis)
    processedData.categories.forEach((category, index) => {
      const laneZ = (index - (processedData.categories.length - 1) / 2) * categorySpacing;
      
      // Lane line
      const laneGeometry = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0, laneZ),
        new THREE.Vector3(timelineLength, 0, laneZ),
      ]);
      const laneMaterial = new THREE.LineBasicMaterial({
        color: categoryColors[index % categoryColors.length],
        opacity: 0.3,
        transparent: true,
      });
      const lane = new THREE.Line(laneGeometry, laneMaterial);
      sceneRef.current?.add(lane);
    });

    // Create event markers
    processedData.events.forEach((event, index) => {
      const x = event.normalizedTime * timelineLength;
      const z = (event.categoryIndex - (processedData.categories.length - 1) / 2) * categorySpacing;
      const height = 0.2 + event.normalizedValue * 0.8;

      // Event cylinder/pillar
      const geometry = new THREE.CylinderGeometry(0.08, 0.08, height, 16);
      const color = event.color 
        ? new THREE.Color(event.color)
        : new THREE.Color(categoryColors[event.categoryIndex % categoryColors.length]);
      
      const material = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.3,
        roughness: 0.7,
        emissive: color,
        emissiveIntensity: 0.1,
      });

      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, height / 2, z);
      mesh.castShadow = true;
      mesh.userData = { event };

      sceneRef.current?.add(mesh);
      eventMeshesRef.current.push(mesh);

      // Event sphere at top
      const sphereGeometry = new THREE.SphereGeometry(0.1, 16, 16);
      const sphereMaterial = new THREE.MeshStandardMaterial({
        color,
        metalness: 0.5,
        roughness: 0.5,
        emissive: color,
        emissiveIntensity: 0.2,
      });
      const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
      sphere.position.set(x, height + 0.1, z);
      sphere.userData = { event };
      sceneRef.current?.add(sphere);
      eventMeshesRef.current.push(sphere);
    });

    // Create connections between sequential events
    if (showConnections && processedData.events.length > 1) {
      for (let i = 1; i < processedData.events.length; i++) {
        const prev = processedData.events[i - 1];
        const curr = processedData.events[i];

        const prevX = prev.normalizedTime * timelineLength;
        const currX = curr.normalizedTime * timelineLength;
        const prevZ = (prev.categoryIndex - (processedData.categories.length - 1) / 2) * categorySpacing;
        const currZ = (curr.categoryIndex - (processedData.categories.length - 1) / 2) * categorySpacing;
        const prevH = 0.2 + prev.normalizedValue * 0.8 + 0.1;
        const currH = 0.2 + curr.normalizedValue * 0.8 + 0.1;

        // Create curved connection
        const curve = new THREE.QuadraticBezierCurve3(
          new THREE.Vector3(prevX, prevH, prevZ),
          new THREE.Vector3((prevX + currX) / 2, Math.max(prevH, currH) + 0.3, (prevZ + currZ) / 2),
          new THREE.Vector3(currX, currH, currZ)
        );

        const tubeGeometry = new THREE.TubeGeometry(curve, 20, 0.01, 8, false);
        const tubeMaterial = new THREE.MeshBasicMaterial({
          color: 0x64748b,
          transparent: true,
          opacity: 0.4,
        });
        const tube = new THREE.Mesh(tubeGeometry, tubeMaterial);
        sceneRef.current?.add(tube);
      }
    }
  }, [processedData, categorySpacing, timelineLength, showConnections, showLabels]);

  // Handle mouse events
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(eventMeshesRef.current);

    // Reset previous hover
    if (hoveredRef.current) {
      const material = hoveredRef.current.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.1;
      hoveredRef.current = null;
    }

    if (intersects.length > 0) {
      const mesh = intersects[0].object as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.emissiveIntensity = 0.5;
      hoveredRef.current = mesh;
      onEventHover?.(mesh.userData.event);
    } else {
      onEventHover?.(null);
    }
  }, [width, height, onEventHover]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(eventMeshesRef.current);

    if (intersects.length > 0) {
      onEventClick?.(intersects[0].object.userData.event);
    }
  }, [width, height, onEventClick]);

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

export default Timeline3DChart;
