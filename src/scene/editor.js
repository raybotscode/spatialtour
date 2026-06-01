// Zone editor — add, move, resize zones with Three.js TransformControls
import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { scene, camera, controls, renderer, zoneRenderer } from './viewer.js';
import { state, set } from '../data/store.js';

let transformControls = null;
let editMesh = null;
let editWireframe = null;
let activeZone = null;
let isDragging = false;

export function initEditor(zoneStore) {
  transformControls = new TransformControls(camera, renderer.domElement);
  scene.add(transformControls);

  transformControls.addEventListener('dragging-changed', (e) => {
    isDragging = e.value;
    controls.enabled = !e.value;
  });

  transformControls.addEventListener('objectChange', () => {
    if (activeZone && editMesh) {
      updateZoneFromMesh(activeZone, editMesh);
      zoneRenderer.update(zoneStore);
    }
  });

  // Click on scene to select/deselect zones (in edit mode)
  renderer.domElement.addEventListener('pointerdown', (e) => {
    if (state.mode !== 'edit' || isDragging) return;
    // Check if we clicked on a zone mesh
    // For now, selection is handled via admin panel list
  });

  // Mode toggle
  import('../data/store.js').then(s =>
    s.on('mode', (mode) => {
      if (mode !== 'edit') {
        detachControls();
      }
    })
  );
}

export function attachControls(zone, zoneStore) {
  detachControls();
  activeZone = zone;

  const bb = zone.boundingBox;
  if (!bb) return;

  const size = new THREE.Vector3(
    bb.max.x - bb.min.x,
    bb.max.y - bb.min.y,
    bb.max.z - bb.min.z
  );
  const center = new THREE.Vector3(
    (bb.min.x + bb.max.x) / 2,
    (bb.min.y + bb.max.y) / 2,
    (bb.min.z + bb.max.z) / 2,
  );

  // Create a temporary mesh for manipulation
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const mat = new THREE.MeshBasicMaterial({
    color: zone.color || '#4fc3f7',
    transparent: true,
    opacity: 0.35,
    depthWrite: false,
    wireframe: false,
  });
  editMesh = new THREE.Mesh(geo, mat);
  editMesh.position.copy(center);
  editMesh.userData.isEditProxy = true;
  scene.add(editMesh);

  // Wireframe
  const edges = new THREE.EdgesGeometry(geo);
  const lineMat = new THREE.LineBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.8 });
  editWireframe = new THREE.LineSegments(edges, lineMat);
  editWireframe.position.copy(center);
  scene.add(editWireframe);

  transformControls.attach(editMesh);
  transformControls.setMode('translate');
}

export function detachControls() {
  transformControls.detach();
  if (editMesh) { scene.remove(editMesh); editMesh = null; }
  if (editWireframe) { scene.remove(editWireframe); editWireframe = null; }
  activeZone = null;
}

export function setTransformMode(mode) {
  if (transformControls) transformControls.setMode(mode);
}

function updateZoneFromMesh(zone, mesh) {
  const half = new THREE.Vector3(
    mesh.geometry.parameters.width / 2,
    mesh.geometry.parameters.height / 2,
    mesh.geometry.parameters.depth / 2,
  );
  zone.boundingBox = {
    min: { x: mesh.position.x - half.x, y: mesh.position.y - half.y, z: mesh.position.z - half.z },
    max: { x: mesh.position.x + half.x, y: mesh.position.y + half.y, z: mesh.position.z + half.z },
  };

  // Update camera preset to center on box
  if (!zone.cameraPosition) {
    zone.cameraPosition = { x: mesh.position.x + 5, y: 3, z: mesh.position.z + 5 };
  }
  zone.cameraTarget = { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z };
}