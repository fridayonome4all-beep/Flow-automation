// Queue State Machine running inside the Google Flow tab with retry logic, rate-limit pauses, and auto-resume.

(() => {
  if (window.__FlowRunner) return;
  window.__FlowRunner = true;

  const sleep = (ms) => new Promise(r => setTimeout(r, ms));
  const Driver = window.__FlowDriver;
  const Refs = window.__FlowRefs;
  const Schema = window.FlowSchema;

  let isBusy = false;
  let consecutiveFailures = 0;

  const storage = {
    get: (k) => new Promise(r => chrome.storage.local.get(k, r)),
    set: (obj) => new Promise(r => chrome.storage.local.set(obj, r))
  };

  async function appendLog(run, message) {
    const time = new Date().toLocaleTimeString();
    run.log = [...(run.log || []).slice(-199), `[${time}] ${message}`];
    await storage.set({ run });
  }

  // Calculate random jitter delay between minS and maxS
  function getJitterDelay(speedConfig) {
    const min = speedConfig.minS || 6;
    const max = speedConfig.maxS || 10;
    const base = min + Math.random() * (max - min);
    // Add 10% non-mechanical jitter
    const jitter = (Math.random() - 0.5) * 1.5;
    return Math.max(1, Math.round(base + jitter));
  }

  async function applySettingsOnce(run, settings) {
    const isVideo = settings.mode === 'videos';
    Driver.selectTab(settings.mode);
    await sleep(400);

    if (isVideo) {
      Driver.selectVideoMode(settings.videos.mode);
      await sleep(300);
      Driver.selectModel(settings.videos.model);
      await sleep(300);
      Driver.selectAspect(settings.videos.aspect);
      await sleep(300);
      Driver.selectDuration(settings.videos.duration);
      await sleep(300);
      Driver.selectCount(settings.videos.count);
    } else {
      Driver.selectModel(settings.images.model);
      await sleep(300);
      Driver.selectAspect(settings.images.aspect);
      await sleep(300);
      Driver.selectCount(settings.images.count);
    }
    await appendLog(run, `Applied settings: ${settings.mode.toUpperCase()}`);
  }

  async function runQueueStateMachine() {
    if (isBusy) return;
    isBusy = true;

    try {
      const data = await storage.get(['run', 'queues', 'settings', 'activeQueueId']);
      let run = data.run;
      const queues = data.queues || [];
      const settings = data.settings || Schema.DEFAULT_SETTINGS;
      const queueId = run?.queueId || data.activeQueueId;
      const currentQueue = queues.find(q => q.id === queueId);

      if (!run || run.status !== 'running' || !currentQueue) {
        return;
      }

      const prompts = currentQueue.prompts || [];
      const timeoutMs = settings.mode === 'videos' ? 12 * 60 * 1000 : 3 * 60 * 1000;
      const knownMedia = new Set(Driver.listMedia().map(m => m.src));

      // Apply generation settings once at start
      if (!run.settingsApplied) {
        await applySettingsOnce(run, settings);
        run.settingsApplied = true;
        await storage.set({ run });
      }

      while (run.index < prompts.length) {
        // Step 1: Check pause / stop status
        const latestState = await storage.get(['run']);
        if (latestState.run?.status === 'paused' || latestState.run?.status === 'stopped') {
          await appendLog(run, `Queue ${latestState.run.status} by user.`);
          return;
        }

        const promptItem = prompts[run.index];
        const numIndex = String(run.index + 1).padStart(3, '0');
        const promptId = promptItem.customId || numIndex;

        run.currentPromptPreview = promptItem.text.slice(0, 50);
        await storage.set({ run });

        await appendLog(run, `TAKE ${numIndex}/${prompts.length} (ID: ${promptId})`);

        let attempts = 0;
        let success = false;

        while (attempts < 3 && !success) {
          attempts++;
          try {
            // Check for cancel
            const chk = await storage.get(['run']);
            if (chk.run?.status !== 'running') return;

            // Step 3: References & Keyframe attachments
            if (window.__FlowRefs && window.__FlowRefs.applyPromptReferences) {
              await window.__FlowRefs.applyPromptReferences(
                promptItem.tags,
                settings.references ? (settings.references.subjectSlots || []) : []
              );
            } else {
              await Refs.clearCurrentReferences();
            }

            // Step 4: Type prompt and submit with humanized delay
            await Driver.setPrompt(promptItem.text);
            await sleep(400 + Math.random() * 400);
            await Driver.submit();

            // Step 5: Wait for results
            const waitResult = await Driver.waitForResults(
              knownMedia,
              1,
              timeoutMs,
              async () => {
                const s = await storage.get(['run']);
                return s.run?.status !== 'running';
              }
            );

            if (waitResult.stopped) {
              return;
            }

            if (waitResult.statusAlert) {
              if (waitResult.statusAlert.type === 'rate_limit') {
                run.status = 'rate_limited';
                await appendLog(run, `Rate limit detected. Pausing 5 minutes before retry...`);
                await storage.set({ run });
                await sleep(5 * 60 * 1000);
                run.status = 'running';
                await storage.set({ run });
                continue;
              } else if (waitResult.statusAlert.type === 'content_policy') {
                promptItem.status = 'blocked';
                promptItem.error = waitResult.statusAlert.message;
                await appendLog(run, `Prompt blocked by content policy: ${promptItem.error}`);
                throw new Error('Blocked by policy');
              }
            }

            if (!waitResult.results || waitResult.results.length === 0) {
              throw new Error('Timeout waiting for generation');
            }

            // Step 6 & 7: Save results with Unique ID naming
            for (let v = 0; v < waitResult.results.length; v++) {
              const res = waitResult.results[v];
              knownMedia.add(res.src);

              // Auto Upscale if requested
              if (settings.images.quality === '2k' || settings.videos.upscale !== 'none') {
                await appendLog(run, `Upscaling TAKE ${numIndex}...`);
                await Driver.upscale(res, settings.videos.upscale);
              }

              // ID and Custom template-based naming (Strictly ${promptId}.${ext} with no _v1 suffix)
              const ext = res.isVideo ? 'mp4' : 'png';
              let filename = waitResult.results.length > 1 ? `${promptId}_${v + 1}.${ext}` : `${promptId}.${ext}`;
              if (settings.naming === 'custom' && settings.customNamingPattern) {
                const now = new Date();
                const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
                const slug = (promptItem.text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
                const promptStart = (promptItem.text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 20);

                filename = settings.customNamingPattern
                  .replace(/\{id\}/g, promptId)
                  .replace(/\{index\}/g, String(numIndex))
                  .replace(/\{timestamp\}/g, dateStr)
                  .replace(/\{prompt_start\}/g, promptStart)
                  .replace(/\{v\}/g, String(v + 1))
                  .replace(/\{slug\}/g, slug) + '.' + ext;
              } else if (settings.naming === 'slug') {
                const slug = (promptItem.text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
                filename = waitResult.results.length > 1 ? `${promptId}-${slug}_${v + 1}.${ext}` : `${promptId}-${slug}.${ext}`;
              }

              // Automatic download toggle check
              if (settings.autoDownload !== false) {
                chrome.runtime.sendMessage({
                  type: Schema.MESSAGES.DOWNLOAD,
                  url: res.src,
                  filename: filename
                });
              }

              promptItem.files.push(filename);
            }

            promptItem.status = 'done';
            promptItem.error = null;
            run.done++;
            consecutiveFailures = 0;
            success = true;
            await appendLog(run, `✓ TAKE ${numIndex} completed. Saved: ${promptId}`);
          } catch (err) {
            if (promptItem.status === 'blocked') break;

            await appendLog(run, `Attempt ${attempts} failed: ${err.message}`);
            if (attempts < 3) {
              const backoff = attempts === 1 ? 10 : 30;
              await appendLog(run, `Backing off ${backoff}s before retry...`);
              await sleep(backoff * 1000);
            } else {
              promptItem.status = 'failed';
              promptItem.error = err.message;
              run.failed++;
              consecutiveFailures++;
            }
          }
        }

        // Advance to next prompt
        run.index++;
        await storage.set({ run, queues });

        // Circuit breaker: 5 consecutive failures
        if (consecutiveFailures >= 5) {
          run.status = 'paused';
          await appendLog(run, `5 consecutive prompts failed. Run paused for inspection.`);
          await storage.set({ run });
          return;
        }

        // Pacing delay between prompts
        if (run.index < prompts.length) {
          const delaySec = getJitterDelay(settings.speed);
          await appendLog(run, `Pacing delay: ${delaySec}s`);
          await sleep(delaySec * 1000);
        }
      }

      // Completion: DO NOT refresh page on complete!
      run.status = 'done';
      await appendLog(run, `✓ Complete! Finished all ${prompts.length} prompts.`);

      // Record in History
      const histData = await storage.get(['history']);
      const history = histData.history || [];
      history.unshift({
        id: 'h_' + Date.now(),
        ts: Date.now(),
        queueName: currentQueue.name,
        status: run.failed > 0 ? 'interrupted' : 'done',
        total: prompts.length,
        done: run.done,
        failed: run.failed,
        promptsSnapshot: JSON.parse(JSON.stringify(prompts))
      });
      await storage.set({ history: history.slice(0, 20), run });

    } finally {
      isBusy = false;
    }
  }

  // Handle messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === Schema.MESSAGES.START || msg.type === Schema.MESSAGES.RESUME) {
      storage.get(['run']).then(res => {
        const run = res.run || { ...Schema.DEFAULT_RUN };
        run.status = 'running';
        if (msg.queueId) run.queueId = msg.queueId;
        storage.set({ run }).then(() => {
          runQueueStateMachine();
          sendResponse({ ok: true });
        });
      });
      return true;
    }

    if (msg.type === Schema.MESSAGES.PAUSE) {
      storage.get(['run']).then(res => {
        const run = res.run || {};
        run.status = 'paused';
        storage.set({ run }).then(() => sendResponse({ ok: true }));
      });
      return true;
    }

    if (msg.type === Schema.MESSAGES.STOP) {
      storage.get(['run']).then(res => {
        const run = res.run || {};
        run.status = 'stopped';
        storage.set({ run }).then(() => sendResponse({ ok: true }));
      });
      return true;
    }
  });

  // On page load/reload: if run.status is running, resume after 4s settle delay
  storage.get(['run']).then(res => {
    if (res.run && res.run.status === 'running') {
      setTimeout(() => {
        runQueueStateMachine();
      }, 4000);
    }
  });
})();
