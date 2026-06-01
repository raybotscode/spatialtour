// Chat message panel — displays conversation with AI guide
import { state, set } from '../data/store.js';

let messageCount = 0;

export function initChat() {
  const toggleBtn = document.getElementById('btn-text-input');
  const closeBtn = document.getElementById('btn-close-chat');
  const sendBtn = document.getElementById('btn-send');
  const input = document.getElementById('chat-input');
  const panel = document.getElementById('chat-panel');

  toggleBtn?.addEventListener('click', () => {
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) {
      setTimeout(() => input?.focus(), 100);
    }
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  sendBtn?.addEventListener('click', () => sendMessage());
  input?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
}

function sendMessage() {
  const input = document.getElementById('chat-input');
  const text = input?.value.trim();
  if (!text) return;

  input.value = '';
  const panel = document.getElementById('chat-panel');
  panel.classList.add('open');

  import('../ai/pipeline.js').then(({ processQuery }) => {
    processQuery(text, {
      onResponse: (msg) => addMessage(msg),
    });
  });
}

export function addMessage(msg) {
  const container = document.getElementById('chat-messages');
  if (!container) return;

  const div = document.createElement('div');
  div.className = `message ${msg.role}`;
  messageCount++;

  if (msg.intent) {
    div.dataset.intent = msg.intent;
  }

  if (msg.role === 'user') {
    div.innerHTML = `<div class="msg-content">${escapeHtml(msg.content)}</div>`;
  } else if (msg.role === 'thinking') {
    div.innerHTML = `<div class="msg-content"><span class="thinking-dots">Analyzing</span></div>`;
    div.id = 'thinking-msg';
  } else if (msg.role === 'assistant') {
    // Remove thinking message
    const thinking = document.getElementById('thinking-msg');
    if (thinking) thinking.remove();

    let html = `<div class="msg-content">${escapeHtml(msg.content)}</div>`;

    // Add zone badge if navigation happened
    if (msg.zone) {
      html = `<div class="zone-badge">📍 ${escapeHtml(msg.zone)}</div>` + html;
    }

    // Add tour step indicator
    if (msg.tour_step) {
      html = `<div class="tour-step">Tour stop ${msg.tour_step}/${msg.tour_total}</div>` + html;
    }

    // Add confidence indicator
    if (msg.confidence !== undefined) {
      const pct = Math.round(msg.confidence * 100);
      const bar = `<div class="conf-bar"><div class="conf-fill" style="width:${pct}%"></div></div>`;
      html += bar;
    }

    div.innerHTML = html;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Show a system message
export function showSystemMessage(text) {
  addMessage({ role: 'system', content: text });
}