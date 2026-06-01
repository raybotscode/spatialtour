// OpenRouter API client — sends queries, receives structured JSON commands
// Reads API key from config.js (window.__SPATIALTOUR_CONFIG)

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';

const SYSTEM_PROMPT = `You are Spatialtour AI — a knowledgeable facility guide for an interactive 3D spatial presentation platform.

KNOWN ZONES: {{ZONES_LIST}}

Always respond with valid JSON only. No markdown, no explanation outside JSON.

{
  "intent": "navigate_to_zone" | "ask_question" | "generate_tour" | "facility_overview",
  "zone": "zone_id or null",
  "confidence": 0.0-1.0,
  "response": "Natural answer for the user. Conversational, informative, professional.",
  "action": {
    "type": "navigate" | "tour" | "info" | "overview",
    "zones": ["zone_id1", "zone_id2"] | null
  }
}`;

let lastZoneContext = '';

export function setZoneContext(zoneList) {
  const zoneDescriptions = zoneList.map(z =>
    `- ${z.id}: "${z.name}" — ${z.description || 'No description'}. Tags: ${(z.tags || []).join(', ')}. Categories: ${(z.categories || []).join(', ')}`
  ).join('\n');
  lastZoneContext = zoneDescriptions || 'No zones defined yet.';
}

function getConfig() {
  const cfg = window.__SPATIALTOUR_CONFIG || {};
  return {
    apiKey: cfg.openrouterKey || '',
    model: cfg.model || 'google/gemini-2.0-flash-001',
  };
}

// Main AI query function
export async function queryAI(userInput) {
  const { apiKey, model } = getConfig();

  if (!apiKey) {
    throw new Error('OpenRouter API key not configured. Copy config.js.example to config.js and add your key.');
  }

  const system = SYSTEM_PROMPT.replace('{{ZONES_LIST}}', lastZoneContext);

  const body = {
    model,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userInput },
    ],
    response_format: { type: 'json_object' },
    max_tokens: 500,
    temperature: 0.2,
  };

  const startTime = performance.now();

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://spatialtour.app',
      'X-Title': 'Spatialtour',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenRouter ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const elapsed = performance.now() - startTime;
  const content = data.choices?.[0]?.message?.content || '{}';
  const usage = data.usage || {};

  console.log(`[AI] ${(elapsed / 1000).toFixed(2)}s | ${usage.prompt_tokens || 0}in/${usage.completion_tokens || 0}out`);

  try {
    const parsed = JSON.parse(content);
    return parsed;
  } catch (e) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { /* fall through */ }
    }
    return {
      intent: 'ask_question',
      zone: null,
      confidence: 0,
      response: content.slice(0, 300),
      action: { type: 'info', zones: null },
    };
  }
}

// Predefined tour generator
export function generateTourPrompt(tourName, zoneIds, zones) {
  const selected = zoneIds.map(id => zones.find(z => z.id === id)).filter(Boolean);
  const descriptions = selected.map(z => `- ${z.id}: "${z.name}" — ${z.description || ''}`).join('\n');

  return `Generate a guided tour called "${tourName}" visiting these zones:
${descriptions}

Return JSON:
{
  "tour_name": "string",
  "total_duration_minutes": number,
  "zones": [
    { "zone_id": "string", "zone_name": "string", "duration_minutes": number, "talking_points": ["point1", "point2"] }
  ]
}`;
}