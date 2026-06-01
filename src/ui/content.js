// Content panel — displays zone media, docs, statistics
export function initContent() {
  // Initially hidden, shown when AI navigates to a zone with content
}

export function showZoneContent(zone) {
  const panel = document.getElementById('content-panel');
  const body = document.getElementById('content-body');
  if (!panel || !body) return;

  if (!zone?.content) {
    panel.classList.add('hidden');
    return;
  }

  const content = zone.content;
  let html = `<div class="content-header">📋 ${escapeHtml(zone.name)}</div>`;
  html += `<div class="content-description">${escapeHtml(zone.description || '')}</div>`;

  // Images
  if (content.images?.length) {
    html += `<div class="content-section"><h4>Images</h4><div class="content-grid">`;
    content.images.forEach(img => {
      html += `<img src="${escapeHtml(img)}" class="content-image" loading="lazy" />`;
    });
    html += `</div></div>`;
  }

  // Videos
  if (content.videos?.length) {
    html += `<div class="content-section"><h4>Videos</h4>`;
    content.videos.forEach(vid => {
      html += `<video src="${escapeHtml(vid)}" controls class="content-video"></video>`;
    });
    html += `</div>`;
  }

  // Documents
  if (content.documents?.length) {
    html += `<div class="content-section"><h4>Documents</h4><ul class="content-docs">`;
    content.documents.forEach(doc => {
      html += `<li><a href="${escapeHtml(doc)}" target="_blank">📄 ${escapeHtml(doc.split('/').pop() || doc)}</a></li>`;
    });
    html += `</ul></div>`;
  }

  // URLs
  if (content.urls?.length) {
    html += `<div class="content-section"><h4>Links</h4><ul class="content-docs">`;
    content.urls.forEach(url => {
      html += `<li><a href="${escapeHtml(url)}" target="_blank">🔗 ${escapeHtml(url)}</a></li>`;
    });
    html += `</ul></div>`;
  }

  body.innerHTML = html;
  panel.classList.remove('hidden');
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}