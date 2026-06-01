// AI pipeline — orchestrates query → zone match → navigation → response
import { queryAI, setZoneContext } from './openrouter.js';
import { flyToZone } from '../scene/viewer.js';
import { zoneStore } from '../main.js';

let isProcessing = false;

// Process a user query (voice or text)
export async function processQuery(userInput, callbacks = {}) {
  if (isProcessing) return;
  isProcessing = true;

  const { onResponse, onNavigate, onContent, onError } = callbacks;

  try {
    // Pass all known zones as context
    setZoneContext(zoneStore.getAll());

    // 1. AI query
    if (onResponse) onResponse({ role: 'user', content: userInput });
    if (onResponse) onResponse({ role: 'thinking', content: 'Analyzing...' });

    const result = await queryAI(userInput);

    // 2. Parse response
    const { intent, zone, response, action, confidence } = result;

    if (onResponse) {
      onResponse({
        role: 'assistant',
        content: response || '',
        intent,
        zone,
        confidence,
      });
    }

    // 3. Execute navigation
    if (action?.type === 'navigate' && zone) {
      const targetZone = zoneStore.getById(zone);
      if (targetZone) {
        if (onNavigate) onNavigate(targetZone);
        flyToZone(targetZone);
      }
    }

    // 4. Tour generation
    if (action?.type === 'tour' && action?.zones?.length) {
      const zones = action.zones.map(id => zoneStore.getById(id)).filter(Boolean);
      if (onNavigate) onNavigate(zones[0], true);
      // Start sequential tour
      startSequentialTour(zones, 0, callbacks);
    }

    // 5. Show zone content if relevant
    if (zone) {
      const targetZone = zoneStore.getById(zone);
      if (targetZone && targetZone.content && onContent) {
        onContent(targetZone);
      }
    }

  } catch (err) {
    console.error('AI pipeline error:', err);
    if (onError) onError(err);
    if (onResponse) {
      onResponse({
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        intent: 'error',
      });
    }
  } finally {
    isProcessing = false;
  }
}

// Sequential tour: visit each zone with auto-advance
function startSequentialTour(zones, index, callbacks) {
  if (index >= zones.length) return;
  const zone = zones[index];
  if (!zone) return;

  const { onResponse } = callbacks;

  flyToZone(zone, 1.5).then(() => {
    if (onResponse) {
      const talkingPoint = zone.talkingPoints?.[0] || `This is ${zone.name}. ${zone.description || ''}`;
      onResponse({
        role: 'assistant',
        content: talkingPoint,
        tour_step: index + 1,
        tour_total: zones.length,
        zone: zone.id,
        intent: 'tour_step',
      });
    }

    // Auto-advance after delay
    setTimeout(() => {
      startSequentialTour(zones, index + 1, callbacks);
    }, 4000);
  });
}