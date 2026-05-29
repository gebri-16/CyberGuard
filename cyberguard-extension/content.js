// ═══════════════════════════════════════════
//  CyberGuard Extension — content.js
//  Detects selected text on any webpage
// ═══════════════════════════════════════════

const API_URL = 'http://localhost:5000/predict';

const LABEL_META = {
  'Abusive':     { color: '#ef4444', icon: '⚡', desc: 'Kata kasar / makian' },
  'Normal':      { color: '#00ff88', icon: '✓',  desc: 'Komentar aman' },
  'Hate Speech': { color: '#f97316', icon: '☢',  desc: 'Ujaran kebencian' },
  'Harassment':  { color: '#a78bfa', icon: '⚠',  desc: 'Pelecehan / intimidasi' },
};

function getMeta(label) {
  return LABEL_META[label] || { color: '#00ff88', icon: '?', desc: '' };
}

// ── State ──
let tooltipEl   = null;
let lastText    = '';
let detectTimer = null;

// ── Remove existing tooltip ──
function removeTooltip() {
  if (tooltipEl) {
    tooltipEl.remove();
    tooltipEl = null;
  }
}

// ── Build tooltip HTML ──
function createTooltip(x, y) {
  removeTooltip();

  const el = document.createElement('div');
  el.id = 'cyberguard-tooltip';
  el.innerHTML = `
    <div class="cg-popup">
      <!-- Header -->
      <div class="cg-header">
        <div class="cg-brand">
          <div class="cg-shield">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 2L3 7v6c0 5.25 3.75 10.15 9 11.25C17.25 23.15 21 18.25 21 13V7l-9-5z"/>
              <path d="M9 12l2 2 4-4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="cg-title">CYBER<span>GUARD</span></div>
        </div>
        <button class="cg-close" id="cg-close-btn" title="Tutup">✕</button>
      </div>

      <!-- Loading -->
      <div class="cg-loading" id="cg-loading">
        <div class="cg-spinner"></div>
        <span class="cg-loading-text">Menganalisis teks...</span>
      </div>
      <div class="cg-scan-bar-wrap" id="cg-scan-wrap">
        <div class="cg-scan-bar" id="cg-scan-bar" style="width:0%"></div>
      </div>

      <!-- Error -->
      <div class="cg-error" id="cg-error">
        <span>⚠</span>
        <span id="cg-error-msg">Tidak dapat terhubung ke server.</span>
      </div>

      <!-- Result -->
      <div class="cg-result" id="cg-result">
        <div class="cg-result-main">
          <div class="cg-result-icon" id="cg-icon"></div>
          <div class="cg-result-info">
            <div class="cg-result-badge" id="cg-badge"></div>
            <div class="cg-result-label" id="cg-label"></div>
            <div class="cg-result-desc"  id="cg-desc"></div>
          </div>
          <div>
            <div class="cg-conf-badge" id="cg-conf"></div>
            <div class="cg-conf-label">conf</div>
          </div>
        </div>

        <div class="cg-divider"></div>
        <div class="cg-prob-title">Distribusi Probabilitas</div>
        <div id="cg-prob-bars"></div>

        <div class="cg-footer">
          <span class="cg-model-tag" id="cg-model-tag"></span>
          <button class="cg-open-btn" id="cg-open-btn">
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
            Buka Web
          </button>
        </div>
      </div>

      <div class="cg-arrow"></div>
    </div>
  `;

  // Position tooltip above selection
  document.body.appendChild(el);

  const popup   = el.querySelector('.cg-popup');
  const popW    = 260;
  const popH    = popup.offsetHeight || 120;
  const margin  = 10;

  let left = x - popW / 2;
  let top  = y - popH - margin;

  // Clamp horizontally
  left = Math.max(margin, Math.min(left, window.innerWidth - popW - margin));

  // If not enough space above, show below
  if (top < window.scrollY + margin) {
    top = y + margin;
    el.querySelector('.cg-arrow').style.display = 'none';
  }

  el.style.left = left + 'px';
  el.style.top  = (top + window.scrollY) + 'px';

  // Close button
  el.querySelector('#cg-close-btn').addEventListener('click', e => {
    e.stopPropagation();
    removeTooltip();
  });

  // Open web button
  el.querySelector('#cg-open-btn').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_WEB' });
  });

  tooltipEl = el;
  return el;
}

// ── Animate scan bar ──
function animateScanBar(el) {
  const bar = el.querySelector('#cg-scan-bar');
  let pct   = 0;
  const id  = setInterval(() => {
    pct = Math.min(pct + Math.random() * 15, 90);
    bar.style.width = pct + '%';
  }, 200);
  return id;
}

// ── Render result ──
function renderResult(el, data) {
  const label = data.prediction;
  const meta  = getMeta(label);
  const popup = el.querySelector('.cg-popup');

  // Hide loading
  el.querySelector('#cg-loading').style.display  = 'none';
  el.querySelector('#cg-scan-wrap').style.display = 'none';

  // Show result
  const resultDiv = el.querySelector('#cg-result');
  resultDiv.style.display = 'block';

  // Color the border
  popup.style.borderColor = meta.color + '50';

  el.querySelector('#cg-icon').textContent  = meta.icon;
  el.querySelector('#cg-icon').style.color  = meta.color;
  el.querySelector('#cg-badge').textContent = data.low_confidence ? '// UNCERTAIN' : '// DETECTED';
  el.querySelector('#cg-badge').style.color = meta.color;
  el.querySelector('#cg-label').textContent = label;
  el.querySelector('#cg-label').style.color = meta.color;
  el.querySelector('#cg-desc').textContent  = meta.desc;
  el.querySelector('#cg-conf').textContent  = (data.confidence || 0) + '%';
  el.querySelector('#cg-conf').style.color  = meta.color;
  el.querySelector('#cg-model-tag').textContent = `via ${data.model_used || 'AI'}`;

  // Prob bars
  const container = el.querySelector('#cg-prob-bars');
  container.innerHTML = '';
  const probs  = data.probabilities || {};
  const sorted = Object.keys(probs).sort((a, b) => (probs[b] || 0) - (probs[a] || 0));
  sorted.forEach(l => {
    const p = probs[l] || 0;
    const m = getMeta(l);
    const row = document.createElement('div');
    row.className = 'cg-prob-row';
    row.innerHTML = `
      <span class="cg-prob-name">${l}</span>
      <div class="cg-prob-track">
        <div class="cg-prob-fill" style="width:0%;background:${m.color}" data-target="${p}"></div>
      </div>
      <span class="cg-prob-pct" style="color:${m.color}">${p}%</span>`;
    container.appendChild(row);
  });

  requestAnimationFrame(() => {
    el.querySelectorAll('.cg-prob-fill').forEach(bar => {
      bar.style.width = bar.dataset.target + '%';
    });
  });

  // Reposition after content is rendered
  repositionTooltip(el);
}

// ── Reposition after content renders ──
function repositionTooltip(el) {
  setTimeout(() => {
    const rect   = el.getBoundingClientRect();
    const margin = 10;
    let left = parseFloat(el.style.left);
    let top  = parseFloat(el.style.top) - window.scrollY;

    const newH  = el.querySelector('.cg-popup').offsetHeight;
    const newTop = top - (newH - 120); // adjust for content growth

    if (newTop > margin) {
      el.style.top = (newTop + window.scrollY) + 'px';
    }

    // Clamp horizontal again
    left = Math.max(margin, Math.min(left, window.innerWidth - rect.width - margin));
    el.style.left = left + 'px';
  }, 50);
}

// ── Show error ──
function renderError(el, msg) {
  el.querySelector('#cg-loading').style.display  = 'none';
  el.querySelector('#cg-scan-wrap').style.display = 'none';

  const errDiv = el.querySelector('#cg-error');
  el.querySelector('#cg-error-msg').textContent = msg;
  errDiv.style.display = 'flex';
}

// ── Main: detect selected text ──
async function detectSelected(text, x, y) {
  if (text === lastText && tooltipEl) return;
  lastText = text;

  const el     = createTooltip(x, y);
  const scanId = animateScanBar(el);

  try {
    const res  = await fetch(API_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    const data = await res.json();
    clearInterval(scanId);
    el.querySelector('#cg-scan-bar').style.width = '100%';

    if (!res.ok || data.error) {
      renderError(el, data.error || 'Terjadi kesalahan pada server.');
      return;
    }

    setTimeout(() => renderResult(el, data), 200);

  } catch {
    clearInterval(scanId);
    renderError(el, 'Tidak dapat terhubung ke server Flask (localhost:5000).');
  }
}

// ── Listen for mouseup: check selected text ──
document.addEventListener('mouseup', e => {
  // Don't trigger inside our own tooltip
  if (tooltipEl && tooltipEl.contains(e.target)) return;

  clearTimeout(detectTimer);
  detectTimer = setTimeout(() => {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';

    if (!text || text.length < 3) {
      // Only remove if clicked outside
      if (tooltipEl && !tooltipEl.contains(e.target)) {
        removeTooltip();
        lastText = '';
      }
      return;
    }

    if (text.length > 500) {
      // Truncate silently
      const trimmed = text.slice(0, 500);
      detectSelected(trimmed, e.clientX, e.clientY);
      return;
    }

    detectSelected(text, e.clientX, e.clientY);
  }, 400); // slight debounce to avoid firing on every click
});

// ── Close tooltip on Escape ──
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    removeTooltip();
    lastText = '';
  }
});

// ── Listen for messages from background (context menu) ──
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'ANALYZE_SELECTION') {
    const selection = window.getSelection();
    const text = selection ? selection.toString().trim() : '';
    if (text) {
      const range = selection.getRangeAt(0);
      const rect  = range.getBoundingClientRect();
      detectSelected(text, rect.left + rect.width / 2, rect.top);
    }
  }
});