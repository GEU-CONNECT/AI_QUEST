import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

export default function ThreeCanvas() {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // --- Scene Setup ---
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x060f38, 0.032);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(0, 0, 18);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0x162c68, 2.5);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffea85, 2.8);
    dirLight.position.set(6, 14, 12);
    scene.add(dirLight);

    // Golden Point Light tracking mouse
    const goldLight = new THREE.PointLight(0xffc107, 4.5, 35);
    goldLight.position.set(0, 2, 8);
    scene.add(goldLight);

    // Electric Cyan Point Light for AI theme
    const cyanLight = new THREE.PointLight(0x00e5ff, 4.0, 30);
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
      metalness: 0.95,
      roughness: 0.12,
      wireframe: true,
      wireframeLinewidth: 2,
      emissive: 0x664800,
      emissiveIntensity: 0.45,
    });
    const icoMesh = new THREE.Mesh(icoGeom, icoMat);
    coreGroup.add(icoMesh);

    // Inner Glowing Cyan Torus Knot (AI Neural Node)
    const torusGeom = new THREE.TorusKnotGeometry(1.4, 0.32, 100, 18);
    const torusMat = new THREE.MeshStandardMaterial({
      color: 0x0066ff,
      metalness: 0.8,
      roughness: 0.2,
      emissive: 0x0044ff,
      emissiveIntensity: 0.7,
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
      emissiveIntensity: 0.9,
    });
    const crystalMesh = new THREE.Mesh(crystalGeom, crystalMat);
    coreGroup.add(crystalMesh);

    // Vertex points around the core
    const dotGeom = new THREE.BufferGeometry();
    const pos = icoGeom.attributes.position.array;
    dotGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dotMat = new THREE.PointsMaterial({
      color: 0xffe680,
      size: 0.22,
      transparent: true,
      opacity: 0.95,
    });
    const dotPoints = new THREE.Points(dotGeom, dotMat);
    coreGroup.add(dotPoints);

    // 3D Orbital Rings around the core
    const ringGeom = new THREE.TorusGeometry(3.6, 0.04, 16, 100);
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

    // --- 3D Golden Ribbons & Curving Streamers ---
    const ribbonGroup = new THREE.Group();
    scene.add(ribbonGroup);

    const ribbonMaterial = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      metalness: 0.9,
      roughness: 0.2,
      side: THREE.DoubleSide,
      emissive: 0x332000,
      emissiveIntensity: 0.3,
    });

    const createCurvedRibbon = (controlPoints, radius = 0.16) => {
      const curve = new THREE.CatmullRomCurve3(controlPoints);
      const tubeGeom = new THREE.TubeGeometry(curve, 72, radius, 8, false);
      return new THREE.Mesh(tubeGeom, ribbonMaterial);
    };

    // Left flowing golden ribbon
    const leftRibbon = createCurvedRibbon([
      new THREE.Vector3(-15, 10, -5),
      new THREE.Vector3(-10, 4, -1),
      new THREE.Vector3(-13, -2, 3),
      new THREE.Vector3(-8, -7, 1),
      new THREE.Vector3(-12, -12, -4),
    ], 0.24);
    ribbonGroup.add(leftRibbon);

    // Right flowing golden ribbon
    const rightRibbon = createCurvedRibbon([
      new THREE.Vector3(15, 11, -6),
      new THREE.Vector3(10, 5, -1),
      new THREE.Vector3(13, -1, 3),
      new THREE.Vector3(9, -8, 0),
      new THREE.Vector3(13, -13, -5),
    ], 0.22);
    ribbonGroup.add(rightRibbon);

    // --- Floating Golden Confetti & Shimmering Flakes ---
    const confettiCount = 130;
    const confettiGroup = new THREE.Group();
    scene.add(confettiGroup);

    const confettiGeom = new THREE.PlaneGeometry(0.3, 0.18);
    const confettiColors = [0xffd700, 0xffb703, 0xffea00, 0x00e5ff, 0xffffff];
    const confettiItems = [];

    for (let i = 0; i < confettiCount; i++) {
      const mat = new THREE.MeshStandardMaterial({
        color: confettiColors[i % confettiColors.length],
        metalness: 0.9,
        roughness: 0.18,
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
        x: (Math.random() - 0.5) * 0.035,
        y: (Math.random() - 0.5) * 0.04,
        z: (Math.random() - 0.5) * 0.025,
      };

      const initialY = mesh.position.y;
      confettiItems.push({ mesh, rotSpeed, initialY });
      confettiGroup.add(mesh);
    }

    // --- Neural Starfield / Data Nodes ---
    const starCount = 900;
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
      size: 0.09,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
    });
    const starField = new THREE.Points(starGeom, starMat);
    scene.add(starField);

    // --- Interactive Mouse Parallax & Dynamic Light Tracking ---
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
    let activityPulse = 0;

    const handleMouseMove = (e) => {
      const normX = (e.clientX / window.innerWidth) * 2 - 1;
      const normY = -(e.clientY / window.innerHeight) * 2 + 1;
      mouse.targetX = normX;
      mouse.targetY = normY;
    };

    const handleFormActivity = (e) => {
      activityPulse = Math.min(activityPulse + (e.detail?.intensity || 0.8), 3.0);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('ai-quest-activity', handleFormActivity);

    // --- Animation Loop ---
    let animationFrameId;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Decay activity pulse
      activityPulse = Math.max(0, activityPulse * 0.94);

      // Smooth mouse lerp
      mouse.x += (mouse.targetX - mouse.x) * 0.06;
      mouse.y += (mouse.targetY - mouse.y) * 0.06;

      // Parallax camera movement
      camera.position.x = mouse.x * 2.8;
      camera.position.y = mouse.y * 1.8;
      camera.lookAt(0, 0, 0);

      // Light coordinates following mouse in world space + activity surge
      goldLight.position.x = mouse.x * 14;
      goldLight.position.y = mouse.y * 9 + 2;
      goldLight.intensity = 4.5 + activityPulse * 3;

      cyanLight.position.x = -mouse.x * 12 - 4;
      cyanLight.position.y = -mouse.y * 8 - 2;
      cyanLight.intensity = 4.0 + activityPulse * 2.5;

      // AI Quantum Core Rotation with activity surge
      const currentSpeed = 1.0 + activityPulse * 1.5;
      coreGroup.rotation.y = elapsedTime * 0.4 * currentSpeed;
      coreGroup.rotation.x = Math.sin(elapsedTime * 0.3) * 0.25;
      
      icoMesh.rotation.z = elapsedTime * 0.2 * currentSpeed;
      torusMesh.rotation.x = elapsedTime * 0.5 * currentSpeed;
      torusMesh.rotation.y = elapsedTime * 0.7 * currentSpeed;
      crystalMesh.rotation.y = -elapsedTime * 1.0 * currentSpeed;
      
      ringMesh1.rotation.z = elapsedTime * 0.35 * currentSpeed;
      ringMesh2.rotation.x = -elapsedTime * 0.4 * currentSpeed;

      // Core breath oscillation
      coreGroup.position.y = 4.2 + Math.sin(elapsedTime * 1.4) * 0.45;

      // Ribbons undulating
      leftRibbon.rotation.z = Math.sin(elapsedTime * 0.6) * 0.1;
      rightRibbon.rotation.z = Math.cos(elapsedTime * 0.6) * 0.1;
      ribbonGroup.position.y = Math.sin(elapsedTime * 0.8) * 0.3;

      // Confetti Fluttering Animation
      confettiItems.forEach((item, index) => {
        item.mesh.rotation.x += item.rotSpeed.x * currentSpeed;
        item.mesh.rotation.y += item.rotSpeed.y * currentSpeed;
        item.mesh.rotation.z += item.rotSpeed.z * currentSpeed;

        item.mesh.position.y = item.initialY + Math.sin(elapsedTime * 1.5 + index) * 0.9;
        item.mesh.position.x += Math.sin(elapsedTime * 0.8 + index) * 0.006;
      });

      // Starfield slow drift
      starField.rotation.y = elapsedTime * 0.025;

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
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    };

    window.addEventListener('resize', handleResize);

    // --- Cleanup ---
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('ai-quest-activity', handleFormActivity);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
      if (container && renderer.domElement) {
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
  }, []);

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
