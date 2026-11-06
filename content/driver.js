// Complete Flow DOM Driver: the only file that interacts with Google Flow's DOM elements.

(() => {
  if (window.__FlowDriver) return;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const Selectors = window.__FlowSelectors;

  function ensureProject() {
    // Verifies project is open and canvas is loaded
    const box = Selectors.findElement('promptBox');
    return Boolean(box);
  }

  function selectTab(mode) {
    const isVideo = mode === 'videos';
    const keyword = isVideo ? 'video' : 'image';
    const el = Selectors.findByText(keyword);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  function selectVideoMode(mode) {
    const labels = {
      text: 'Text',
      start: 'Start',
      start_end: 'S+E',
      ref: 'Ref'
    };
    const target = labels[mode] || mode;
    const btn = Selectors.findByText(target);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }

  function selectModel(modelName) {
    if (!modelName) return false;
    const el = Selectors.findByText(modelName);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  function selectAspect(aspect) {
    if (!aspect) return false;
    const el = Selectors.findByText(aspect, true);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  function selectCount(countStr) {
    if (!countStr) return false;
    const clean = countStr.replace('x', '').trim();
    const el = Selectors.findByText(`x${clean}`, true) || Selectors.findByText(`×${clean}`, true);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  function selectDuration(durationStr) {
    if (!durationStr) return false;
    const el = Selectors.findByText(durationStr, true);
    if (el) {
      el.click();
      return true;
    }
    return false;
  }

  async function simulateHumanClick(el) {
    if (!el) return false;
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      await sleep(100 + Math.random() * 120);
      const rect = el.getBoundingClientRect();
      const clientX = rect.left + rect.width * (0.3 + Math.random() * 0.4);
      const clientY = rect.top + rect.height * (0.3 + Math.random() * 0.4);

      const mouseOpts = { bubbles: true, cancelable: true, view: window, clientX, clientY };
      el.dispatchEvent(new PointerEvent('pointerover', mouseOpts));
      el.dispatchEvent(new MouseEvent('mouseover', mouseOpts));
      el.dispatchEvent(new PointerEvent('pointerdown', mouseOpts));
      el.dispatchEvent(new MouseEvent('mousedown', mouseOpts));
      await sleep(35 + Math.random() * 45);
      el.dispatchEvent(new PointerEvent('pointerup', mouseOpts));
      el.dispatchEvent(new MouseEvent('mouseup', mouseOpts));
      el.dispatchEvent(new MouseEvent('click', mouseOpts));
      return true;
    } catch (_) {
      el.click();
      return true;
    }
  }

  async function setPrompt(text) {
    const box = Selectors.findElement('promptBox');
    if (!box) {
      throw new Error('Prompt input field not found on Google Flow page');
    }

    try {
      box.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (_) {}

    box.focus();
    await sleep(80 + Math.random() * 100);

    if (box.tagName === 'TEXTAREA' || box.tagName === 'INPUT') {
      const proto = box.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const descriptor = Object.getOwnPropertyDescriptor(proto, 'value');
      if (descriptor && descriptor.set) {
        descriptor.set.call(box, text);
      } else {
        box.value = text;
      }
      box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
      box.dispatchEvent(new Event('change', { bubbles: true }));
      box.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: 'End' }));
    } else {
      // Contenteditable div
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, text);
      box.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    }

    // Verify text landed
    const landed = (box.value || box.textContent || '').trim();
    if (landed.length === 0 && text.trim().length > 0) {
      box.textContent = text;
      box.dispatchEvent(new Event('input', { bubbles: true }));
    }
    await sleep(120 + Math.random() * 150);
    return true;
  }

  async function submit() {
    const box = Selectors.findElement('promptBox');
    const submitBtn = Selectors.findElement('submitButton');

    if (submitBtn && !submitBtn.disabled && submitBtn.getAttribute('aria-disabled') !== 'true') {
      await simulateHumanClick(submitBtn);
      return true;
    }

    if (box) {
      box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      await sleep(50);
      box.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
      return true;
    }
    return false;
  }

  function listMedia() {
    const seen = new Set();
    const results = [];
    const elements = document.querySelectorAll('img, video');

    elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.width > 120 && rect.height > 120) {
        const src = el.currentSrc || el.src;
        if (src && !src.startsWith('data:image/svg') && !seen.has(src)) {
          seen.add(src);
          results.push({
            src,
            isVideo: el.tagName === 'VIDEO',
            element: el,
            width: rect.width,
            height: rect.height
          });
        }
      }
    });

    return results;
  }

  function readStatusText() {
    // Check for rate limit banners
    const alertElements = document.querySelectorAll('[role="alert"], .error, .toast, div[class*="error" i]');
    for (const el of alertElements) {
      const text = el.textContent.toLowerCase();
      if (text.includes('rate limit') || text.includes('too many requests') || text.includes('quota exceeded') || text.includes('try again in')) {
        return { type: 'rate_limit', message: el.textContent.trim() };
      }
      if (text.includes('policy') || text.includes('blocked') || text.includes('safety') || text.includes('prohibited')) {
        return { type: 'content_policy', message: el.textContent.trim() };
      }
    }
    return null;
  }

  async function upscale(mediaItem, targetQuality = '4K') {
    const upscaleBtn = Selectors.findElement('upscaleButton');
    if (upscaleBtn) {
      try {
        upscaleBtn.click();
        await sleep(4000);
        return { success: true, target: targetQuality };
      } catch (err) {
        return { success: false, fallback: 'Standard', error: err.message };
      }
    }
    return { success: false, fallback: 'Standard', error: 'Upscale control unavailable' };
  }

  async function waitForResults(knownSet, count = 1, timeoutMs = 180000, checkStop) {
    const start = Date.now();
    let stableCount = 0;
    let lastFoundCount = 0;

    while (Date.now() - start < timeoutMs) {
      if (checkStop && (await checkStop())) {
        return { results: [], stopped: true };
      }

      // Check page status for rate limit or block
      const statusAlert = readStatusText();
      if (statusAlert) {
        return { results: [], statusAlert };
      }

      const all = listMedia();
      const newItems = all.filter(m => !knownSet.has(m.src));

      if (newItems.length >= count) {
        if (newItems.length === lastFoundCount) {
          stableCount++;
          if (stableCount >= 2) { // Stable for 3-4 seconds
            return { results: newItems.slice(0, count), stopped: false };
          }
        } else {
          lastFoundCount = newItems.length;
          stableCount = 1;
        }
      }

      await sleep(2000);
    }

    return { results: [], timeout: true };
  }

  window.__FlowDriver = {
    ensureProject,
    selectTab,
    selectVideoMode,
    selectModel,
    selectAspect,
    selectCount,
    selectDuration,
    setPrompt,
    submit,
    listMedia,
    readStatusText,
    upscale,
    waitForResults
  };
})();
