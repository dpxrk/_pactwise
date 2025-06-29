'use client';

import React, { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Float } from '@react-three/drei';

// Animated particle system with standard materials
function AnimatedParticles() {
  const points = useRef<THREE.Points>(null);
  const particleCount = 1500;
  
  const [positions, colors, sizes] = useMemo(() => {
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const sizes = new Float32Array(particleCount);
    
    for (let i = 0; i < particleCount; i++) {
      const i3 = i * 3;
      
      // Create particles in a spherical volume
      const radius = Math.random() * 40 + 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos((Math.random() * 2) - 1);
      
      positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i3 + 2] = radius * Math.cos(phi);
      
      // Teal color palette with variations
      const colorChoice = Math.random();
      if (colorChoice < 0.33) {
        colors[i3] = 0.063;
        colors[i3 + 1] = 0.725;
        colors[i3 + 2] = 0.506;
      } else if (colorChoice < 0.66) {
        colors[i3] = 0.08;
        colors[i3 + 1] = 0.722;
        colors[i3 + 2] = 0.651;
      } else {
        colors[i3] = 0.055;
        colors[i3 + 1] = 0.647;
        colors[i3 + 2] = 0.913;
      }
      
      sizes[i] = Math.random() * 2 + 0.5;
    }
    
    return [positions, colors, sizes];
  }, []);
  
  useFrame((state) => {
    if (points.current) {
      points.current.rotation.y = state.clock.elapsedTime * 0.02;
      points.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
      
      // Animate individual particle positions
      const positions = points.current.geometry.attributes.position.array as Float32Array;
      const time = state.clock.elapsedTime;
      
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        const x = positions[i3];
        const y = positions[i3 + 1];
        const z = positions[i3 + 2];
        
        // Add wave motion
        positions[i3 + 1] = y + Math.sin(time * 0.5 + x * 0.01) * 0.02;
      }
      
      points.current.geometry.attributes.position.needsUpdate = true;
    }
  });
  
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={particleCount} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={particleCount} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        size={1}
        vertexColors
        transparent
        opacity={0.8}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

// Dynamic floating geometries
function FloatingGeometries() {
  const groupRef = useRef<THREE.Group>(null);
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.01;
    }
  });
  
  return (
    <group ref={groupRef}>
      {/* Floating torus knot */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.5}>
        <mesh position={[-20, 5, -20]} scale={4}>
          <torusKnotGeometry args={[1, 0.3, 128, 16]} />
          <meshBasicMaterial 
            color="#10b981" 
            wireframe 
            transparent 
            opacity={0.2}
          />
        </mesh>
      </Float>
      
      {/* Floating dodecahedron */}
      <Float speed={3} rotationIntensity={0.4} floatIntensity={0.6}>
        <mesh position={[25, -10, -25]} scale={6}>
          <dodecahedronGeometry args={[1, 0]} />
          <meshBasicMaterial 
            color="#14b8a6" 
            wireframe 
            transparent 
            opacity={0.15}
          />
        </mesh>
      </Float>
      
      {/* Floating icosahedron */}
      <Float speed={2.5} rotationIntensity={0.5} floatIntensity={0.4}>
        <mesh position={[0, 15, -30]} scale={5}>
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial 
            color="#0ea5e9" 
            wireframe 
            transparent 
            opacity={0.1}
          />
        </mesh>
      </Float>
    </group>
  );
}

// Connection lines between particles
function ConnectionLines() {
  const linesRef = useRef<THREE.Group>(null);
  const lineCount = 50;
  
  const lines = useMemo(() => {
    const temp = [];
    for (let i = 0; i < lineCount; i++) {
      const points = [
        new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        ),
        new THREE.Vector3(
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40,
          (Math.random() - 0.5) * 40
        ),
      ];
      temp.push(points);
    }
    return temp;
  }, []);
  
  useFrame((state) => {
    if (linesRef.current) {
      linesRef.current.rotation.z = state.clock.elapsedTime * 0.005;
    }
  });
  
  return (
    <group ref={linesRef}>
      {lines.map((points, index) => (
        <line key={index}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color="#0ea5e9" 
            transparent 
            opacity={0.1}
            blending={THREE.AdditiveBlending}
          />
        </line>
      ))}
    </group>
  );
}

// Background sphere with distortion
function BackgroundSphere() {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.005;
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.003;
    }
  });
  
  return (
    <mesh ref={meshRef} scale={60} position={[0, 0, -60]}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        color="#051515"
        side={THREE.BackSide}
        transparent
        opacity={0.8}
      />
    </mesh>
  );
}

// Camera movement
function CameraRig() {
  useFrame((state, delta) => {
    state.camera.position.x = Math.sin(state.clock.elapsedTime * 0.1) * 2;
    state.camera.position.y = Math.cos(state.clock.elapsedTime * 0.05) * 1;
    state.camera.lookAt(0, 0, 0);
  });
  
  return null;
}

export const ThreeBackground = () => {
  const [mounted, setMounted] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);
  
  if (!mounted) {
    return null;
  }
  
  return (
    <div className="fixed inset-0 z-0 pointer-events-none">
      <Canvas
        camera={{
          position: [0, 0, 40],
          fov: 75,
          near: 0.1,
          far: 1000,
        }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: "high-performance",
        }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
        }}
        onCreated={() => {
          setIsLoaded(true);
          console.log('ThreeBackground Canvas created');
        }}
      >
        {/* Scene setup */}
        <color attach="background" args={["#030808"]} />
        <fog attach="fog" color="#051010" near={20} far={100} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <pointLight position={[30, 30, 30]} color="#10b981" intensity={2} />
        <pointLight position={[-30, -30, 30]} color="#14b8a6" intensity={1.5} />
        <pointLight position={[0, 0, 20]} color="#0ea5e9" intensity={1} />
        
        {/* 3D Components */}
        <BackgroundSphere />
        <AnimatedParticles />
        <ConnectionLines />
        <FloatingGeometries />
        <CameraRig />
      </Canvas>
      
      {/* Gradient overlays */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-black/40" />
        <div 
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")`,
          }}
        />
      </div>
      
      {/* Debug info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute bottom-4 right-4 text-white/30 text-xs font-mono z-20">
          <div>Three.js: {isLoaded ? '✅ Loaded' : '⏳ Loading...'}</div>
        </div>
      )}
    </div>
  );
};