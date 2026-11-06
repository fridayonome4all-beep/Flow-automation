// References attachment driver: links image blobs to Google Flow reference slots & video keyframes.

(() => {
  if (window.__FlowRefs) return;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const Selectors = window.__FlowSelectors;

  async function clearCurrentReferences() {
    // Finds and clicks close / remove buttons on existing reference chips inside Flow
    const removeBtns = document.querySelectorAll(
      '[aria-label*="remove reference" i], [aria-label*="delete reference" i], [aria-label*="remove frame" i], button.remove-ref, button[aria-label*="clear" i]'
    );
    removeBtns.forEach(btn => {
      try { btn.click(); } catch (_) {}
    });
    await sleep(350);
  }

  // Resolves a reference name or blob from IndexedDB if needed
  async function resolveBlob(source, fileName = 'reference.png') {
    if (!source) return null;
    if (source instanceof Blob || source instanceof File) return source;

    // Check if source is a data URL or blob URL
    if (typeof source === 'string' && (source.startsWith('data:') || source.startsWith('blob:'))) {
      try {
        const res = await fetch(source);
        return await res.blob();
      } catch (_) {}
    }

    // Try IndexedDB lookup if available
    if (typeof indexedDB !== 'undefined' && typeof source === 'string') {
      try {
        const dbReq = indexedDB.open('FlowAutomatorDB', 1);
        const db = await new Promise((res, rej) => {
          dbReq.onsuccess = () => res(dbReq.result);
          dbReq.onerror = () => rej(dbReq.error);
        });

        const tx = db.transaction('refImages', 'readonly');
        const store = tx.objectStore('refImages');
        const cursorReq = store.openCursor();
        const target = source.toLowerCase().trim();

        const match = await new Promise((res) => {
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor) {
              if (cursor.value.name === target || cursor.value.id === target) {
                res(cursor.value.blob);
              } else {
                cursor.continue();
              }
            } else {
              res(null);
            }
          };
          cursorReq.onerror = () => res(null);
        });

        if (match) return match;
      } catch (_) {}
    }

    return null;
  }

  async function attachFileToFlow(fileOrBlob, fileName = 'reference.png', targetType = 'reference') {
    const blob = await resolveBlob(fileOrBlob, fileName);
    if (!blob) {
      console.warn(`[FlowAutomator] Reference source "${fileName}" could not be resolved to a blob`);
      return false;
    }

    // Locate target file input based on targetType ('reference', 'start_frame', 'end_frame')
    let fileInput = null;

    if (targetType === 'start_frame') {
      fileInput = document.querySelector('input[type="file"][accept*="image"][aria-label*="start" i]') ||
                  document.querySelector('[data-role="start-frame"] input[type="file"]');
    } else if (targetType === 'end_frame') {
      fileInput = document.querySelector('input[type="file"][accept*="image"][aria-label*="end" i]') ||
                  document.querySelector('[data-role="end-frame"] input[type="file"]');
    }

    if (!fileInput) {
      fileInput = Selectors ? Selectors.findElement('fileInput') : document.querySelector('input[type="file"][accept*="image"]');
    }

    if (!fileInput) {
      // Trigger reference/frame menu if input is created dynamically
      const trigger = (targetType === 'start_frame' || targetType === 'end_frame')
        ? (Selectors?.findElement('keyframeTrigger') || document.querySelector('[aria-label*="frame" i], [aria-label*="upload" i]'))
        : (Selectors?.findElement('referenceTrigger') || document.querySelector('[aria-label*="reference" i], [aria-label*="add image" i]'));

      if (trigger) {
        trigger.click();
        await sleep(400);
        fileInput = document.querySelector('input[type="file"][accept*="image"]');
      }
    }

    if (!fileInput) {
      console.warn('[FlowAutomator] File input not accessible in Flow DOM for target:', targetType);
      return false;
    }

    try {
      const file = blob instanceof File
        ? blob
        : new File([blob], fileName, { type: blob.type || 'image/png' });

      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      fileInput.dispatchEvent(new Event('input', { bubbles: true }));

      // Wait for thumbnail preview to register in Google Flow canvas
      await sleep(1400);
      return true;
    } catch (err) {
      console.warn('[FlowAutomator] Failed attaching file to Flow:', err);
      return false;
    }
  }

  // Attaches a set of per-prompt tags or global reference slots
  async function applyPromptReferences(tags = {}, fallbackSlots = []) {
    await clearCurrentReferences();

    // 1. Check for video start keyframe tag [start: name.png]
    if (tags.start) {
      await attachFileToFlow(tags.start, tags.start, 'start_frame');
    }

    // 2. Check for video end keyframe tag [end: name.png]
    if (tags.end) {
      await attachFileToFlow(tags.end, tags.end, 'end_frame');
    }

    // 3. Check for specific subject/scene/style tags: [subject: kai.png, scene: forest.png]
    const directTags = [
      ...(tags.subject || []).map(name => ({ name, type: 'subject' })),
      ...(tags.scene || []).map(name => ({ name, type: 'scene' })),
      ...(tags.style || []).map(name => ({ name, type: 'style' })),
      ...(tags.ref || []).map(name => ({ name, type: 'reference' }))
    ];

    if (directTags.length > 0) {
      for (const t of directTags) {
        await attachFileToFlow(t.name, t.name, 'reference');
      }
      return true;
    }

    // Fall back to active global reference slots
    if (fallbackSlots && fallbackSlots.length > 0) {
      for (const slot of fallbackSlots) {
        if (slot.imageUrl || slot.fileName) {
          await attachFileToFlow(slot.imageUrl || slot.fileName, slot.fileName || `${slot.tag}.png`, 'reference');
        }
      }
      return true;
    }

    return false;
  }

  window.__FlowRefs = {
    clearCurrentReferences,
    attachFileToFlow,
    resolveBlob,
    applyPromptReferences
  };
})();
