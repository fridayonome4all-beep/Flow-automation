// Service worker managing downloads, file naming, alarms, and cross-tab communication.

import { EXTENSION_FOLDER, MESSAGES } from './shared/schema.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === MESSAGES.DOWNLOAD) {
    const filename = `${EXTENSION_FOLDER}/${msg.filename}`;
    chrome.downloads.download({
      url: msg.url,
      filename: filename,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      sendResponse({ ok: true, downloadId });
    });
    return true;
  }

  if (msg && msg.type === MESSAGES.PING) {
    sendResponse({ ok: true, timestamp: Date.now() });
    return true;
  }
});
