// ═══════════════════════════════════════════
//  CyberGuard Extension — popup.js
// ═══════════════════════════════════════════

const HF_URL    = 'https://gebriyan-cyberguard.hf.space/predict';
const LOCAL_URL = 'http://localhost:5000/predict';

const LABEL_META = {
  'Abusive':     { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   icon: '⚡', desc: 'Kata kasar / makian' },
  'Normal':      { color: '#00ff88', bg: 'rgba(0,255,136,0.10)',   icon: '✓',  desc: 'Komentar aman' },
  'Hate Speech': { color: '#f97316', bg: 'rgba(249,115,22,0.12)',  icon: '☢',  desc: 'Ujaran kebencian' },
  'Harassment':  { color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', icon: '⚠',  desc: 'Pelecehan / intimidasi' },
};

function getMeta(label) {
  return LABEL_META[label] || { color: '#00ff88', bg: 'rgba(0,255,136,0.1)', icon: '?', desc: '' };
}

// ── DOM refs ──
const textInput  = document.getElementById('text-input');
const charCount  = document.getElementById('char-count');
const detectBtn  = document.getElementById('detect-btn');
const errorBox   = document.getElementById('error-box');
const errorMsg   = document.getElementById('error-msg');
const scanCard   = document.getElementById('scan-card');
const resultCard = document.getElementById('result-card');
const statusDot  = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

// ── Auto-detect API URL: lokal dulu, fallback ke HF ──
async function getApiUrl() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1000);
    await fetch('http://localhost:5000/', { signal: ctrl.signal });
    return LOCAL_URL;
  } catch {
    return HF_URL;
  }
}

// ── Check server status ──
async function checkServerStatus() {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 1000);
    await fetch('http://localhost:5000/', { signal: ctrl.signal });
    setStatus('local');
    return;
  } catch {}

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch('https://gebriyan-cyberguard.hf.space/', { signal: ctrl.signal });
    if (res.ok) { setStatus('hf'); return; }
  } catch {}

  setStatus('offline');
}

function setStatus(mode) {
  if (mode === 'local') {
    statusDot.className   = 'status-dot';
    statusText.className  = 'status-text';
    statusText.textContent = 'LOCAL';
  } else if (mode === 'hf') {
    statusDot.className   = 'status-dot';
    statusText.className  = 'status-text';
    statusText.textContent = 'HF SPACE';
  } else {
    statusDot.className   = 'status-dot offline';
    statusText.className  = 'status-text offline';
    statusText.textContent = 'OFFLINE';
  }
}

// ── Char counter ──
textInput.addEventListener('input', () => {
  const n = textInput.value.length;
  charCount.textContent = `${n} / 500`;
  charCount.classList.toggle('warn', n > 450);
});

// ── Ctrl+Enter shortcut ──
textInput.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'Enter') detect();
});

// ── Detect button ──
detectBtn.addEventListener('click', detect);

// ── Show/hide error ──
function showError(msg) {
  errorMsg.textContent = msg;
  errorBox.style.display = 'flex';
  resultCard.style.display = 'none';
}
function hideError() {
  errorBox.style.display = 'none';
}

// ── Scan animation ──
function startScan() {
  scanCard.style.display = 'block';
  const bar  = document.getElementById('scan-bar');
  const glow = document.getElementById('scan-glow');
  bar.style.width = glow.style.width = '0%';

  const stepDefs = [
    { id: 'step-1', text: 'Tokenisasi teks...',        pct: 25 },
    { id: 'step-2', text: 'Menjalankan IndoBERT...',    pct: 55 },
    { id: 'step-3', text: 'Menghitung probabilitas...', pct: 80 },
    { id: 'step-4', text: 'Menyusun hasil...',          pct: 95 },
  ];

  stepDefs.forEach(s => {
    const el = document.getElementById(s.id);
    el.className = 'scan-step';
    el.textContent = `[ ] ${s.text}`;
  });

  let i = 0;
  const interval = setInterval(() => {
    if (i > 0) {
      const prev = document.getElementById(stepDefs[i - 1].id);
      prev.textContent = `[✓] ${stepDefs[i - 1].text}`;
      prev.className = 'scan-step done';
    }
    if (i < stepDefs.length) {
      const curr = document.getElementById(stepDefs[i].id);
      curr.textContent = `[>] ${stepDefs[i].text}`;
      curr.className = 'scan-step active';
      bar.style.width = glow.style.width = stepDefs[i].pct + '%';
      i++;
    } else {
      clearInterval(interval);
    }
  }, 320);

  return interval;
}

function stopScan(intervalId) {
  clearInterval(intervalId);
  const bar  = document.getElementById('scan-bar');
  const glow = document.getElementById('scan-glow');
  bar.style.width = glow.style.width = '100%';

  const texts = ['Tokenisasi teks...', 'Menjalankan IndoBERT...', 'Menghitung probabilitas...', 'Menyusun hasil...'];
  ['step-1', 'step-2', 'step-3', 'step-4'].forEach((id, idx) => {
    const el = document.getElementById(id);
    el.textContent = `[✓] ${texts[idx]}`;
    el.className = 'scan-step done';
  });

  setTimeout(() => { scanCard.style.display = 'none'; }, 400);
}

// ── Main detect function ──
async function detect() {
  const text = textInput.value.trim();
  if (!text) { showError('Teks tidak boleh kosong.'); return; }
  hideError();
  resultCard.style.display = 'none';

  detectBtn.disabled = true;
  detectBtn.classList.add('loading');

  const scanInterval = startScan();

  try {
    const apiUrl = await getApiUrl();
    const res    = await fetch(apiUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ text }),
    });
    const data = await res.json();

    stopScan(scanInterval);

    if (!res.ok || data.error) {
      showError(data.error || 'Terjadi kesalahan pada server.');
      return;
    }

    setTimeout(() => renderResult(data), 500);

  } catch (err) {
    stopScan(scanInterval);
    showError('Tidak dapat terhubung ke server lokal maupun Hugging Face.');
  } finally {
    detectBtn.disabled = false;
    detectBtn.classList.remove('loading');
  }
}

// ── Render result ──
function renderResult(data) {
  const label = data.prediction;
  const meta  = getMeta(label);
  const circ  = 213.6;

  resultCard.style.display = 'block';
  resultCard.style.setProperty('--result-color', meta.color);
  resultCard.style.borderColor = meta.color + '40';

  document.getElementById('result-icon').textContent  = meta.icon;
  document.getElementById('result-icon').style.color  = meta.color;
  document.getElementById('result-badge').textContent = data.low_confidence ? '// UNCERTAIN' : '// DETECTED';
  document.getElementById('result-badge').style.color = meta.color;
  document.getElementById('result-label').textContent = label;
  document.getElementById('result-label').style.color = meta.color;
  document.getElementById('result-desc').textContent  = meta.desc;
  document.getElementById('model-tag').textContent    = `via ${data.model_used || 'AI'}`;

  const pct    = data.confidence || 0;
  const offset = circ - (pct / 100) * circ;
  const ring   = document.getElementById('conf-ring');
  ring.style.stroke = meta.color;
  ring.style.strokeDashoffset = circ;
  setTimeout(() => {
    ring.style.transition = 'stroke-dashoffset 0.8s ease';
    ring.style.strokeDashoffset = offset;
  }, 50);
  const confPct = document.getElementById('conf-pct');
  confPct.textContent = pct + '%';
  confPct.style.color = meta.color;

  const container = document.getElementById('prob-bars');
  container.innerHTML = '';
  const probs  = data.probabilities || {};
  const sorted = Object.keys(probs).sort((a, b) => (probs[b] || 0) - (probs[a] || 0));
  sorted.forEach(l => {
    const p   = probs[l] || 0;
    const m   = getMeta(l);
    const row = document.createElement('div');
    row.className = 'prob-row';
    row.innerHTML = `
      <span class="prob-name">${l}</span>
      <div class="prob-track">
        <div class="prob-fill" style="width:0%;background:${m.color}" data-target="${p}"></div>
      </div>
      <span class="prob-pct" style="color:${m.color}">${p}%</span>`;
    container.appendChild(row);
  });
  requestAnimationFrame(() => {
    document.querySelectorAll('.prob-fill').forEach(el => {
      el.style.width = el.dataset.target + '%';
    });
  });
}

// ── Open web link ──
document.getElementById('open-web').addEventListener('click', async e => {
  e.preventDefault();
  const apiUrl = await getApiUrl();
  const webUrl = apiUrl.includes('localhost') 
    ? 'http://localhost:5000' 
    : 'https://gebriyan-cyberguard.hf.space';
  chrome.tabs.create({ url: webUrl });
});

// ── On load ──
document.addEventListener('DOMContentLoaded', async () => {
  checkServerStatus();

  const result = await chrome.storage.local.get('selectedText');
  if (result.selectedText) {
    textInput.value = result.selectedText;
    const n = textInput.value.length;
    charCount.textContent = `${n} / 500`;
    detect();
    chrome.storage.local.remove('selectedText');
  }
});