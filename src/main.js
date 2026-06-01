// Spatialtour — main entry point
import { initViewport, loadSplat } from './scene/viewer.js';
import { initEditor } from './scene/editor.js';
import { ZoneStore, createDefaultZone } from './data/zones.js';
import { state, on, persistZones, loadPersistedZones, loadPersistedSplatUrl } from './data/store.js';
import { initChat, showSystemMessage } from './ui/chat.js';
import { initContent, showZoneContent } from './ui/content.js';
import { initAdminUI, renderZoneList } from './ui/admin.js';
import { startListening, isVoiceSupported } from './voice/input.js';
import { processQuery } from './ai/pipeline.js';
import { addMessage } from './ui/chat.js';

export let zoneStore;
let viewer;

// Load sample zones for demo
const DEMO_ZONES = [
  {
    id: 'reception',
    name: 'Main Reception',
    description: 'Welcome area with check-in desk and digital signage. The entrance to the facility showcasing company achievements.',
    tags: ['entrance', 'reception', 'welcome'],
    categories: ['common', 'visitor'],
    boundingBox: { min: { x: -5, y: -0.5, z: 3.5 }, max: { x: -1.5, y: 3, z: 5.5 } },
    cameraPosition: { x: -3.5, y: 2.5, z: 8 },
    cameraTarget: { x: -3.5, y: 1, z: 4.5 },
    color: '#4fc3f7',
    content: {
      images: [],
      documents: [],
      videos: [],
      urls: [],
    },
    aiInstructions: 'Welcome area. Describe the modern entrance and visitor experience.',
  },
  {
    id: 'engineering_lab',
    name: 'Engineering Lab',
    description: 'Research and development area with prototyping equipment and workstations. The central table holds display equipment.',
    tags: ['lab', 'engineering', 'r&d', 'workbench'],
    categories: ['production', 'innovation'],
    boundingBox: { min: { x: -2.5, y: -0.5, z: -2.5 }, max: { x: 2.5, y: 2.5, z: 2.5 } },
    cameraPosition: { x: 5, y: 2.5, z: 5 },
    cameraTarget: { x: 0, y: 1, z: 0 },
    color: '#ff7043',
    content: {
      images: [],
      documents: ['https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/test.pdf'],
      videos: [],
      urls: [],
    },
    aiInstructions: 'R&D lab with prototyping equipment. Emphasise innovation and quality standards.',
  },
  {
    id: 'sustainability_zone',
    name: 'Sustainability Programme',
    description: 'Green energy and environmental initiatives display. Features solar panel data and waste reduction metrics.',
    tags: ['sustainability', 'green', 'solar', 'environment'],
    categories: ['innovation', 'exhibition'],
    boundingBox: { min: { x: 2.5, y: -0.5, z: 3.5 }, max: { x: 5.5, y: 3, z: 5.5 } },
    cameraPosition: { x: 6, y: 2.5, z: 7 },
    cameraTarget: { x: 4, y: 1.5, z: 4.5 },
    color: '#66bb6a',
    content: {
      images: [],
      documents: [],
      videos: ['https://www.w3schools.com/html/mov_bbb.mp4'],
      urls: [],
    },
    aiInstructions: 'Sustainability exhibit. Highlight environmental achievements and green initiatives.',
  },
  {
    id: 'boardroom',
    name: 'Executive Boardroom',
    description: 'Premium meeting space for executive presentations and client meetings. Video conferencing enabled.',
    tags: ['meeting', 'executive', 'presentation', 'boardroom'],
    categories: ['common', 'executive'],
    boundingBox: { min: { x: -5.5, y: -0.5, z: -5.5 }, max: { x: -2.5, y: 3, z: -2.5 } },
    cameraPosition: { x: -6, y: 2.5, z: -7 },
    cameraTarget: { x: -4, y: 1.5, z: -4 },
    color: '#ab47bc',
    content: {
      images: [],
      documents: [],
      videos: [],
      urls: [],
    },
    aiInstructions: 'Executive meeting space. Professional, high-end presentation environment.',
  },
];

async function init() {
  // Initialize zone store
  zoneStore = new ZoneStore();

  // Load persisted zones or use demo zones
  const saved = loadPersistedZones();
  if (saved?.length) {
    zoneStore.load(saved);
  } else {
    zoneStore.load(DEMO_ZONES);
    persistZones(DEMO_ZONES);
  }

  // Initialize 3D viewport
  const container = document.getElementById('viewport');
  viewer = await initViewport(container);

  // Initialize zone overlay
  viewer.zoneRenderer._store = zoneStore;
  viewer.zoneRenderer.update(zoneStore);

  // Initialize UI
  initChat();
  initContent();
  initAdminUI();

  // Pass zoneStore to AI
  const { setZoneContext } = await import('./ai/openrouter.js');
  setZoneContext(zoneStore.getAll());

  // Voice button
  const voiceBtn = document.getElementById('btn-voice');
  voiceBtn?.addEventListener('click', () => {
    if (!isVoiceSupported()) {
      addMessage({ role: 'system', content: 'Voice input is not supported in this browser. Please type your question instead.' });
      document.getElementById('chat-panel')?.classList.add('open');
      return;
    }
    startListening({
      onResponse: (msg) => addMessage(msg),
      onNavigate: (zone) => {
        showZoneContent(zone);
        addMessage({ role: 'assistant', content: `📍 Navigating to ${zone.name}...`, zone: zone.id });
      },
      onContent: (zone) => showZoneContent(zone),
      onError: (err) => {
        addMessage({ role: 'system', content: `Voice error: ${err}. Try typing instead.` });
      },
    });
  });

  // --- Splat file loading ---
  // Auto-load the demo splat (kept small for fast loading)
  // Replace with your own .splat or .ply file URL anytime
  const DEMO_SPLAT = '/samples/demo-room.splat';
  const savedUrl = loadPersistedSplatUrl();
  if (savedUrl && savedUrl !== DEMO_SPLAT) {
    await loadSplat(savedUrl);
  } else {
    await loadSplat(DEMO_SPLAT);
  }

  // Update loading screen
  const loading = document.getElementById('loading-screen');
  if (loading && !state.splatLoaded) {
    // Already showing, handled in loadSplat
  }

  // Watch for splat loaded
  on('splatLoaded', (loaded) => {
    if (loaded) {
      const loading = document.getElementById('loading-screen');
      if (loading) {
        loading.classList.add('fade-out');
        setTimeout(() => loading.remove(), 800);
      }
    }
  });
}

function showFileUploadPrompt() {
  const loading = document.getElementById('loading-screen');
  const statusEl = document.getElementById('loading-status');
  if (!loading || !statusEl) return;

  statusEl.innerHTML = `
    <div class="upload-prompt">
      <p>Drop a .splat or .ply file here, or enter a URL:</p>
      <div class="upload-row">
        <input type="text" id="splat-url-input" placeholder="https://example.com/scene.splat" />
        <button id="splat-url-btn" class="btn-primary">Load</button>
      </div>
      <div id="splat-drop-zone" class="drop-zone">Or drag & drop a file</div>
    </div>
  `;

  const urlBtn = document.getElementById('splat-url-btn');
  const urlInput = document.getElementById('splat-url-input');
  const dropZone = document.getElementById('splat-drop-zone');

  urlBtn?.addEventListener('click', async () => {
    const url = urlInput?.value.trim();
    if (!url) return;
    statusEl.innerHTML = '<p>Loading 3D scene...</p>';
    const ok = await loadSplat(url);
    if (ok) {
      const { persistSplatUrl } = await import('./data/store.js');
      persistSplatUrl(url);
    }
  });

  // Drag and drop
  dropZone?.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
  });

  dropZone?.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
  });

  dropZone?.addEventListener('drop', async (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    // Upload file to a temporary location — for MVP we read as blob URL
    const url = URL.createObjectURL(file);
    statusEl.innerHTML = `<p>Loading ${file.name}...</p>`;
    const ok = await loadSplat(url);
    if (ok) {
      const { persistSplatUrl } = await import('./data/store.js');
      persistSplatUrl(url);
      dropZone.innerHTML = `<p>✅ Loaded ${file.name}</p>`;
    }
  });
}

// Handle tour generation UI
import('./ui/tours.js').then(m => m.initTours());

// Start
init().catch(console.error);

// Expose for debugging
window.__spatialtour = { zoneStore, state };