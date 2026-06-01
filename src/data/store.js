// Simple state store — holds app-wide mutable state

export const state = {
  mode: 'explore', // 'explore' | 'edit' | 'tour'
  isAdmin: false,
  isSpeaking: false,
  isListening: false,
  currentZoneId: null,
  activeTourId: null,
  splatLoaded: false,
  splatUrl: null,
};

const listeners = {};

export function on(key, fn) {
  (listeners[key] = listeners[key] || []).push(fn);
}

export function set(key, value) {
  state[key] = value;
  (listeners[key] || []).forEach(fn => fn(value, key));
}

export function get(key) {
  return state[key];
}

// Save/load zones and config to localStorage for MVP
export function persistZones(zones) {
  try {
    localStorage.setItem('spatialtour_zones', JSON.stringify(zones));
  } catch (e) { /* quota exceeded, ignore */ }
}

export function loadPersistedZones() {
  try {
    const raw = localStorage.getItem('spatialtour_zones');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

export function persistSplatUrl(url) {
  if (url) localStorage.setItem('spatialtour_splat', url);
}

export function loadPersistedSplatUrl() {
  return localStorage.getItem('spatialtour_splat') || null;
}