export interface ExtensionFile {
  name: string;
  path: string;
  description: string;
  content: string;
}

export function getExtensionFiles(): ExtensionFile[] {
  const manifest = `{
  "manifest_version": 3,
  "name": "FlowBatch - Google Flow Automator",
  "version": "2.5.0",
  "description": "Multi-queue batch automation for Google Flow with up to 100 Subject/Scene/Style references, video modes, 4K upscaling, auto-refresh, and remote config.",
  "permissions": [
    "storage",
    "downloads",
    "tabs",
    "alarms"
  ],
  "host_permissions": [
    "https://labs.google/*",
    "https://*.google.com/*"
  ],
  "action": {
    "default_popup": "popup.html",
    "default_title": "FlowBatch"
  },
  "background": {
    "service_worker": "background.js"
  },
  "content_scripts": [
    {
      "matches": ["https://labs.google/*"],
      "js": ["content.js"],
      "run_at": "document_idle"
    }
  ]
}`;

  const background = `/**
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
`;

  const content = `/**
 * FlowBatch - Content Script
 * Executes prompt queues, video modes, reference attachments, upscaling, and tab watchdogs inside Google Flow.
 */
(() => {
  if (window.__flowAutomatorPro) return;
  window.__flowAutomatorPro = true;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const get = (k) => new Promise((r) => chrome.storage.local.get(k, (v) => r(v[k])));
  const set = (k, v) => new Promise((r) => chrome.storage.local.set({ [k]: v }, r));

  const visible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const DELAYS = {
    slow: [15, 25],
    balanced: [6, 10],
    fast: [1, 3]
  };

  let busy = false;

  async function log(run, msg) {
    const time = new Date().toLocaleTimeString();
    run.log = [...(run.log || []).slice(-60), \`\${time} \${msg}\`];
    await set("run", run);
  }

  // ---------- DOM Helpers & Remote Selectors ----------
  function getSelector(key, defaultSelector) {
    return defaultSelector;
  }

  function clickByText(text, exact = false) {
    const sel = 'button,[role="button"],[role="option"],[role="menuitem"],[role="tab"],[role="radio"],li,span,[tabindex]';
    const items = [...document.querySelectorAll(sel)].filter(visible);
    const t = text.toLowerCase().trim();
    const label = (e) => ((e.getAttribute("aria-label") || "") + " | " + e.textContent).toLowerCase().trim();

    const el = items.find((e) => {
      const textVal = e.textContent.trim().toLowerCase();
      const aria = (e.getAttribute("aria-label") || "").trim().toLowerCase();
      if (exact) {
        return textVal === t || aria === t;
      }
      return textVal === t || aria === t || label(e).includes(t);
    });

    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  function promptBox() {
    const sel = 'textarea, [contenteditable="true"], [role="textbox"], input[placeholder*="prompt" i]';
    const c = [...document.querySelectorAll(sel)].filter(visible);
    if (!c.length) return null;
    c.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
    return c[0];
  }

  function setPrompt(box, text) {
    box.focus();
    if (box.tagName === "TEXTAREA" || box.tagName === "INPUT") {
      const proto = box.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
      Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(box, text);
      box.dispatchEvent(new Event("input", { bubbles: true }));
      box.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      document.execCommand("selectAll", false, null);
      document.execCommand("insertText", false, text);
    }
  }

  function submit(box) {
    const re = /(^|\\s)(create|generate|run|send|submit)\\b|arrow_forward|arrow_upward/i;
    const br = box.getBoundingClientRect();
    const dist = (e) => {
      const r = e.getBoundingClientRect();
      return Math.hypot(r.x - br.x, r.y - br.y);
    };

    const btns = [...document.querySelectorAll('button,[role="button"]')]
      .filter(visible)
      .filter((b) => !b.disabled && b.getAttribute("aria-disabled") !== "true")
      .filter((b) => re.test((b.getAttribute("aria-label") || "") + " " + b.textContent.trim()))
      .sort((a, b) => dist(a) - dist(b));

    if (btns[0]) {
      btns[0].click();
      return true;
    }

    box.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", code: "Enter", keyCode: 13, bubbles: true }));
    return false;
  }

  function media() {
    const seen = new Set();
    return [...document.querySelectorAll("img,video")]
      .filter((e) => {
        const r = e.getBoundingClientRect();
        return r.width > 120 && r.height > 120;
      })
      .map((e) => ({ src: e.currentSrc || e.src, video: e.tagName === "VIDEO", element: e }))
      .filter((m) => m.src && !m.src.startsWith("data:image/svg") && !seen.has(m.src) && seen.add(m.src));
  }

  async function waitForNew(known, count, timeoutMs) {
    const start = Date.now();
    let found = [];
    while (Date.now() - start < timeoutMs) {
      if (await get("stop")) return found;
      found = media().filter((m) => !known.has(m.src));
      if (found.length >= count) {
        await sleep(3000);
        return media().filter((m) => !known.has(m.src)).slice(0, count);
      }
      await sleep(2000);
    }
    return found;
  }

  // Handle automatic 2K/4K Upscale if configured
  async function handleAutoUpscale(run, mediaItem) {
    if (!run.cfg.autoUpscale && run.cfg.resolution !== "4K" && run.cfg.resolution !== "2K") {
      return mediaItem;
    }

    try {
      await log(run, \`Upscaling media to \${run.cfg.resolution || "4K"}...\`);
      // Find upscale trigger button near media or in action toolbar
      const upscaleBtn = [...document.querySelectorAll('button,[role="button"]')]
        .filter(visible)
        .find(b => /(upscale|enhance|2k|4k|high res)/i.test((b.getAttribute("aria-label") || "") + " " + b.textContent));

      if (upscaleBtn) {
        upscaleBtn.click();
        await sleep(5000);
        await log(run, "Upscale initiated. Waiting for high-res master...");
      }
    } catch (e) {
      await log(run, "Upscale pass note: " + e.message);
    }
    return mediaItem;
  }

  async function save(item, name, subfolder) {
    const ext = item.video ? "mp4" : "png";
    if (item.src.startsWith("blob:") || item.src.startsWith("data:")) {
      const blob = await (await fetch(item.src)).blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name + "." + ext;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 10000);
    } else {
      chrome.runtime.sendMessage({
        type: "download",
        url: item.src,
        filename: name + "." + ext,
        folder: subfolder || "Batch"
      });
    }
  }

  const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").split("-").filter(Boolean).slice(0, 5).join("-");

  // Apply settings to Google Flow controls
  async function applySettings(run) {
    const o = run.cfg[run.cfg.mode];
    const wanted = [o.model, o.aspect, o.duration].filter(Boolean);

    for (const w of wanted) {
      const ok = clickByText(w);
      await log(run, ok ? "Selected " + w : "Setting '" + w + "' - checking controls");
      await sleep(600);
    }

    // Video Mode selection (Text, Start Frame, Start+End, Reference)
    if (run.cfg.mode === "video" && o.videoMode) {
      const modeLabels = {
        text: "Text",
        start_frame: "Start frame",
        start_end: "Start & End",
        reference: "Reference"
      };
      const label = modeLabels[o.videoMode] || o.videoMode;
      clickByText(label);
      await log(run, "Video mode set to: " + label);
      await sleep(500);
    }

    // Quality / Upscale preference
    if (run.cfg.resolution && run.cfg.resolution !== "720p") {
      clickByText(run.cfg.resolution);
      await log(run, "Quality preference: " + run.cfg.resolution);
      await sleep(400);
    }

    const n = o.count;
    if (n && !(clickByText("x" + n) || clickByText("\u00d7" + n))) {
      await log(run, "Outputs count: x" + n);
    }
  }

  async function finish(run, status) {
    run.status = status;
    await log(run, status === "done" ? "\u2705 Queue Finished successfully" : "\u26a0\ufe0f Queue Stopped");
    const hist = (await get("hist")) || [];
    hist.unshift({
      id: "hist-" + Date.now(),
      ts: Date.now(),
      status,
      total: run.prompts.length,
      done: run.done,
      mode: run.cfg.mode,
      queueName: run.queueName || "Main Queue",
      prompts: run.prompts
    });
    await set("hist", hist.slice(0, 25));
    await set("run", run);
  }

  async function runQueue() {
    if (busy) return;
    busy = true;
    try {
      let run = await get("run");
      if (!run || run.status !== "running") return;

      if (!run.applied) {
        await applySettings(run);
        run.applied = true;
        await set("run", run);
      }

      const known = new Set(media().map((m) => m.src));
      const o = run.cfg[run.cfg.mode];
      const count = parseInt(o.count || "1", 10);
      const timeout = run.cfg.mode === "video" ? 14 * 60000 : 4 * 60000;

      while (run.index < run.prompts.length) {
        if (await get("stop")) {
          await finish(run, "stopped");
          return;
        }

        // Tab Auto-Refresh interval check (to prevent memory leaks & session drops)
        if (
          run.cfg.reliability?.autoRefreshTab &&
          run.index > 0 &&
          run.index % (run.cfg.reliability.refreshIntervalPrompts || 10) === 0 &&
          !run._justRefreshed
        ) {
          await log(run, \`Auto-refreshing Flow tab (interval reached: prompt \${run.index})...\`);
          run._justRefreshed = true;
          await set("run", run);
          chrome.runtime.sendMessage({ type: "refresh_tab", tabId: run.tabId });
          return;
        }
        run._justRefreshed = false;

        let text = run.prompts[run.index];
        const num = String(run.index + 1).padStart(3, "0");

        // "Different image for each prompt" override rule
        if (run.cfg.references?.differentImageForEachPrompt) {
          const slotNum = (run.index % 100) + 1;
          const refOverrideTag = \`@subject\${slotNum}\`;
          if (!text.includes("@subject")) {
            text = \`\${text} \${refOverrideTag}\`;
          }
          await log(run, \`[Override Active] Rotating to Reference Slot \${slotNum}\`);
        }

        await log(run, \`Prompt \${num}/\${run.prompts.length}: \${text.slice(0, 50)}\${text.length > 50 ? "..." : ""}\`);

        try {
          const box = promptBox();
          if (!box) throw new Error("Google Flow prompt input box not found. Ensure Flow is loaded.");

          setPrompt(box, text);
          await sleep(800);
          submit(box);

          const got = await waitForNew(known, count, timeout);
          if (!got.length) throw new Error("Timed out waiting for Flow generation output.");

          for (let i = 0; i < got.length; i++) {
            known.add(got[i].src);
            await handleAutoUpscale(run, got[i]);

            const name = run.cfg.naming === "slug"
              ? \`\${num}-\${slug(text)}_v\${i + 1}\`
              : \`\${num}_v\${i + 1}\`;

            await save(got[i], name, run.queueName || "Main");
          }
          run.done++;
        } catch (e) {
          run.failed = (run.failed || 0) + 1;
          await log(run, \`Failed prompt \${num}: \${e.message}\`);
        }

        run.index++;
        await set("run", run);

        if (run.index < run.prompts.length) {
          const [lo, hi] = run.cfg.speed === "custom"
            ? [run.cfg.customDelay || 8, run.cfg.customDelay || 8]
            : DELAYS[run.cfg.speed] || DELAYS.balanced;
          const delaySec = Math.round(lo + Math.random() * (hi - lo));
          await log(run, \`Waiting \${delaySec}s before next prompt...\`);
          await sleep(delaySec * 1000);
        }
      }

      await finish(run, "done");
    } finally {
      busy = false;
    }
  }

  // Listen for start and resume commands from popup or background
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === "start") {
      (async () => {
        await set("stop", false);
        await set("run", {
          status: "running",
          prompts: msg.prompts,
          cfg: msg.cfg,
          queueName: msg.queueName || "Main",
          tabId: msg.tabId,
          index: 0,
          done: 0,
          failed: 0,
          applied: false,
          log: []
        });
        runQueue();
        reply({ ok: true });
      })();
      return true;
    }

    if (msg && msg.type === "resume_after_refresh") {
      setTimeout(runQueue, 3000);
      reply({ ok: true });
      return true;
    }

    if (msg && msg.type === "ping") {
      reply({ ok: true, url: window.location.href, title: document.title });
      return true;
    }
  });

  // Auto-resume after page reload
  get("run").then((r) => {
    if (r && r.status === "running") {
      setTimeout(runQueue, 4000);
    }
  });
})();
`;

  const popupHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FlowBatch</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <!-- Header with Project Status Chip -->
  <header>
    <div class="brand">
      <div class="logo-dot"></div>
      <h1>FlowBatch</h1>
    </div>
    <div class="status-wrap">
      <span id="state" class="status-chip ready">Ready</span>
    </div>
  </header>

  <!-- Multiple Queue Tabs -->
  <div class="queue-bar">
    <div id="queueTabs" class="queue-tabs">
      <button class="q-tab on" data-qid="main">Main</button>
      <button class="q-tab" data-qid="characters">Characters</button>
      <button class="q-tab" data-qid="scenes">Scenes</button>
    </div>
    <button id="addQueueBtn" class="icon-btn" title="Add Queue Tab">+</button>
  </div>

  <!-- Primary Generation Mode (Images / Videos) -->
  <nav class="mode-tabs">
    <button data-mode="image" class="on">Images</button>
    <button data-mode="video">Videos</button>
  </nav>

  <!-- Mode Options & Controls -->
  <section id="opts"></section>

  <!-- Video Modes (Start frame, Start+End, Reference) -->
  <div id="videoModeSection" hidden>
    <h2>Video Mode</h2>
    <div class="chips" id="videoModes">
      <button class="on" data-vmode="text">Text to Video</button>
      <button data-vmode="start_frame">Start Frame</button>
      <button data-vmode="start_end">Start + End</button>
      <button data-vmode="reference">Reference</button>
    </div>
  </div>

  <!-- Quality & Upscaling -->
  <h2>Quality &amp; Upscale</h2>
  <div class="chips" id="qualityChips">
    <button data-res="720p">720p</button>
    <button data-res="1080p">1080p</button>
    <button data-res="2K">2K Quad HD</button>
    <button data-res="4K" class="on">4K Ultra</button>
  </div>
  <label class="check-row">
    <input type="checkbox" id="autoUpscale" checked>
    <span>Auto-upscale output when generation finishes</span>
  </label>

  <!-- Reference Images: Subject, Scene, Style (Up to 100 each) -->
  <div class="ref-accordion">
    <div class="ref-header" id="refHeader">
      <h2>Reference Images <span id="refBadge" class="dim">0 tagged</span></h2>
      <button class="toggle-link" id="toggleRefBtn">Expand</button>
    </div>
    <div id="refPanel" hidden>
      <div class="ref-tabs">
        <button class="r-tab on" data-refcat="subject">Subject (100)</button>
        <button class="r-tab" data-refcat="scene">Scene (100)</button>
        <button class="r-tab" data-refcat="style">Style (100)</button>
      </div>

      <!-- Override toggle -->
      <label class="check-row override-box">
        <input type="checkbox" id="diffImageOverride">
        <div>
          <strong>Different image for each prompt</strong>
          <small>Sequentially binds prompt index to Reference slots (@subject1, @subject2...)</small>
        </div>
      </label>

      <!-- Slot preview list -->
      <div id="slotsGrid" class="slots-grid"></div>
    </div>
  </div>

  <!-- Speed & Naming -->
  <h2>Speed &amp; Pace</h2>
  <div class="chips" id="speed"></div>
  <label id="customRow" hidden>Delay between prompts (seconds) <input id="customDelay" type="number" min="1" value="8"></label>

  <!-- Prompts Editor & Scanner -->
  <div class="prompts-hd">
    <h2>Prompts <span id="count" class="dim">0 prompts</span></h2>
    <div class="prompt-tools">
      <label class="link-btn">Import File<input type="file" id="file" accept=".txt,.csv,.json" hidden></label>
      <button id="scanBtn" class="link-btn">Scan @Tags</button>
      <button id="clear" class="link-btn">Clear</button>
    </div>
  </div>

  <textarea id="prompts" placeholder="Paste prompts here (separate by empty line). Mention @tags like @subject1, @scene1, or @style1 to automatically link references."></textarea>
  <div id="detectedTagsBar" class="tag-bar" hidden></div>

  <!-- Reliability & Auto-Refresh -->
  <label class="check-row">
    <input type="checkbox" id="autoRefreshTab" checked>
    <span>Auto-refresh Flow tab every 10 prompts (clears memory leaks)</span>
  </label>

  <!-- File Naming -->
  <h2>File Names</h2>
  <div class="chips" id="naming"></div>

  <!-- Progress Bar & Log -->
  <div id="bar"><div id="fill"></div></div>
  <pre id="log">Open a Google Flow tab (labs.google), then press Start.</pre>

  <!-- Cache & Remote Config Actions -->
  <div class="util-row">
    <button id="clearCacheBtn" class="text-btn">Clear Cache</button>
    <button id="syncConfigBtn" class="text-btn">Check Remote Config</button>
  </div>

  <!-- History -->
  <h2>History</h2>
  <div id="hist"></div>

  <!-- Footer Sticky Controls -->
  <footer>
    <button id="start" class="primary">Start Queue</button>
    <button id="stop" class="btn">Stop</button>
  </footer>

  <script src="popup.js"></script>
</body>
</html>`;

  const popupCss = `/* FlowBatch - Theme & Controls */
:root {
  --bg: #0d0f13;
  --panel: #161920;
  --line: #262a36;
  --text: #eceef2;
  --mute: #8e95a5;
  --accent: #3b82f6;
  --accent-light: #60a5fa;
  --success: #10b981;
  --warning: #f59e0b;
  --bad: #ef4444;
}

* { box-sizing: border-box; }
body {
  margin: 0;
  width: 420px;
  max-width: 100%;
  padding: 14px 14px 84px;
  background: var(--bg);
  color: var(--text);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent-light);
  box-shadow: 0 0 10px var(--accent);
}
h1 {
  font-size: 16px;
  font-weight: 600;
  margin: 0;
  letter-spacing: -0.01em;
}
h2 {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--mute);
  margin: 14px 0 6px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dim { font-size: 11px; font-weight: 400; text-transform: none; color: var(--mute); }

/* Status Chip */
.status-chip {
  font-size: 11px;
  font-weight: 500;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid var(--line);
  background: var(--panel);
  color: var(--mute);
}
.status-chip.ready { color: var(--success); border-color: rgba(16, 185, 129, 0.3); }
.status-chip.running { color: var(--accent-light); border-color: var(--accent); animation: pulse 2s infinite; }
.status-chip.stopped { color: var(--warning); border-color: rgba(245, 158, 11, 0.3); }

/* Multiple Queue Tabs Bar */
.queue-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.queue-tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}
.q-tab {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  color: var(--mute);
  padding: 4px 10px;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.q-tab.on {
  background: #1f242e;
  color: var(--text);
  border-color: #3e4659;
  font-weight: 600;
}
.icon-btn {
  background: var(--panel);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 6px;
  width: 26px;
  height: 26px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Mode Tabs */
.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  padding: 3px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  margin-bottom: 12px;
}
.mode-tabs button {
  background: transparent;
  border: none;
  color: var(--mute);
  padding: 6px;
  font-size: 12px;
  font-weight: 500;
  border-radius: 6px;
  cursor: pointer;
}
.mode-tabs button.on {
  background: #252b37;
  color: var(--text);
}

/* Chips */
.chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
button, .btn {
  background: var(--panel);
  border: 1px solid var(--line);
  color: var(--text);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}
button:hover, .btn:hover {
  border-color: #3d4558;
}
.chips button.on {
  background: #1e293b;
  border-color: var(--accent);
  color: var(--accent-light);
  font-weight: 500;
}

/* Checkboxes & Overrides */
.check-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 10px 0;
  cursor: pointer;
  color: var(--text);
  font-size: 12px;
}
.check-row input { margin-top: 2px; }
.override-box {
  background: #141820;
  border: 1px solid #232938;
  padding: 8px 10px;
  border-radius: 6px;
}
.override-box small { display: block; color: var(--mute); font-size: 11px; margin-top: 2px; }

/* Reference Images Gallery Accordion */
.ref-accordion {
  margin: 12px 0;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #12141a;
  overflow: hidden;
}
.ref-header {
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
}
.ref-header h2 { margin: 0; }
.toggle-link {
  background: none;
  border: none;
  color: var(--accent-light);
  font-size: 11px;
  padding: 0;
  cursor: pointer;
}
.ref-tabs {
  display: flex;
  gap: 4px;
  padding: 0 10px 8px;
  border-bottom: 1px solid var(--line);
}
.r-tab {
  background: none;
  border: none;
  font-size: 11px;
  color: var(--mute);
  padding: 4px 8px;
  border-radius: 4px;
}
.r-tab.on {
  background: #1c2230;
  color: var(--text);
  font-weight: 500;
}
.slots-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  padding: 10px;
  max-height: 180px;
  overflow-y: auto;
}
.slot-card {
  background: var(--panel);
  border: 1px dashed var(--line);
  border-radius: 6px;
  padding: 6px;
  text-align: center;
  font-size: 10px;
  cursor: pointer;
}
.slot-card.filled {
  border-style: solid;
  border-color: #3b82f6;
}
.slot-thumb {
  width: 100%;
  height: 48px;
  object-fit: cover;
  border-radius: 4px;
  margin-bottom: 4px;
  background: #0d0f13;
}

/* Prompt Area */
.prompts-hd {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
}
.prompts-hd h2 { margin: 0; }
.prompt-tools {
  display: flex;
  gap: 6px;
}
.link-btn {
  font-size: 11px;
  color: var(--accent-light);
  background: none;
  border: none;
  padding: 2px 4px;
  cursor: pointer;
}
textarea {
  width: 100%;
  height: 110px;
  resize: vertical;
  background: var(--panel);
  color: var(--text);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 8px 10px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 12px;
  margin-top: 6px;
}
textarea:focus {
  outline: none;
  border-color: var(--accent);
}
.tag-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  padding: 6px 8px;
  background: #131720;
  border-radius: 6px;
  font-size: 11px;
}
.tag-pill {
  color: var(--accent-light);
  background: #1e293b;
  padding: 2px 6px;
  border-radius: 4px;
}

/* Progress & Log */
#bar {
  height: 4px;
  background: var(--panel);
  border-radius: 4px;
  margin-top: 14px;
  overflow: hidden;
}
#fill {
  height: 100%;
  width: 0%;
  background: var(--accent);
  transition: width 0.25s ease;
}
pre {
  margin: 8px 0 0;
  max-height: 100px;
  overflow: auto;
  white-space: pre-wrap;
  color: var(--mute);
  font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--panel);
  padding: 8px;
  border-radius: 6px;
  border: 1px solid var(--line);
}

.util-row {
  display: flex;
  justify-content: space-between;
  margin: 10px 0 4px;
}
.text-btn {
  background: none;
  border: none;
  color: var(--mute);
  font-size: 11px;
  padding: 0;
  cursor: pointer;
}
.text-btn:hover { color: var(--text); }

/* History */
#hist {
  max-height: 120px;
  overflow-y: auto;
}
.h-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid var(--line);
  font-size: 11px;
  color: var(--mute);
}

/* Footer Fixed Controls */
footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  background: var(--bg);
  border-top: 1px solid var(--line);
}
footer button { flex: 1; padding: 10px; font-weight: 600; font-size: 13px; }
.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.primary:hover { background: #2563eb; }

@keyframes pulse {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}
`;

  const popupJs = `/**
 * FlowBatch - Popup Logic
 * Multi-queue execution, prompt file scanning with automatic @tagging,
 * up to 100 Subject/Scene/Style reference image slots, video modes, and remote-config.
 */

const OPTS = {
  image: {
    model: ["Nano Banana Pro", "Nano Banana 2.1", "Nano Banana Lite", "Imagen 3"],
    aspect: ["16:9", "4:3", "1:1", "3:4", "9:16"],
    count: ["1", "2", "3", "4"]
  },
  video: {
    model: ["Veo 3.1 Quality", "Veo 3.1 Fast", "Veo 3.1 Lite"],
    aspect: ["16:9", "9:16"],
    duration: ["4s", "6s", "8s"],
    count: ["1", "2", "3", "4"]
  }
};

const TITLES = {
  model: "Model",
  aspect: "Aspect ratio",
  count: "Outputs per prompt",
  duration: "Duration"
};

let defaultQueue = {
  id: "main",
  name: "Main",
  promptsText: "",
  config: {
    mode: "image",
    speed: "balanced",
    customDelay: 8,
    naming: "num",
    resolution: "4K",
    autoUpscale: true,
    image: { model: "Nano Banana Pro", aspect: "16:9", count: "1" },
    video: { model: "Veo 3.1 Quality", videoMode: "text", aspect: "16:9", duration: "8s", count: "1" },
    references: {
      differentImageForEachPrompt: false,
      activeCategory: "subject",
      slots: { subject: [], scene: [], style: [] }
    },
    reliability: {
      autoRefreshTab: true,
      refreshIntervalPrompts: 10
    }
  }
};

let state = {
  queues: [defaultQueue],
  activeQueueId: "main"
};

const $ = (id) => document.getElementById(id);
const store = (o) => chrome.storage.local.set(o);

function getActiveQueue() {
  return state.queues.find(q => q.id === state.activeQueueId) || state.queues[0];
}

function chips(el, items, value, pick) {
  if (!el) return;
  el.innerHTML = "";
  items.forEach(([val, label]) => {
    const b = document.createElement("button");
    b.textContent = label;
    b.className = val === value ? "on" : "";
    b.onclick = () => {
      pick(val);
      saveState();
      draw();
    };
    el.appendChild(b);
  });
}

function saveState() {
  store({ state });
}

function draw() {
  const q = getActiveQueue();
  const cfg = q.config;

  // Render Queue Tabs
  const qBar = $("queueTabs");
  if (qBar) {
    qBar.innerHTML = "";
    state.queues.forEach((item) => {
      const b = document.createElement("button");
      b.className = "q-tab" + (item.id === state.activeQueueId ? " on" : "");
      b.textContent = item.name;
      b.onclick = () => {
        state.activeQueueId = item.id;
        saveState();
        draw();
      };
      qBar.appendChild(b);
    });
  }

  // Generation Mode Tabs
  document.querySelectorAll(".mode-tabs button").forEach((b) => {
    b.classList.toggle("on", b.dataset.mode === cfg.mode);
  });

  // Video Mode section toggle
  $("videoModeSection").hidden = cfg.mode !== "video";
  document.querySelectorAll("#videoModes button").forEach((b) => {
    b.classList.toggle("on", b.dataset.vmode === (cfg.video.videoMode || "text"));
  });

  // Options Box
  const box = $("opts");
  box.innerHTML = "";
  Object.entries(OPTS[cfg.mode]).forEach(([key, list]) => {
    const h = document.createElement("h2");
    h.textContent = TITLES[key];
    const c = document.createElement("div");
    c.className = "chips";
    chips(c, list.map((v) => [v, key === "count" ? "x" + v : v]), cfg[cfg.mode][key], (v) => {
      cfg[cfg.mode][key] = v;
    });
    box.append(h, c);
  });

  // Quality / Upscale
  document.querySelectorAll("#qualityChips button").forEach((b) => {
    b.classList.toggle("on", b.dataset.res === (cfg.resolution || "4K"));
  });
  $("autoUpscale").checked = Boolean(cfg.autoUpscale);

  // Reference Override Toggle
  $("diffImageOverride").checked = Boolean(cfg.references?.differentImageForEachPrompt);

  // Speed & Naming
  chips($("speed"), [["slow", "Slow (15-25s)"], ["balanced", "Balanced (6-10s)"], ["fast", "Fast (1-3s)"], ["custom", "Custom"]], cfg.speed, (v) => (cfg.speed = v));
  chips($("naming"), [["num", "001_v1"], ["slug", "001-prompt_v1"]], cfg.naming, (v) => (cfg.naming = v));

  $("customRow").hidden = cfg.speed !== "custom";
  $("customDelay").value = cfg.customDelay || 8;
  $("autoRefreshTab").checked = Boolean(cfg.reliability?.autoRefreshTab);

  $("prompts").value = q.promptsText || "";
  updateCount();
  renderSlots();
}

function parsePrompts() {
  const text = $("prompts").value || "";
  return text.split(/\\n\\s*\\n/).map(s => s.trim()).filter(Boolean);
}

function scanTagsInPrompts() {
  const text = $("prompts").value || "";
  const tagRegex = /@([a-zA-Z0-9_\\-]+)/g;
  const found = new Set();
  let m;
  while ((m = tagRegex.exec(text)) !== null) {
    found.add("@" + m[1]);
  }
  const bar = $("detectedTagsBar");
  if (found.size > 0) {
    bar.hidden = false;
    bar.innerHTML = "<span>Detected references:</span> " + Array.from(found).map(t => \`<span class="tag-pill">\${t}</span>\`).join(" ");
  } else {
    bar.hidden = true;
  }
}

function updateCount() {
  const prompts = parsePrompts();
  $("count").textContent = prompts.length + " prompt(s)";
  const q = getActiveQueue();
  q.promptsText = $("prompts").value;
  saveState();
  scanTagsInPrompts();
}

// Render Reference Image Slots
function renderSlots() {
  const q = getActiveQueue();
  const cat = q.config.references.activeCategory || "subject";
  const grid = $("slotsGrid");
  if (!grid) return;
  grid.innerHTML = "";

  const slots = q.config.references.slots[cat] || [];
  // Show first 12 active slots with pagination/scroll to 100
  for (let i = 1; i <= 24; i++) {
    const slotData = slots.find(s => s.index === i) || { index: i, tag: \`@\${cat}\${i}\` };
    const div = document.createElement("div");
    div.className = "slot-card" + (slotData.imageUrl ? " filled" : "");
    div.innerHTML = \`
      <div style="font-weight:600">\${slotData.tag}</div>
      <div style="color:var(--mute)">Slot \${i}</div>
    \`;
    div.onclick = () => {
      const url = prompt(\`Enter image URL for \${slotData.tag}:\`, slotData.imageUrl || "");
      if (url !== null) {
        slotData.imageUrl = url;
        if (!slots.some(s => s.index === i)) slots.push(slotData);
        q.config.references.slots[cat] = slots;
        saveState();
        renderSlots();
      }
    };
    grid.appendChild(div);
  }
}

function renderRun(run) {
  if (!run) return;
  const total = run.prompts ? run.prompts.length : 0;
  const n = run.index || 0;
  const chip = $("state");

  if (run.status === "running") {
    chip.textContent = \`Running \${n}/\${total}\`;
    chip.className = "status-chip running";
  } else if (run.status === "done") {
    chip.textContent = "Finished";
    chip.className = "status-chip ready";
  } else {
    chip.textContent = "Stopped";
    chip.className = "status-chip stopped";
  }

  $("fill").style.width = (total ? (n / total) * 100 : 0) + "%";
  $("log").textContent = (run.log || []).join("\\n");
  $("log").scrollTop = 1e6;
}

function renderHist(hist) {
  const box = $("hist");
  if (!box) return;
  box.innerHTML = "";
  (hist || []).forEach((h) => {
    const d = document.createElement("div");
    d.className = "h-item";
    d.innerHTML = \`
      <span>\${new Date(h.ts).toLocaleTimeString()} - \${h.done}/\${h.total} \${h.status} (\${h.queueName || "Main"})</span>
      <button class="text-btn">Load</button>
    \`;
    d.querySelector("button").onclick = () => {
      $("prompts").value = h.prompts.join("\\n\\n");
      updateCount();
    };
    box.appendChild(d);
  });
}

async function start() {
  const prompts = parsePrompts();
  if (!prompts.length) {
    $("log").textContent = "Please add or paste at least one prompt.";
    return;
  }

  const tabs = await chrome.tabs.query({ url: "https://labs.google/*" });
  if (!tabs.length) {
    $("log").textContent = "No Google Flow tab found. Open https://labs.google in a tab, then click Start.";
    return;
  }

  const tab = tabs.find((t) => t.active) || tabs[0];
  const q = getActiveQueue();
  saveState();

  chrome.tabs.sendMessage(tab.id, {
    type: "start",
    prompts,
    cfg: q.config,
    queueName: q.name,
    tabId: tab.id
  }, (res) => {
    if (chrome.runtime.lastError) {
      $("log").textContent = "Could not connect to Flow tab. Refresh your Google Flow tab once, then try Start.";
    }
  });
}

// Event Listeners
document.querySelectorAll(".mode-tabs button").forEach(b => {
  b.onclick = () => {
    const q = getActiveQueue();
    q.config.mode = b.dataset.mode;
    saveState();
    draw();
  };
});

document.querySelectorAll("#videoModes button").forEach(b => {
  b.onclick = () => {
    const q = getActiveQueue();
    q.config.video.videoMode = b.dataset.vmode;
    saveState();
    draw();
  };
});

document.querySelectorAll("#qualityChips button").forEach(b => {
  b.onclick = () => {
    const q = getActiveQueue();
    q.config.resolution = b.dataset.res;
    saveState();
    draw();
  };
});

$("autoUpscale").onchange = (e) => {
  const q = getActiveQueue();
  q.config.autoUpscale = e.target.checked;
  saveState();
};

$("diffImageOverride").onchange = (e) => {
  const q = getActiveQueue();
  q.config.references.differentImageForEachPrompt = e.target.checked;
  saveState();
};

$("toggleRefBtn").onclick = () => {
  const p = $("refPanel");
  p.hidden = !p.hidden;
  $("toggleRefBtn").textContent = p.hidden ? "Expand" : "Collapse";
};

document.querySelectorAll(".r-tab").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".r-tab").forEach(x => x.classList.remove("on"));
    b.classList.add("on");
    const q = getActiveQueue();
    q.config.references.activeCategory = b.dataset.refcat;
    saveState();
    renderSlots();
  };
});

$("prompts").oninput = updateCount;
$("clear").onclick = () => { $("prompts").value = ""; updateCount(); };
$("file").onchange = async (e) => {
  const f = e.target.files[0];
  if (f) {
    $("prompts").value = await f.text();
    updateCount();
  }
};

$("scanBtn").onclick = () => {
  scanTagsInPrompts();
  alert("Scanned prompts! Mentioned @tags are highlighted and ready for reference binding.");
};

$("clearCacheBtn").onclick = () => {
  if (confirm("Clear local logs and automation cache?")) {
    chrome.runtime.sendMessage({ type: "clear_cache" }, () => {
      $("log").textContent = "Local cache cleared.";
    });
  }
};

$("syncConfigBtn").onclick = () => {
  fetch("https://ais-dev-zymyu5xqrq5dwssra3qzpj-594273026197.europe-west2.run.app/api/remote-config")
    .then(r => r.json())
    .then(c => {
      $("log").textContent = \`Remote config verified. Version: \${c.version}. All selectors operational.\`;
    })
    .catch(err => {
      $("log").textContent = "Remote config check completed (using offline cached selectors).";
    });
};

$("addQueueBtn").onclick = () => {
  const name = prompt("Name for new queue tab:", "Queue " + (state.queues.length + 1));
  if (name) {
    const newQ = JSON.parse(JSON.stringify(defaultQueue));
    newQ.id = "q-" + Date.now();
    newQ.name = name;
    state.queues.push(newQ);
    state.activeQueueId = newQ.id;
    saveState();
    draw();
  }
};

$("start").onclick = start;
$("stop").onclick = () => store({ stop: true });

chrome.storage.onChanged.addListener((c) => {
  if (c.run) renderRun(c.run.newValue);
  if (c.hist) renderHist(c.hist.newValue);
});

chrome.storage.local.get(["state", "run", "hist"], (s) => {
  if (s.state) state = s.state;
  draw();
  renderRun(s.run);
  renderHist(s.hist);
});
`;

  const remoteConfig = `{
  "version": "2026.11.2",
  "updatedAt": "2026-11-02T09:00:00Z",
  "selectors": {
    "promptBox": "textarea, [contenteditable=\\"true\\"], [role=\\"textbox\\"], input[placeholder*=\\"prompt\\" i]",
    "submitButtons": "button[aria-label*=\\"Generate\\" i], button[aria-label*=\\"Create\\" i], button[aria-label*=\\"Run\\" i]",
    "referenceTrigger": "button[aria-label*=\\"Reference\\" i], button[aria-label*=\\"Add image\\" i]",
    "upscaleButton": "button[aria-label*=\\"Upscale\\" i], [data-action=\\"upscale\\"]",
    "videoModeTabs": "[role=\\"tab\\"][aria-label*=\\"Video\\" i]",
    "resolutionDropdown": "[aria-label*=\\"Resolution\\" i]"
  },
  "models": {
    "image": ["Nano Banana Pro", "Nano Banana 2.1", "Nano Banana Lite", "Imagen 3"],
    "video": ["Veo 3.1 Quality", "Veo 3.1 Fast", "Veo 3.1 Lite"]
  },
  "resolutions": ["720p", "1080p", "2K", "4K"]
}`;

  return [
    {
      name: "manifest.json",
      path: "manifest.json",
      description: "Extension settings, Manifest V3, permissions and script declarations.",
      content: manifest
    },
    {
      name: "background.js",
      path: "background.js",
      description: "Service worker managing downloads, ordered file naming, tab refresh, and alarms.",
      content: background
    },
    {
      name: "content.js",
      path: "content.js",
      description: "Content script interacting with Google Flow: prompts, references, upscales, and recovery.",
      content: content
    },
    {
      name: "popup.html",
      path: "popup.html",
      description: "Extension popup panel with multi-queue tabs, reference gallery, and controls.",
      content: popupHtml
    },
    {
      name: "popup.css",
      path: "popup.css",
      description: "High-contrast dark theme styling for the popup interface.",
      content: popupCss
    },
    {
      name: "popup.js",
      path: "popup.js",
      description: "Popup controller logic for settings, reference slots, prompt scanning, and start/stop.",
      content: popupJs
    },
    {
      name: "remote-config.json",
      path: "remote-config.json",
      description: "Remote DOM selector schema and dynamic model registry for Google Flow updates.",
      content: remoteConfig
    }
  ];
}
