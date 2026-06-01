// Zone overlay rendering — translucent boxes + CSS2D labels
import * as THREE from 'three';
import { CSS2DRenderer, CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { state, on } from '../data/store.js';

export class ZoneRenderer {
  constructor(scene, camera, webglRenderer) {
    this.scene = scene;
    this.camera = camera;
    this._zones = [];
    this._group = new THREE.Group();
    this._labelGroup = new THREE.Group();
    this._selectedId = null;

    // CSS2D label renderer
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.setSize(
      webglRenderer.domElement.parentElement.clientWidth,
      webglRenderer.domElement.parentElement.clientHeight
    );
    this.labelRenderer.domElement.style.position = 'absolute';
    this.labelRenderer.domElement.style.top = '0';
    this.labelRenderer.domElement.style.pointerEvents = 'none';
    webglRenderer.domElement.parentElement.appendChild(this.labelRenderer.domElement);

    scene.add(this._group);
    scene.add(this._labelGroup);

    // Listen for selection changes
    on('mode', (mode) => {
      this._group.visible = mode === 'edit';
      this._labelGroup.visible = mode === 'edit';
    });
  }

  update(zoneStore) {
    // Clear old
    while (this._group.children.length) {
      this._group.remove(this._group.children[0]);
    }
    while (this._labelGroup.children.length) {
      this._labelGroup.remove(this._labelGroup.children[0]);
    }

    const zones = zoneStore.getAll();
    zones.forEach(zone => this._addZoneMesh(zone));
  }

  _addZoneMesh(zone) {
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

    const color = new THREE.Color(zone.color || '#4fc3f7');
    const isSelected = zone.id === state.currentZoneId;

    // Fill box (semi-transparent)
    const fillGeo = new THREE.BoxGeometry(size.x, size.y, size.z);
    const fillMat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isSelected ? 0.25 : 0.1,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(fillGeo, fillMat);
    mesh.position.copy(center);
    mesh.userData.zoneId = zone.id;
    this._group.add(mesh);

    // Wireframe outline
    const edges = new THREE.EdgesGeometry(fillGeo);
    const lineMat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: isSelected ? 0.9 : 0.5,
    });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    wireframe.position.copy(center);
    wireframe.userData.zoneId = zone.id;
    this._group.add(wireframe);

    // CSS2D label
    const div = document.createElement('div');
    div.className = 'zone-label';
    div.textContent = zone.name;
    div.style.borderColor = color.getStyle();
    div.style.pointerEvents = 'auto';
    div.style.cursor = 'pointer';
    div.dataset.zoneId = zone.id;
    div.addEventListener('click', (e) => {
      e.stopPropagation();
      // Fly to zone when label clicked
      import('./viewer.js').then(m => m.flyToZone(zone));
    });

    const label = new CSS2DObject(div);
    label.position.set(center.x, bb.max.y + 0.5, center.z);
    label.userData.zoneId = zone.id;
    this._labelGroup.add(label);
  }

  setSelected(id) {
    this._selectedId = id;
    // Rebuild to update opacity
    // (called from editor when selection changes)
    const store = this._store;
    if (store) this.update(store);
  }

  // Update label positions each frame (CSS2DRenderer handles this)
  updateLabels(camera, renderer) {
    this.labelRenderer.render(this.scene, this.camera);

    // Sync label renderer size
    const container = renderer.domElement.parentElement;
    this.labelRenderer.setSize(container.clientWidth, container.clientHeight);
  }

  // Highlight a zone temporarily
  highlightZone(zoneId, duration = 2000) {
    const meshes = this._group.children.filter(c => c.userData.zoneId === zoneId);
    meshes.forEach(m => {
      if (m.material) {
        m.material.opacity = 0.4;
        setTimeout(() => { m.material.opacity = 0.1; }, duration);
      }
    });
  }
}