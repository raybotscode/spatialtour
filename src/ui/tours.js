// Tour system — predefined and AI-generated tour sequences
// Called from main.js

import { zoneStore } from '../main.js';
import { flyToZone } from '../scene/viewer.js';
import { processQuery } from '../ai/pipeline.js';
import { addMessage, showSystemMessage } from './chat.js';
import { showZoneContent } from './content.js';

const PREDEFINED_TOURS = [
  {
    id: 'executive',
    name: 'Executive Tour',
    description: 'A high-level overview for executives and investors',
    zones: ['reception', 'engineering_lab', 'boardroom'],
    duration: '5 min',
  },
  {
    id: 'sustainability',
    name: 'Sustainability Tour',
    description: 'Focus on green initiatives and environmental impact',
    zones: ['sustainability_zone', 'engineering_lab'],
    duration: '3 min',
  },
  {
    id: 'innovation',
    name: 'Innovation Tour',
    description: 'R&D, prototyping, and future developments',
    zones: ['engineering_lab', 'sustainability_zone', 'boardroom'],
    duration: '4 min',
  },
  {
    id: 'full',
    name: 'Full Facility Tour',
    description: 'Complete walkthrough of all zones',
    zones: ['reception', 'engineering_lab', 'sustainability_zone', 'boardroom'],
    duration: '8 min',
  },
];

let currentTour = null;
let tourTimeout = null;

export function initTours() {
  // Add tours button to top bar
  const topActions = document.querySelector('.top-actions');
  if (topActions) {
    const btn = document.createElement('button');
    btn.id = 'btn-tours';
    btn.className = 'icon-btn';
    btn.title = 'Guided Tours';
    btn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>';

    // Also add generate AI tour button
    const aiBtn = document.createElement('button');
    aiBtn.id = 'btn-ai-tour';
    aiBtn.className = 'icon-btn';
    aiBtn.title = 'Generate AI Tour';
    aiBtn.innerHTML = '<svg viewBox="0 0 24 24" width="18" height="18"><path fill="currentColor" d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>';

    topActions.prepend(aiBtn);
    topActions.prepend(btn);

    btn.addEventListener('click', showTourSelector);
    aiBtn.addEventListener('click', generateAITour);
  }
}

function showTourSelector() {
  let html = `
    <div class="tour-panel-overlay" id="tour-overlay">
      <div class="tour-panel">
        <div class="panel-header">
          <h3>Guided Tours</h3>
          <button class="icon-btn" onclick="document.getElementById('tour-overlay').remove()">✕</button>
        </div>
        <div class="tour-list">
  `;

  PREDEFINED_TOURS.forEach(tour => {
    html += `
      <div class="tour-card" data-tour-id="${tour.id}">
        <h4>${tour.name}</h4>
        <p>${tour.description}</p>
        <span class="tour-duration">${tour.duration} · ${tour.zones.length} zones</span>
        <button class="btn-start-tour">Start Tour</button>
      </div>
    `;
  });

  html += `
        </div>
        <div class="tour-ai-section">
          <p>Or ask the AI to create a custom tour:</p>
          <input type="text" id="tour-ai-input" placeholder="e.g., 'Create a 5-minute investor tour'" />
          <button id="tour-ai-btn" class="btn-primary">Generate</button>
        </div>
      </div>
    </div>
  `;

  const overlay = document.createElement('div');
  overlay.innerHTML = html;
  document.body.appendChild(overlay.firstElementChild);

  // Attach event listeners
  document.querySelectorAll('.btn-start-tour').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const card = btn.closest('.tour-card');
      const tourId = card?.dataset.tourId;
      const tour = PREDEFINED_TOURS.find(t => t.id === tourId);
      if (tour) startPredefinedTour(tour);
      document.getElementById('tour-overlay')?.remove();
    });
  });

  document.getElementById('tour-ai-btn')?.addEventListener('click', () => {
    const input = document.getElementById('tour-ai-input');
    if (input?.value.trim()) {
      startAITour(input.value.trim());
      document.getElementById('tour-overlay')?.remove();
    }
  });

  document.getElementById('tour-ai-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('tour-ai-btn')?.click();
    }
  });
}

function startPredefinedTour(tour) {
  const zones = tour.zones.map(id => zoneStore.getById(id)).filter(Boolean);
  if (zones.length === 0) {
    showSystemMessage('No zones found for this tour. Create zones first in the editor.');
    return;
  }

  currentTour = { ...tour, zoneIndex: 0, zones };
  showSystemMessage(`Starting tour: ${tour.name}`);

  const zone = zones[0];
  addMessage({
    role: 'assistant',
    content: `📍 Stop 1/${zones.length}: ${zone.name} — ${zone.description || ''}`,
    zone: zone.id,
    tour_step: 1,
    tour_total: zones.length,
  });
  flyToZone(zone);
  showZoneContent(zone);

  // Auto-advance
  scheduleTourNext();
}

function scheduleTourNext() {
  if (tourTimeout) clearTimeout(tourTimeout);
  tourTimeout = setTimeout(() => {
    if (!currentTour) return;
    currentTour.zoneIndex++;
    if (currentTour.zoneIndex >= currentTour.zones.length) {
      showSystemMessage('Tour complete!');
      currentTour = null;
      return;
    }

    const { tour, zoneIndex, zones } = currentTour;
    const zone = zones[zoneIndex];
    addMessage({
      role: 'assistant',
      content: `📍 Stop ${zoneIndex + 1}/${zones.length}: ${zone.name} — ${zone.description || ''}`,
      zone: zone.id,
      tour_step: zoneIndex + 1,
      tour_total: zones.length,
    });
    flyToZone(zone);
    showZoneContent(zone);
    scheduleTourNext();
  }, 5000);
}

async function generateAITour() {
  const zones = zoneStore.getAll();
  if (zones.length === 0) {
    showSystemMessage('Create some zones first before generating a tour.');
    return;
  }

  addMessage({ role: 'assistant', content: '🎯 Generating an optimal tour of this facility...' });

  await processQuery(`Create a tour visiting the key areas of this facility. The zones are: ${zones.map(z => z.id).join(', ')}`, {
    onResponse: (msg) => addMessage(msg),
    onNavigate: (zone, isTour) => {
      if (isTour) showSystemMessage('Tour route calculated.');
      else {
        flyToZone(zone);
        showZoneContent(zone);
      }
    },
    onContent: (zone) => showZoneContent(zone),
  });
}

async function startAITour(prompt) {
  const zones = zoneStore.getAll();
  if (zones.length === 0) {
    showSystemMessage('Create some zones first before generating a tour.');
    return;
  }

  await processQuery(`${prompt}. Available zones: ${zones.map(z => z.id + ' (' + z.name + ')').join(', ')}`, {
    onResponse: (msg) => addMessage(msg),
    onNavigate: (zone, isTour) => {
      if (zone) {
        flyToZone(zone);
        showZoneContent(zone);
      }
    },
    onContent: (zone) => showZoneContent(zone),
  });
}