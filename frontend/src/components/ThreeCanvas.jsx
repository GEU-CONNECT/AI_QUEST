import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { getLiteModeState, setLiteModeState } from '../utils/performance';

export default function ThreeCanvas() {
  const mountRef = useRef(null);
  const [isLite, setIsLite] = useState(getLiteModeState());

  // Listen for manual or automatic performance mode changes
  useEffect(() => {
    const handlePerfChange = (e) => {
      setIsLite(Boolean(e.detail?.isLite));
    };
    window.addEventListener('aiquest-perf-change', handlePerfChange);
    return () => window.removeEventListener('aiquest-perf-change', handlePerfChange);
  }, []);

  useEffect(() => {
    if (isLite) {
      // In Lite Mode, completely skip Three.js initialization (0% GPU/CPU)
      return;
    }

    const container = mountRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060f38, 0.032);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 18);

    // Optimized renderer settings: Cap pixelRatio at 1.25 to prevent CPU/GPU saturation
    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
      precision: 'mediump',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x162c68, 2.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffea85, 2.5);
    dirLight.position.set(6, 14, 12);
    scene.add(dirLight);

    // Golden Point Light tracking mouse
    const goldLight = new THREE.PointLight(0xffc107, 4.0, 32);
    goldLight.position.set(0, 2, 8);
    scene.add(goldLight);

    // Electric Cyan Point Light for AI theme
    const cyanLight = new THREE.PointLight(0x00e5ff, 3.5, 28);
    cyanLight.position.set(-8, -4, 5);
    scene.add(cyanLight);

    // --- 3D AI Quest Floating Quantum Core ---
    const coreGroup = new THREE.Group();
    coreGroup.position.set(0, 4.5, -4);
    scene.add(coreGroup);

    // Outer Golden Wireframe Polyhedron
    const icoGeom = new THREE.IcosahedronGeometry(2.8, 1);
    const icoMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      wireframe: true,
      wireframeLinewidth: 1,
      emissive: 0x664800,
      emissiveIntensity: 0.4,
    });
    const icoMesh = new THREE.Mesh(icoGeom, icoMat);
    coreGroup.add(icoMesh);

    // Inner Glowing Cyan Torus Knot
    const torusGeom = new THREE.TorusKnotGeometry(1.4, 0.32, 64, 12);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0044ff,
      emissiveIntensity: 0.65,
    });
    const torusMesh = new THREE.Mesh(torusGeom, torusMat);
    coreGroup.add(torusMesh);

    // Center Quantum AI Crystal
    const crystalGeom = new THREE.OctahedronGeometry(0.85, 0);
    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.3,
      roughness: 0.1,
      emissive: 0x00f5ff,
      emissiveIntensity: 0.85,
    });
    const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
    coreGroup.add(crystalMesh);

    // 3D Orbital Rings
    const ringGeom = new THREE.TorusGeometry(3.6, 0.04, 12, 64);
    const ringMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x4d3300,
    });
    const ringMesh1 = new THREE.Mesh(ringGeom, ringMat);
    ringMesh1.rotation.x = Math.PI / 3;
    coreGroup.add(ringMesh1);

    const ringMesh2 = new THREE.Mesh(ringGeom, ringMat);
    ringMesh2.rotation.y = Math.PI / 2.5;
    coreGroup.add(ringMesh2);

    // --- Curved Streamers ---
    const ribbonGroup = new THREE.Group();
    scene.add(ribbonGroup);

    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
      emissive: 0x332000,
      emissiveIntensity: 0.25,
    });

    const createCurvedRibbon = (controlPoints, radius = 0.18) => {
      const curve = new THREE.CatmullRomCurve3(controlPoints);
      const tubeGeom = new THREE.TubeGeometry(curve, 48, radius, 6, false);
      return new THREE.Mesh(tubeGeom, ribbonMaterial);
    };

    const leftRibbon = createCurvedRibbon([
      new THREE.Vector3(-15, 10, -5),
      new THREE.Vector3(-10, 4, -1),
      new THREE.Vector3(-13, -2, 3),
      new THREE.Vector3(-8, -7, 1),
      new THREE.Vector3(-12, -12, -4),
    ], 0.22);
    ribbonGroup.add(leftRibbon);

    const rightRibbon = createCurvedRibbon([
      new THREE.Vector3(15, 11, -6),
      new THREE.Vector3(10, 5, -1),
      new THREE.Vector3(13, -1, 3),
      new THREE.Vector3(9, -8, 0),
      new THREE.Vector3(13, -13, -5),
    ], 0.20);
    ribbonGroup.add(rightRibbon);

    // --- Floating Confetti (Optimized to 50 items) ---
    const confettiCount = 50;
    const confettiGroup = new THREE.Group();
    scene.add(confettiGroup);

    const confettiGeom = new THREE.PlaneGeometry(0.3, 0.18);
    const confettiColors = [0xffd700, 0xffb703, 0xffea00, 0x00e5ff, 0xffffff];
    const confettiItems = [];

    for (let i = 0; i < confettiCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: confettiColors[i % confettiColors.length],
        metalness: 0.8,
        roughness: 0.2,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(confettiGeom, mat);
      
      mesh.position.set(
        (Math.random() - 0.5) * 36,
        (Math.random() - 0.5) * 26,
        (Math.random() - 0.5) * 16
      );
      
      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      );

      const rotSpeed = {
        x: (Math.random() - 0.5) * 0.03,
        y: (Math.random() - 0.5) * 0.035,
        z: (Math.random() - 0.5) * 0.02,
      };

      const initialY = mesh.position.y;
      confettiItems.push({ mesh, rotSpeed, initialY });
      confettiGroup.add(mesh);
    }

    // --- Neural Starfield (Optimized to 350 particles) ---
    const starCount = 350;
    const starGeom = new THREE.BufferGeometry();
    const starPositions = new Float32Array(starCount * 3);
    const starColors = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 55;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 45;
      starPositions[i * 3 + 2] = (Math.random() - 0.5) * 35 - 5;

      const isGold = Math.random() > 0.45;
      if (isGold) {
        starColors[i * 3] = 1.0;
        starColors[i * 3 + 1] = 0.85;
        starColors[i * 3 + 2] = 0.2;
      } else {
        starColors[i * 3] = 0.1;
        starColors[i * 3 + 1] = 0.75;
        starColors[i * 3 + 2] = 1.0;
      }
    }

    starGeom.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    starGeom.setAttribute('color', new THREE.BufferAttribute(starColors, 3));

    const starMat = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
    });
    const starField = new THREE.Points(starGeom, starMat);
    scene.add(starField);

    // --- Mouse Parallax & Dynamic Light Tracking ---
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let activityPulse = 0;

    const handleMouseMove = (e) => {
      mouse.targetX = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.targetY = -(e.clientY / window.innerHeight) * 2 + 1;
    };

    const handleFormActivity = (e) => {
      activityPulse = Math.min(activityPulse + (e.detail?.intensity || 0.6), 2.5);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: true });
    window.addEventListener('ai-quest-activity', handleFormActivity, { passive: true });

    // --- Keystroke / Input Focus Throttling ---
    // When student is typing in form inputs, pause 3D animation loop to prevent input lag
    let isTypingFocused = false;
    const handleFocusIn = (e) => {
      if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) {
        isTypingFocused = true;
      }
    };
    const handleFocusOut = () => {
      isTypingFocused = false;
    };
    document.addEventListener('focusin', handleFocusIn, { passive: true });
    document.addEventListener('focusout', handleFocusOut, { passive: true });

    // --- Dynamic FPS Monitor for Auto-Downgrade on Slow Machines ---
    let frameCount = 0;
    let lastFpsCheck = performance.now();
    let lowFpsStreak = 0;

    // --- Animation Loop ---
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      // Measure FPS every 60 frames
      frameCount++;
      if (frameCount >= 60) {
        const now = performance.now();
        const duration = (now - lastFpsCheck) / 1000;
        const currentFps = frameCount / duration;
        frameCount = 0;
        lastFpsCheck = now;

        if (currentFps < 22) {
          lowFpsStreak++;
          if (lowFpsStreak >= 2) {
            // CPU/GPU struggle detected! Auto-switch to Lite Mode
            console.warn(`Low FPS (${Math.round(currentFps)}) detected. Auto-activating Smooth Mode.`);
            setLiteModeState(true);
            return;
          }
        } else {
          lowFpsStreak = 0;
        }
      }

      // If typing in input, skip rendering this frame to yield CPU entirely to browser
      if (isTypingFocused) {
        return;
      }

      const elapsedTime = clock.getElapsedTime();

      // Decay activity pulse
      activityPulse = Math.max(0, activityPulse * 0.94);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.05;
      mouse.y += (mouse.targetY - mouse.y) * 0.05;

      // Parallax camera movement
      camera.position.x = mouse.x * 2.2;
      camera.position.y = mouse.y * 1.4;
      camera.lookAt(0, 0, 0);

      // Lights
      goldLight.position.x = mouse.x * 12;
      goldLight.position.y = mouse.y * 8 + 2;
      cyanLight.position.x = -mouse.x * 10 - 4;
      cyanLight.position.y = -mouse.y * 7 - 2;

      // AI Core Rotation
      const currentSpeed = 1.0 + activityPulse * 1.2;
      coreGroup.rotation.y = elapsedTime * 0.35 * currentSpeed;
      coreGroup.rotation.x = Math.sin(elapsedTime * 0.25) * 0.2;
      
      icoMesh.rotation.z = elapsedTime * 0.18 * currentSpeed;
      torusMesh.rotation.x = elapsedTime * 0.45 * currentSpeed;
      torusMesh.rotation.y = elapsedTime * 0.6 * currentSpeed;
      crystalMesh.rotation.y = -elapsedTime * 0.85 * currentSpeed;
      
      ringMesh1.rotation.z = elapsedTime * 0.3 * currentSpeed;
      ringMesh2.rotation.x = -elapsedTime * 0.35 * currentSpeed;
      coreGroup.position.y = 4.2 + Math.sin(elapsedTime * 1.2) * 0.4;

      // Ribbons undulating
      leftRibbon.rotation.z = Math.sin(elapsedTime * 0.5) * 0.08;
      rightRibbon.rotation.z = Math.cos(elapsedTime * 0.5) * 0.08;

      // Confetti Fluttering Animation
      confettiItems.forEach((item, index) => {
        item.mesh.rotation.x += item.rotSpeed.x * currentSpeed;
        item.mesh.rotation.y += item.rotSpeed.y * currentSpeed;
        item.mesh.rotation.z += item.rotSpeed.z * currentSpeed;
        item.mesh.position.y = item.initialY + Math.sin(elapsedTime * 1.2 + index) * 0.8;
      });

      // Starfield slow drift
      starField.rotation.y = elapsedTime * 0.02;

      renderer.render(scene, camera);
    };

    animate();

    // --- Resize Handler ---
    const handleResize = () => {
      const newWidth = container.clientWidth || window.innerWidth;
      const newHeight = container.clientHeight || window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    };

    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('ai-quest-activity', handleFormActivity);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('focusin', handleFocusIn);
      document.removeEventListener('focusout', handleFocusOut);
      cancelAnimationFrame(animationFrameId);

      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      icoGeom.dispose();
      icoMat.dispose();
      torusGeom.dispose();
      torusMat.dispose();
      crystalGeom.dispose();
      crystalMat.dispose();
      confettiGeom.dispose();
      starGeom.dispose();
      starMat.dispose();
      ringGeom.dispose();
      ringMat.dispose();
    };
  }, [isLite]);

  if (isLite) {
    // 0% CPU & 0% GPU ultra-smooth fallback for older PCs
    return (
      <div className="lite-mode-backdrop" aria-hidden="true">
        <div className="lite-space-gradient" />
        <div className="lite-ambient-circle lite-circle-1" />
        <div className="lite-ambient-circle lite-circle-2" />
      </div>
    );
  }

  return (
    <div
      ref={mountRef}
      className="three-canvas-container"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}
    />
  );
}
