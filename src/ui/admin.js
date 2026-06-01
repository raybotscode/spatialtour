// Admin/editor panel — zone CRUD, tour creation, splat upload
import { zoneStore } from '../main.js';
import { createDefaultZone } from '../data/zones.js';
import { captureCurrentCamera, flyToZone } from '../scene/viewer.js';
import { initEditor, attachControls, detachControls, setTransformMode } from '../scene/editor.js';
import { set, state } from '../data/store.js';
import { persistZones } from '../data/store.js';
import { showZoneContent } from './content.js';

export function initAdminUI() {
  const adminBtn = document.getElementById('btn-admin');
  const editorPanel = document.getElementById('editor-panel');
  const closeBtn = document.getElementById('btn-close-editor');
  const addBtn = document.getElementById('btn-add-zone');
  const zoneList = document.getElementById('zone-list');

  // Initialize editor if not already
  import('../main.js').then(m => {
    if (m.zoneStore) initEditor(m.zoneStore);
  });

  adminBtn?.addEventListener('click', () => {
    editorPanel.classList.toggle('hidden');
    if (!editorPanel.classList.contains('hidden')) {
      set('mode', 'edit');
      renderZoneList();
    } else {
      set('mode', 'explore');
      detachControls();
    }
  });

  closeBtn?.addEventListener('click', () => {
    editorPanel.classList.add('hidden');
    set('mode', 'explore');
    detachControls();
  });

  addBtn?.addEventListener('click', async () => {
    const cam = captureCurrentCamera();
    const zone = createDefaultZone('New Zone', cam.cameraPosition || null);
    zoneStore.add(zone);
    persistZones(zoneStore.toJSON());
    renderZoneList();
    attachControls(zone, zoneStore);
  });

  // Mode toggle buttons
  document.addEventListener('click', (e) => {
    const modeBtn = e.target.closest('[data-transform-mode]');
    if (modeBtn) {
      setTransformMode(modeBtn.dataset.transformMode);
    }
  });
}

export function renderZoneList() {
  const list = document.getElementById('zone-list');
  if (!list) return;

  const zones = zoneStore.getAll();

  if (zones.length === 0) {
    list.innerHTML = `<div class="zone-empty">No zones yet. Click "+ Add Zone" to create one.</div>`;
    return;
  }

  list.innerHTML = zones.map(zone => `
    <div class="zone-list-item ${zone.id === state.currentZoneId ? 'selected' : ''}" data-zone-id="${zone.id}">
      <div class="zone-item-header">
        <span class="zone-color-dot" style="background:${zone.color || '#4fc3f7'}"></span>
        <span class="zone-item-name">${escapeHtml(zone.name)}</span>
      </div>
      <div class="zone-item-actions">
        <button class="zone-action fly-btn" data-action="fly">📍 Fly</button>
        <button class="zone-action edit-btn" data-action="edit">✏️ Edit</button>
        <button class="zone-action delete-btn" data-action="delete">🗑️</button>
      </div>
      <div class="zone-item-details">
        <label>Name: <input type="text" class="zone-field-name" value="${escapeHtml(zone.name)}" /></label>
        <label>Description: <textarea class="zone-field-desc" rows="2">${escapeHtml(zone.description || '')}</textarea></label>
        <label>Tags: <input type="text" class="zone-field-tags" value="${(zone.tags || []).join(', ')}" placeholder="comma, separated" /></label>
        <label>Color: <input type="color" class="zone-field-color" value="${zone.color || '#4fc3f7'}" /></label>
        <details class="zone-advanced">
          <summary>Content & AI</summary>
          <label>AI Instructions: <textarea class="zone-field-ai" rows="2">${escapeHtml(zone.aiInstructions || '')}</textarea></label>
          <label>Images (URLs, one per line): <textarea class="zone-field-images" rows="2">${(zone.content?.images || []).join('\n')}</textarea></label>
          <label>Documents (URLs, one per line): <textarea class="zone-field-docs" rows="2">${(zone.content?.documents || []).join('\n')}</textarea></label>
          <label>Video URLs (one per line): <textarea class="zone-field-videos" rows="2">${(zone.content?.videos || []).join('\n')}</textarea></label>
        </details>
      </div>
    </div>
  `).join('');

  // Attach event listeners
  list.querySelectorAll('.zone-action').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const item = btn.closest('.zone-list-item');
      const zoneId = item?.dataset.zoneId;
      const zone = zoneStore.getById(zoneId);
      if (!zone) return;
      const action = btn.dataset.action;

      if (action === 'fly') {
        flyToZone(zone);
        showZoneContent(zone);
      } else if (action === 'edit') {
        attachControls(zone, zoneStore);
        zoneStore.select(zoneId);
        set('currentZoneId', zoneId);
        renderZoneList();
      } else if (action === 'delete') {
        if (confirm(`Delete zone "${zone.name}"?`)) {
          zoneStore.remove(zoneId);
          persistZones(zoneStore.toJSON());
          detachControls();
          renderZoneList();
        }
      }
    });
  });

  // Auto-save on field changes
  list.querySelectorAll('.zone-field-name, .zone-field-desc, .zone-field-tags, .zone-field-color, .zone-field-ai, .zone-field-images, .zone-field-docs, .zone-field-videos').forEach(field => {
    field.addEventListener('change', (e) => {
      const item = field.closest('.zone-list-item');
      const zoneId = item?.dataset.zoneId;
      const zone = zoneStore.getById(zoneId);
      if (!zone) return;

      if (field.classList.contains('zone-field-name')) zone.name = field.value;
      if (field.classList.contains('zone-field-desc')) zone.description = field.value;
      if (field.classList.contains('zone-field-tags')) zone.tags = field.value.split(',').map(t => t.trim()).filter(Boolean);
      if (field.classList.contains('zone-field-color')) zone.color = field.value;
      if (field.classList.contains('zone-field-ai')) zone.aiInstructions = field.value;
      if (field.classList.contains('zone-field-images')) zone.content.images = field.value.split('\n').filter(Boolean);
      if (field.classList.contains('zone-field-docs')) zone.content.documents = field.value.split('\n').filter(Boolean);
      if (field.classList.contains('zone-field-videos')) zone.content.videos = field.value.split('\n').filter(Boolean);

      persistZones(zoneStore.toJSON());
      import('../scene/viewer.js').then(m => m.zoneRenderer?.update(zoneStore));
    });
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}