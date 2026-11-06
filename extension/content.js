/**
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
    run.log = [...(run.log || []).slice(-60), `${time} ${msg}`];
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
    const re = /(^|\s)(create|generate|run|send|submit)\b|arrow_forward|arrow_upward/i;
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
      await log(run, `Upscaling media to ${run.cfg.resolution || "4K"}...`);
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
    if (n && !(clickByText("x" + n) || clickByText("×" + n))) {
      await log(run, "Outputs count: x" + n);
    }
  }

  async function finish(run, status) {
    run.status = status;
    await log(run, status === "done" ? "✅ Queue Finished successfully" : "⚠️ Queue Stopped");
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
          await log(run, `Auto-refreshing Flow tab (interval reached: prompt ${run.index})...`);
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
          const refOverrideTag = `@subject${slotNum}`;
          if (!text.includes("@subject")) {
            text = `${text} ${refOverrideTag}`;
          }
          await log(run, `[Override Active] Rotating to Reference Slot ${slotNum}`);
        }

        await log(run, `Prompt ${num}/${run.prompts.length}: ${text.slice(0, 50)}${text.length > 50 ? "..." : ""}`);

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
              ? `${num}-${slug(text)}_v${i + 1}`
              : `${num}_v${i + 1}`;

            await save(got[i], name, run.queueName || "Main");
          }
          run.done++;
        } catch (e) {
          run.failed = (run.failed || 0) + 1;
          await log(run, `Failed prompt ${num}: ${e.message}`);
        }

        run.index++;
        await set("run", run);

        if (run.index < run.prompts.length) {
          const [lo, hi] = run.cfg.speed === "custom"
            ? [run.cfg.customDelay || 8, run.cfg.customDelay || 8]
            : DELAYS[run.cfg.speed] || DELAYS.balanced;
          const delaySec = Math.round(lo + Math.random() * (hi - lo));
          await log(run, `Waiting ${delaySec}s before next prompt...`);
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
