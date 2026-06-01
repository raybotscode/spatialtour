// Three.js scene + Gaussian splat viewer setup
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Viewer } from '@mkkellogg/gaussian-splats-3d';
import { gsap } from 'gsap';
import { state, on } from '../data/store.js';
import { ZoneRenderer } from './zones.js';

export let scene, camera, renderer, controls, splatViewer, zoneRenderer;

const DEFAULT_SPLAT = null; // user provides URL or drags file

export async function initViewport(container) {
  // WebGL renderer with WebGPU detection
  const canvas = document.createElement('canvas');
  container.appendChild(canvas);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  camera = new THREE.PerspectiveCamera(
    60,
    container.clientWidth / container.clientHeight,
    0.1,
    1000
  );
  camera.position.set(0, 2, 8);

  // Lighting for Three.js objects overlaid on splats
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(10, 20, 10);
  scene.add(dirLight);

  // Orbit controls
  controls = new OrbitControls(camera, renderer.el || renderer.domElement);
  controls.target.set(0, 1, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 1;
  controls.maxDistance = 50;
  controls.update();

  // Splat viewer — uses our Three.js scene
  splatViewer = new Viewer({
    threeScene: scene,
    renderer: renderer,
    camera: camera,
    useBuiltInControls: false,
    selfDrivenMode: false,
    sharedMemoryForWorkers: true,
    gpuAcceleratedSort: true,
    integerBasedSort: false,
    halfPrecisionCovariancesOnGPU: true,
    splatSortDistanceMapPrecision: 0.01,
  });

  // Zone overlay renderer
  zoneRenderer = new ZoneRenderer(scene, camera, renderer);

  // Handle resize
  const onResize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener('resize', onResize);

  // Render loop
  splatViewer.init().then(() => {
    animate();
  });

  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    zoneRenderer.updateLabels(camera, renderer);
    splatViewer.render();
  }

  // Listen for mode changes to enable/disable controls
  on('mode', (mode) => {
    controls.enabled = mode !== 'edit';
  });

  return { scene, camera, renderer, controls, splatViewer };
}

// Load a splat scene from URL
export async function loadSplat(sceneUrl) {
  const statusEl = document.getElementById('loading-status');
  if (statusEl) statusEl.textContent = 'Loading 3D scene...';

  try {
    await splatViewer.addSplatScene(sceneUrl, {
      randomSplatListColor: 0xcccccc,
      splatAlphaRemovalThreshold: 0.05,
      showLoadingSpinner: false,
    });

    state.splatLoaded = true;
    state.splatUrl = sceneUrl;

    const loading = document.getElementById('loading-screen');
    if (loading) loading.classList.add('fade-out');
    setTimeout(() => { if (loading) loading.remove(); }, 800);

    return true;
  } catch (err) {
    console.error('Failed to load splat:', err);
    if (statusEl) statusEl.textContent = 'Failed to load scene. Try a different file.';
    return false;
  }
}

// Fly camera to a target position with smooth animation
export function flyToCamera(position, target, duration = 1.2) {
  controls.enabled = false;

  const tl = gsap.timeline({
    onComplete: () => {
      controls.enabled = state.mode !== 'edit';
    }
  });

  tl.to(camera.position, {
    x: position.x, y: position.y, z: position.z,
    duration,
    ease: 'power2.inOut',
  }, 0);

  tl.to(controls.target, {
    x: target.x, y: target.y, z: target.z,
    duration,
    ease: 'power2.inOut',
    onUpdate: () => controls.update(),
  }, 0);

  return tl;
}

// Fly to a zone's camera preset
export function flyToZone(zone) {
  if (!zone || !zone.cameraPosition || !zone.cameraTarget) return;
  flyToCamera(zone.cameraPosition, zone.cameraTarget, 1.5);
}

// Snapshot current camera as a zone preset
export function captureCurrentCamera() {
  return {
    cameraPosition: {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z,
    },
    cameraTarget: {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z,
    },
  };
}