'use client';

import React, { useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export interface GlobePoint {
  lat: number;
  lng: number;
  value?: number;
  label?: string;
  color?: string;
}

export interface GlobeConnection {
  from: { lat: number; lng: number };
  to: { lat: number; lng: number };
  color?: string;
}

export interface Globe3DVisualizationProps {
  points?: GlobePoint[];
  connections?: GlobeConnection[];
  width?: number;
  height?: number;
  pointSize?: number;
  globeColor?: string;
  atmosphereColor?: string;
  showAtmosphere?: boolean;
  showGraticule?: boolean;
  enableRotation?: boolean;
  rotationSpeed?: number;
  onPointClick?: (point: GlobePoint) => void;
  backgroundColor?: string;
  className?: string;
}

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius = 1): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);
  
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  );
}

// Create arc between two points on sphere
function createArc(
  from: THREE.Vector3,
  to: THREE.Vector3,
  segments = 50,
  height = 0.2
): THREE.Vector3[] {
  const points: THREE.Vector3[] = [];
  
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    
    // Spherical interpolation
    const point = new THREE.Vector3().lerpVectors(from, to, t);
    
    // Add height based on arc
    const heightFactor = Math.sin(t * Math.PI) * height;
    point.normalize().multiplyScalar(1 + heightFactor);
    
    points.push(point);
  }
  
  return points;
}

export function Globe3DVisualization({
  points = [],
  connections = [],
  width = 600,
  height = 400,
  pointSize = 0.02,
  globeColor = '#1e40af',
  atmosphereColor = '#3b82f6',
  showAtmosphere = true,
  showGraticule = true,
  enableRotation = true,
  rotationSpeed = 0.2,
  onPointClick,
  backgroundColor = '#0a0a0a',
  className = '',
}: Globe3DVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const pointMeshesRef = useRef<THREE.Mesh[]>([]);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Initialize scene
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    camera.position.set(0, 0, 2.5);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.minDistance = 1.5;
    controls.maxDistance = 5;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(5, 3, 5);
    scene.add(directionalLight);

    // Create globe
    const globeGeometry = new THREE.SphereGeometry(1, 64, 64);
    const globeMaterial = new THREE.MeshPhongMaterial({
      color: new THREE.Color(globeColor),
      transparent: true,
      opacity: 0.9,
      shininess: 20,
    });
    const globe = new THREE.Mesh(globeGeometry, globeMaterial);
    scene.add(globe);
    globeRef.current = globe;

    // Atmosphere glow
    if (showAtmosphere) {
      const atmosphereGeometry = new THREE.SphereGeometry(1.05, 64, 64);
      const atmosphereMaterial = new THREE.ShaderMaterial({
        vertexShader: `
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform vec3 atmosphereColor;
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
            gl_FragColor = vec4(atmosphereColor, 1.0) * intensity;
          }
        `,
        uniforms: {
          atmosphereColor: { value: new THREE.Color(atmosphereColor) },
        },
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        transparent: true,
      });
      const atmosphere = new THREE.Mesh(atmosphereGeometry, atmosphereMaterial);
      scene.add(atmosphere);
    }

    // Graticule (lat/lng grid lines)
    if (showGraticule) {
      const graticuleGroup = new THREE.Group();
      const lineMaterial = new THREE.LineBasicMaterial({ color: 0x334155, opacity: 0.3, transparent: true });

      // Latitude lines
      for (let lat = -60; lat <= 60; lat += 30) {
        const points: THREE.Vector3[] = [];
        for (let lng = -180; lng <= 180; lng += 5) {
          points.push(latLngToVector3(lat, lng, 1.001));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        graticuleGroup.add(line);
      }

      // Longitude lines
      for (let lng = -180; lng < 180; lng += 30) {
        const points: THREE.Vector3[] = [];
        for (let lat = -90; lat <= 90; lat += 5) {
          points.push(latLngToVector3(lat, lng, 1.001));
        }
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const line = new THREE.Line(geometry, lineMaterial);
        graticuleGroup.add(line);
      }

      scene.add(graticuleGroup);
    }

    // Animation
    const animate = () => {
      requestAnimationFrame(animate);
      
      if (enableRotation && globeRef.current) {
        globeRef.current.rotation.y += rotationSpeed * 0.001;
      }
      
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      renderer.dispose();
      if (container && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [width, height, backgroundColor, globeColor, atmosphereColor, showAtmosphere, showGraticule, enableRotation, rotationSpeed]);

  // Update points
  useEffect(() => {
    if (!sceneRef.current) return;

    // Remove existing points
    pointMeshesRef.current.forEach(mesh => {
      sceneRef.current?.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    pointMeshesRef.current = [];

    // Add new points
    const pointGeometry = new THREE.SphereGeometry(pointSize, 16, 16);
    
    points.forEach((point) => {
      const size = point.value ? pointSize * (0.5 + point.value * 1.5) : pointSize;
      const geometry = point.value ? new THREE.SphereGeometry(size, 16, 16) : pointGeometry;
      
      const material = new THREE.MeshBasicMaterial({
        color: point.color ? new THREE.Color(point.color) : 0xef4444,
      });

      const mesh = new THREE.Mesh(geometry, material);
      const pos = latLngToVector3(point.lat, point.lng, 1.01);
      mesh.position.copy(pos);
      mesh.userData = { point };

      sceneRef.current?.add(mesh);
      pointMeshesRef.current.push(mesh);

      // Add glow effect for larger points
      if (point.value && point.value > 0.5) {
        const glowGeometry = new THREE.SphereGeometry(size * 2, 16, 16);
        const glowMaterial = new THREE.MeshBasicMaterial({
          color: point.color ? new THREE.Color(point.color) : 0xef4444,
          transparent: true,
          opacity: 0.2,
        });
        const glow = new THREE.Mesh(glowGeometry, glowMaterial);
        glow.position.copy(pos);
        sceneRef.current?.add(glow);
      }
    });

    // Add connections
    connections.forEach((conn) => {
      const fromPos = latLngToVector3(conn.from.lat, conn.from.lng);
      const toPos = latLngToVector3(conn.to.lat, conn.to.lng);
      
      const arcPoints = createArc(fromPos, toPos, 50, 0.3);
      const geometry = new THREE.BufferGeometry().setFromPoints(arcPoints);
      const material = new THREE.LineBasicMaterial({
        color: conn.color ? new THREE.Color(conn.color) : 0x22c55e,
        transparent: true,
        opacity: 0.6,
      });
      
      const arc = new THREE.Line(geometry, material);
      sceneRef.current?.add(arc);
    });
  }, [points, connections, pointSize]);

  // Handle click
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (!containerRef.current || !cameraRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    mouseRef.current.x = ((event.clientX - rect.left) / width) * 2 - 1;
    mouseRef.current.y = -((event.clientY - rect.top) / height) * 2 + 1;

    raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
    const intersects = raycasterRef.current.intersectObjects(pointMeshesRef.current);

    if (intersects.length > 0) {
      onPointClick?.(intersects[0].object.userData.point);
    }
  }, [width, height, onPointClick]);

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{ width, height }}
      onClick={handleClick}
    />
  );
}

export default Globe3DVisualization;
