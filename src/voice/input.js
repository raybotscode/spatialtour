// Voice input — Web Speech API with API-powered fallback
import { state, set } from '../data/store.js';
import { processQuery } from '../ai/pipeline.js';
import { addMessage } from '../ui/chat.js';

let recognition = null;
let isListening = false;
let manualMode = false; // true when user explicitly opened text input

// Check browser support
export function isVoiceSupported() {
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

export function isChrome() {
  return /Chrome|Chromium/i.test(navigator.userAgent);
}

export async function startListening(callbacks) {
  if (isListening) return;
  if (!isVoiceSupported()) {
    console.warn('Voice not supported in this browser');
    return;
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = isChrome(); // Safari doesn't support interimResults
  recognition.lang = 'en-US';
  recognition.maxAlternatives = 1;

  const transcriptEl = document.getElementById('voice-transcript');
  const indicator = document.getElementById('voice-indicator');

  isListening = true;
  set('isListening', true);
  indicator.classList.remove('hidden');
  transcriptEl.textContent = 'Listening...';

  let finalTranscript = '';

  recognition.onresult = (event) => {
    let interim = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) {
        finalTranscript += result[0].transcript;
      } else {
        interim += result[0].transcript;
      }
    }
    transcriptEl.textContent = finalTranscript + interim;
  };

  recognition.onerror = (event) => {
    console.warn('Voice error:', event.error);
    stopListening();
    // Fall back to text input
    if (callbacks?.onError) callbacks.onError(event.error);
  };

  recognition.onend = () => {
    stopListening();
    if (finalTranscript.trim()) {
      processQuery(finalTranscript.trim(), callbacks);
    } else if (manualMode) {
      // User stopped without speaking — show text input
    }
  };

  try {
    recognition.start();
  } catch (e) {
    console.error('Failed to start voice:', e);
    isListening = false;
    set('isListening', false);
    indicator.classList.add('hidden');
  }
}

export function stopListening() {
  if (recognition) {
    try { recognition.abort(); } catch { /* ignore */ }
    recognition = null;
  }
  isListening = false;
  set('isListening', false);
  const indicator = document.getElementById('voice-indicator');
  if (indicator) indicator.classList.add('hidden');
}

export function isCurrentlyListening() {
  return isListening;
}