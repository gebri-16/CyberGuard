// ═══════════════════════════════════════════
//  CyberGuard Extension — background.js
// ═══════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id:       'cyberguard-analyze',
    title:    '🛡️ CyberGuard: Analisis Teks Ini',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== 'cyberguard-analyze') return;

  const selectedText = info.selectionText ? info.selectionText.trim() : '';
  if (!selectedText || !tab?.id) return;

  chrome.tabs.sendMessage(tab.id, {
    type: 'ANALYZE_SELECTION',
  }).catch(() => {
    chrome.storage.local.set({ selectedText: selectedText.slice(0, 500) }, () => {
      chrome.action.openPopup();
    });
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'OPEN_WEB') {
    // Cek lokal dulu, kalau tidak ada buka HF
    fetch('http://localhost:5000/', { signal: AbortSignal.timeout(1000) })
      .then(() => chrome.tabs.create({ url: 'http://localhost:5000' }))
      .catch(() => chrome.tabs.create({ url: 'https://gebriyan-cyberguard.hf.space' }));
    return;
  }

  if (msg.type === 'SET_SELECTED_TEXT') {
    chrome.storage.local.set({ selectedText: msg.text }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});