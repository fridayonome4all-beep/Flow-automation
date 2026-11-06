// Selector registry with 5-tier fallback and user calibration overrides.

(() => {
  if (window.__FlowSelectors) return;

  const SELECTOR_REGISTRY = {
    promptBox: {
      cssFallback: 'textarea, [contenteditable="true"], [role="textbox"], input[placeholder*="prompt" i]',
      ariaPatterns: ['prompt', 'input prompt', 'describe'],
      roles: ['textbox']
    },
    submitButton: {
      cssFallback: 'button[type="submit"], button:has(svg path)',
      ariaPatterns: ['create', 'generate', 'run', 'submit', 'send'],
      textPatterns: ['create', 'generate', 'run', 'submit'],
      roles: ['button']
    },
    referenceTrigger: {
      cssFallback: 'button[aria-label*="reference" i], button:has(svg[data-icon*="image"])',
      ariaPatterns: ['reference', 'add image', 'attach', 'upload subject'],
      textPatterns: ['reference', 'add image', 'subject', 'scene', 'style']
    },
    fileInput: {
      cssFallback: 'input[type="file"][accept*="image"]'
    },
    upscaleButton: {
      cssFallback: 'button[aria-label*="upscale" i], [data-action="upscale"]',
      ariaPatterns: ['upscale', 'enhance', '4k', '2k', 'high res'],
      textPatterns: ['upscale', '2k', '4k', 'enhance']
    },
    modeTabs: {
      images: ['image', 'images', 'photo'],
      videos: ['video', 'videos', 'motion']
    },
    rateLimitMessage: {
      cssFallback: '[role="alert"], .error-banner, .toast',
      keywords: ['rate limit', 'quota exceeded', 'too many requests', 'slow down', 'try again later']
    },
    contentPolicyMessage: {
      cssFallback: '[role="alert"], .error-banner',
      keywords: ['policy violation', 'content policy', 'blocked', 'safety guidelines', 'prohibited']
    }
  };

  const isVisible = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && window.getComputedStyle(el).visibility !== 'hidden';
  };

  // Find element using the 5-tier strategy
  function findElement(key, userOverrides = {}, textHint = '') {
    // Strategy 1: User override from Calibrate
    if (userOverrides && userOverrides[key]) {
      try {
        const el = document.querySelector(userOverrides[key]);
        if (isVisible(el)) {
          console.debug(`[FlowAutomator] ${key} matched Strategy 1 (user override)`);
          return el;
        }
      } catch (_) {}
    }

    const reg = SELECTOR_REGISTRY[key];
    if (!reg) return null;

    // Strategy 2: aria-label matching
    if (reg.ariaPatterns) {
      const candidates = [...document.querySelectorAll('[aria-label]')].filter(isVisible);
      const match = candidates.find(el => {
        const aria = (el.getAttribute('aria-label') || '').toLowerCase();
        return reg.ariaPatterns.some(p => aria.includes(p));
      });
      if (match) {
        console.debug(`[FlowAutomator] ${key} matched Strategy 2 (aria-label)`);
        return match;
      }
    }

    // Strategy 3: Exact or partial visible text
    if (reg.textPatterns || textHint) {
      const patterns = textHint ? [textHint.toLowerCase()] : reg.textPatterns;
      const elements = [...document.querySelectorAll('button, [role="button"], span, div, a')].filter(isVisible);
      const match = elements.find(el => {
        const txt = el.textContent.trim().toLowerCase();
        return patterns.some(p => txt === p || (txt.includes(p) && txt.length < 40));
      });
      if (match) {
        console.debug(`[FlowAutomator] ${key} matched Strategy 3 (visible text: ${textHint || 'pattern'})`);
        return match;
      }
    }

    // Strategy 4: Role + Text
    if (reg.roles) {
      for (const role of reg.roles) {
        const byRole = [...document.querySelectorAll(`[role="${role}"]`)].filter(isVisible);
        if (byRole.length > 0) {
          console.debug(`[FlowAutomator] ${key} matched Strategy 4 (role: ${role})`);
          return byRole[0];
        }
      }
    }

    // Strategy 5: CSS Fallback
    if (reg.cssFallback) {
      try {
        const fallback = [...document.querySelectorAll(reg.cssFallback)].filter(isVisible);
        if (fallback.length > 0) {
          // If promptBox, prefer the widest textbox on screen
          if (key === 'promptBox') {
            fallback.sort((a, b) => b.getBoundingClientRect().width - a.getBoundingClientRect().width);
          }
          console.debug(`[FlowAutomator] ${key} matched Strategy 5 (CSS fallback)`);
          return fallback[0];
        }
      } catch (_) {}
    }

    return null;
  }

  // Find clickable control by text (e.g. model name, aspect ratio, duration)
  function findByText(text, exact = false) {
    if (!text) return null;
    const t = text.trim().toLowerCase();
    const candidates = [...document.querySelectorAll('button, [role="button"], [role="option"], [role="tab"], li, span')].filter(isVisible);

    const match = candidates.find(e => {
      const txt = e.textContent.trim().toLowerCase();
      const aria = (e.getAttribute('aria-label') || '').trim().toLowerCase();
      if (exact) return txt === t || aria === t;
      return txt === t || aria === t || ((txt.includes(t) || aria.includes(t)) && txt.length < 50);
    });

    return match || null;
  }

  window.__FlowSelectors = {
    findElement,
    findByText,
    isVisible,
    REGISTRY: SELECTOR_REGISTRY
  };
})();
