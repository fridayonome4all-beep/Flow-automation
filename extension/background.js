/**
 * FlowBatch - Service Worker
 * Manages file downloads, ordered naming, tab auto-refresh, and remote config sync.
 */

// Handle downloads and ordered file naming
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "download") {
    chrome.downloads.download({
      url: msg.url,
      filename: "FlowAutomator/" + (msg.folder ? msg.folder + "/" : "") + msg.filename,
      conflictAction: "uniquify"
    }, (downloadId) => {
      sendResponse({ ok: true, downloadId });
    });
    return true;
  }

  // Auto-refresh Flow tab during long runs
  if (msg && msg.type === "refresh_tab") {
    if (msg.tabId) {
      chrome.tabs.reload(msg.tabId, { bypassCache: false }, () => {
        setTimeout(() => {
          chrome.tabs.sendMessage(msg.tabId, { type: "resume_after_refresh" });
        }, 4000);
      });
      sendResponse({ ok: true });
    }
    return true;
  }

  // Clear local extension cache and media state
  if (msg && msg.type === "clear_cache") {
    chrome.storage.local.get(null, (allData) => {
      const keysToKeep = ["cfg", "queues", "activeQueueId"];
      const keysToRemove = Object.keys(allData).filter(k => !keysToKeep.includes(k));
      chrome.storage.local.remove(keysToRemove, () => {
        sendResponse({ ok: true, cleared: keysToRemove.length });
      });
    });
    return true;
  }
});

// Periodic remote config checker (runs every 6 hours)
chrome.alarms.create("sync_remote_config", { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "sync_remote_config") {
    chrome.storage.local.get(["remoteConfigUrl"], (res) => {
      const url = res.remoteConfigUrl || "https://ais-dev-zymyu5xqrq5dwssra3qzpj-594273026197.europe-west2.run.app/api/remote-config";
      fetch(url)
        .then(r => r.json())
        .then(config => {
          if (config && config.selectors) {
            chrome.storage.local.set({ dynamicSelectors: config.selectors, lastConfigSync: Date.now() });
          }
        })
        .catch(err => console.warn("Remote config sync deferred:", err));
    });
  }
});
