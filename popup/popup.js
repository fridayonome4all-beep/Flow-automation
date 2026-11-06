// Popup controller: renders storage state, dispatches user commands, and manages bottom sheets.

import {
  MODELS,
  ASPECT_RATIOS,
  DURATIONS,
  COUNTS,
  VIDEO_MODES,
  IMAGE_QUALITIES,
  VIDEO_UPSCALES,
  SPEED_PRESETS,
  STORAGE_KEYS,
  MESSAGES,
  DEFAULT_SETTINGS,
  DEFAULT_RUN,
  DEFAULT_QUEUES,
  migrateStorage
} from '../shared/schema.js';

import { parsePrompts, parsePromptTags } from '../shared/parse.js';
import { renderChipGroup } from './components/chips.js';
import { renderQueueList } from './components/queue-list.js';
import { renderRefPicker } from './components/ref-picker.js';
import { renderHistorySheet } from './components/history-sheet.js';
import { renderSettingsSheet } from './components/settings-sheet.js';

// Safe chrome.storage wrapper that works in Chrome Extension and mock dev environments
const storage = {
  get: (keys) => new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(keys, resolve);
    } else {
      const result = {};
      const targetKeys = Array.isArray(keys) ? keys : [keys];
      targetKeys.forEach(k => {
        try {
          const item = localStorage.getItem('flow_' + k);
          if (item) result[k] = JSON.parse(item);
        } catch (_) {}
      });
      resolve(result);
    }
  }),
  set: (data) => new Promise((resolve) => {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set(data, resolve);
    } else {
      Object.entries(data).forEach(([k, v]) => {
        try {
          localStorage.setItem('flow_' + k, JSON.stringify(v));
        } catch (_) {}
      });
      resolve();
    }
  })
};

// Send message to active Flow tab content script
async function sendFlowMessage(msg) {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
      if (tabs && tabs.length > 0) {
        const activeTab = tabs.find(t => t.active) || tabs[0];
        return await chrome.tabs.sendMessage(activeTab.id, msg);
      }
    } catch (e) {
      console.warn('Flow tab message deferred:', e);
    }
  }
  return null;
}

// Global UI State
let state = {
  settings: { ...DEFAULT_SETTINGS },
  queues: [...DEFAULT_QUEUES],
  activeQueueId: 'main',
  run: { ...DEFAULT_RUN },
  history: [],
  refLibrary: [],
  references: { subject: [], scene: [], style: [] },
  isFlowConnected: false
};

// DOM references
const $ = (id) => document.getElementById(id);

async function checkFlowConnection() {
  if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.query) {
    try {
      const tabs = await chrome.tabs.query({ url: 'https://labs.google/*' });
      state.isFlowConnected = tabs && tabs.length > 0;
    } catch (_) {
      state.isFlowConnected = false;
    }
  } else {
    state.isFlowConnected = false;
  }
  renderHeaderAndClapper();
}

async function init() {
  const raw = await storage.get(Object.values(STORAGE_KEYS));
  const migrated = migrateStorage(raw);

  state.settings = migrated[STORAGE_KEYS.SETTINGS] || { ...DEFAULT_SETTINGS };
  state.queues = migrated[STORAGE_KEYS.QUEUES] || [...DEFAULT_QUEUES];
  state.activeQueueId = migrated[STORAGE_KEYS.ACTIVE_QUEUE_ID] || 'main';
  state.run = migrated[STORAGE_KEYS.RUN] || { ...DEFAULT_RUN };
  state.history = migrated[STORAGE_KEYS.HISTORY] || [];
  state.refLibrary = migrated[STORAGE_KEYS.REF_LIBRARY] || [];

  setupEventListeners();
  renderAll();
  await checkFlowConnection();
  listenToStorageChanges();
}

function getActiveQueue() {
  return state.queues.find(q => q.id === state.activeQueueId) || state.queues[0];
}

function saveSettings() {
  storage.set({ [STORAGE_KEYS.SETTINGS]: state.settings });
}

function saveQueues() {
  storage.set({
    [STORAGE_KEYS.QUEUES]: state.queues,
    [STORAGE_KEYS.ACTIVE_QUEUE_ID]: state.activeQueueId
  });
}

function renderAll() {
  renderHeaderAndClapper();
  renderModeTabs();
  renderModelAndOutputs();
  renderReferences();
  renderPromptsInput();
  renderQueueView();
  renderBottomActions();
  renderCollapsibleStates();
}

function renderHeaderAndClapper() {
  const q = getActiveQueue();
  const prompts = q?.prompts || [];
  const total = prompts.length;
  const currentIdx = state.run.status === 'running' ? state.run.index : (state.run.done || 0);

  // Take Counter: TAKE 012 / 030
  $('takeCounterText').textContent = `TAKE ${String(currentIdx).padStart(3, '0')} / ${String(total).padStart(3, '0')}`;

  // Clapperboard bar fill percentage
  const pct = total > 0 ? Math.min(100, Math.round((currentIdx / total) * 100)) : 0;
  $('clapperBarFill').style.width = `${pct}%`;

  // Status Chip: green ONLY if connected to active Flow tab
  const chip = $('statusChip');
  const chipLabel = $('statusChipLabel');

  const isConnected = state.isFlowConnected;
  if (state.run.status === 'running') {
    chip.className = 'status-chip chip-running';
    chipLabel.textContent = `Running ${currentIdx}/${total}`;
  } else if (!isConnected) {
    chip.className = 'status-chip chip-disconnected';
    chipLabel.textContent = 'Disconnected · Open Flow';
  } else {
    chip.className = 'status-chip chip-ready';
    chipLabel.textContent = 'Ready · Project 5cb9f5';
  }
}

function renderModeTabs() {
  const isVideos = state.settings.mode === 'videos';
  $('tabImagesBtn').classList.toggle('active', !isVideos);
  $('tabVideosBtn').classList.toggle('active', isVideos);

  $('imagesOptionsBlock').hidden = isVideos;
  $('videosOptionsBlock').hidden = !isVideos;
}

function renderModelAndOutputs() {
  const s = state.settings;

  // Images Controls
  renderChipGroup({
    container: $('imageModelChips'),
    items: MODELS.images.map(m => ({ id: m.id, label: m.label })),
    selectedId: s.images.model,
    onChange: (id) => { s.images.model = id; saveSettings(); }
  });

  renderChipGroup({
    container: $('imageAspectChips'),
    items: ASPECT_RATIOS.images.map(a => ({ id: a, label: a })),
    selectedId: s.images.aspect,
    onChange: (id) => { s.images.aspect = id; saveSettings(); }
  });

  renderChipGroup({
    container: $('imageCountChips'),
    items: COUNTS.map(c => ({ id: c, label: c })),
    selectedId: s.images.count,
    onChange: (id) => { s.images.count = id; saveSettings(); }
  });

  renderChipGroup({
    container: $('imageQualityChips'),
    items: IMAGE_QUALITIES.map(q => ({ id: q.id, label: q.label })),
    selectedId: s.images.quality,
    onChange: (id) => { s.images.quality = id; saveSettings(); }
  });

  // Videos Controls
  renderChipGroup({
    container: $('videoModeChips'),
    items: VIDEO_MODES.map(m => ({ id: m.id, label: m.label })),
    selectedId: s.videos.mode,
    onChange: (id) => { s.videos.mode = id; saveSettings(); }
  });

  renderChipGroup({
    container: $('videoModelChips'),
    items: MODELS.videos.map(m => ({ id: m.id, label: m.label })),
    selectedId: s.videos.model,
    onChange: (id) => {
      s.videos.model = id;
      // Validate duration support for chosen model
      const modelData = MODELS.videos.find(v => v.id === id);
      if (modelData && !modelData.supportedDurations.includes(s.videos.duration)) {
        s.videos.duration = modelData.supportedDurations[0];
      }
      saveSettings();
      renderModelAndOutputs();
    }
  });

  renderChipGroup({
    container: $('videoAspectChips'),
    items: ASPECT_RATIOS.videos.map(a => ({ id: a, label: a })),
    selectedId: s.videos.aspect,
    onChange: (id) => { s.videos.aspect = id; saveSettings(); }
  });

  // Filter durations supported by the currently chosen video model
  const activeVideoModel = MODELS.videos.find(v => v.id === s.videos.model);
  const supportedDurs = activeVideoModel ? activeVideoModel.supportedDurations : DURATIONS;

  renderChipGroup({
    container: $('videoDurationChips'),
    items: DURATIONS.map(d => ({
      id: d,
      label: d,
      disabled: !supportedDurs.includes(d)
    })),
    selectedId: s.videos.duration,
    onChange: (id) => { s.videos.duration = id; saveSettings(); }
  });

  renderChipGroup({
    container: $('videoCountChips'),
    items: COUNTS.map(c => ({ id: c, label: c })),
    selectedId: s.videos.count,
    onChange: (id) => { s.videos.count = id; saveSettings(); }
  });

  renderChipGroup({
    container: $('videoUpscaleChips'),
    items: VIDEO_UPSCALES.map(u => ({ id: u.id, label: u.label })),
    selectedId: s.videos.upscale,
    onChange: (id) => { s.videos.upscale = id; saveSettings(); }
  });

  // Generation Speed Preset
  renderChipGroup({
    container: $('speedPresetChips'),
    items: Object.values(SPEED_PRESETS).map(sp => ({ id: sp.id, label: sp.label })),
    selectedId: s.speed.preset,
    onChange: (id) => {
      s.speed.preset = id;
      const customInputs = $('customSpeedInputs');
      if (customInputs) customInputs.hidden = id !== 'custom';
      saveSettings();
    }
  });

  $('customSpeedInputs').hidden = s.speed.preset !== 'custom';
}

function renderReferences() {
  renderRefPicker({
    container: $('refPickerContainer'),
    groups: state.references,
    onAddFiles: (cat, files) => {
      files.forEach((file) => {
        const item = {
          id: 'ref_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: file.name,
          url: URL.createObjectURL(file),
          file: file
        };
        state.references[cat].push(item);
      });
      renderReferences();
    },
    onRemoveFile: (cat, id) => {
      state.references[cat] = state.references[cat].filter(i => i.id !== id);
      renderReferences();
    },
    onOpenLibrary: (cat) => {
      alert(`Library opened for ${cat}. Previously stored reference assets can be selected here.`);
    }
  });
}

function renderPromptsInput() {
  const q = getActiveQueue();
  $('promptsCountBadge').textContent = `${q.prompts.length} prompts`;
}

function renderQueueView() {
  const q = getActiveQueue();
  $('queueMetaInfo').textContent = `${q.prompts.length} prompt${q.prompts.length === 1 ? '' : 's'} loaded`;

  const libraryNames = new Set([
    ...state.references.subject.map(s => s.name.toLowerCase()),
    ...state.references.scene.map(s => s.name.toLowerCase()),
    ...state.references.style.map(s => s.name.toLowerCase())
  ]);

  renderQueueList({
    container: $('queueListContainer'),
    prompts: q.prompts,
    libraryFileNames: libraryNames,
    onEdit: (id, newText) => {
      const idx = q.prompts.findIndex(p => p.id === id);
      if (idx !== -1) {
        const { cleanText, tags } = parsePromptTags(newText);
        q.prompts[idx].text = cleanText;
        q.prompts[idx].raw = newText;
        q.prompts[idx].tags = tags;
        saveQueues();
        renderQueueView();
        renderHeaderAndClapper();
      }
    },
    onDelete: (id) => {
      q.prompts = q.prompts.filter(p => p.id !== id);
      saveQueues();
      renderQueueView();
      renderHeaderAndClapper();
    },
    onMove: (fromIdx, toIdx) => {
      const item = q.prompts.splice(fromIdx, 1)[0];
      q.prompts.splice(toIdx, 0, item);
      saveQueues();
      renderQueueView();
    }
  });
}

function renderBottomActions() {
  const isRunning = state.run.status === 'running';
  const isPaused = state.run.status === 'paused';
  const startBtn = $('mainStartBtn');
  const pauseBtn = $('mainPauseBtn');
  const stopBtn = $('mainStopBtn');

  if (isPaused) {
    startBtn.textContent = 'Resume';
    startBtn.hidden = false;
    pauseBtn.hidden = true;
    stopBtn.disabled = false;
  } else if (isRunning) {
    startBtn.hidden = true;
    pauseBtn.hidden = false;
    stopBtn.disabled = false;
  } else {
    startBtn.textContent = 'Start';
    startBtn.hidden = false;
    pauseBtn.hidden = true;
    stopBtn.disabled = true;
  }
}

function renderCollapsibleStates() {
  const openSections = state.settings.openSections || {};
  ['sectionModel', 'sectionRefs', 'sectionPrompts', 'sectionQueue'].forEach(secId => {
    const el = $(secId);
    if (!el) return;
    const key = secId.replace('section', '').toLowerCase();
    const isOpen = openSections[key] !== false;
    el.classList.toggle('collapsed', !isOpen);
  });
}

function setupEventListeners() {
  // Mode switcher tabs
  $('tabImagesBtn').addEventListener('click', () => {
    state.settings.mode = 'images';
    saveSettings();
    renderModeTabs();
  });

  $('tabVideosBtn').addEventListener('click', () => {
    state.settings.mode = 'videos';
    saveSettings();
    renderModeTabs();
  });

  // Collapsible headers toggle
  document.querySelectorAll('.section-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.dataset.toggle;
      const section = $(targetId);
      if (!section) return;
      section.classList.toggle('collapsed');
      const key = targetId.replace('section', '').toLowerCase();
      if (!state.settings.openSections) state.settings.openSections = {};
      state.settings.openSections[key] = !section.classList.contains('collapsed');
      saveSettings();
    });
  });

  // Prompts Sub-tabs: Upload File vs Paste Text
  $('tabUploadFileBtn').addEventListener('click', () => {
    $('tabUploadFileBtn').classList.add('active');
    $('tabPasteTextBtn').classList.remove('active');
    $('uploadDropZone').hidden = false;
    $('pasteTextZone').hidden = true;
  });

  $('tabPasteTextBtn').addEventListener('click', () => {
    $('tabPasteTextBtn').classList.add('active');
    $('tabUploadFileBtn').classList.remove('active');
    $('uploadDropZone').hidden = true;
    $('pasteTextZone').hidden = false;
  });

  // File Upload Drop Zone
  const dropZone = $('uploadDropZone');
  const fileInput = $('promptFileInput');

  dropZone.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    loadPromptsTextIntoActiveQueue(text);
    fileInput.value = '';
  });

  // Paste Text actions
  $('applyPastedPromptsBtn').addEventListener('click', () => {
    const text = $('promptsRawInput').value;
    if (text.trim()) {
      loadPromptsTextIntoActiveQueue(text);
      $('promptsRawInput').value = '';
    }
  });

  $('clearPastedPromptsBtn').addEventListener('click', () => {
    $('promptsRawInput').value = '';
  });

  // Queue actions
  $('clearQueueBtn').addEventListener('click', () => {
    const q = getActiveQueue();
    if (q && window.confirm('Clear all prompts in this queue?')) {
      q.prompts = [];
      saveQueues();
      renderQueueView();
      renderHeaderAndClapper();
    }
  });

  // Bottom action buttons: Start, Pause, Stop
  $('mainStartBtn').addEventListener('click', async () => {
    const q = getActiveQueue();
    if (!q || q.prompts.length === 0) {
      alert('Please add or paste at least one prompt before starting.');
      return;
    }

    const command = state.run.status === 'paused' ? MESSAGES.RESUME : MESSAGES.START;
    state.run.status = 'running';
    renderBottomActions();
    renderHeaderAndClapper();

    await storage.set({ [STORAGE_KEYS.RUN]: state.run });
    sendFlowMessage({
      type: command,
      queueId: state.activeQueueId,
      settings: state.settings
    });
  });

  $('mainPauseBtn').addEventListener('click', async () => {
    state.run.status = 'paused';
    renderBottomActions();
    renderHeaderAndClapper();
    await storage.set({ [STORAGE_KEYS.RUN]: state.run });
    sendFlowMessage({ type: MESSAGES.PAUSE });
  });

  $('mainStopBtn').addEventListener('click', async () => {
    state.run.status = 'stopped';
    renderBottomActions();
    renderHeaderAndClapper();
    await storage.set({ [STORAGE_KEYS.RUN]: state.run });
    sendFlowMessage({ type: MESSAGES.STOP });
  });

  // Settings & History Bottom Sheets
  $('settingsHeaderBtn').addEventListener('click', openSettingsSheet);
  $('historyHeaderBtn').addEventListener('click', openHistorySheet);

  $('perPromptRefGuideBtn').addEventListener('click', () => {
    alert(
      'Per-Prompt References Guide:\n\n' +
      'Start a prompt with [subject: name.png, scene: name.png, style: name.png] to override references for that specific prompt.\n\n' +
      'Example:\n' +
      '[subject: kai.png, scene: market.png] A boy walks through the market at dawn.'
    );
  });
}

function loadPromptsTextIntoActiveQueue(text) {
  const { prompts, duplicates } = parsePrompts(text);
  const q = getActiveQueue();
  q.prompts.push(...prompts);
  saveQueues();
  renderQueueView();
  renderHeaderAndClapper();

  if (duplicates > 0) {
    console.info(`Loaded ${prompts.length} prompts (${duplicates} duplicate notice).`);
  }
}

function openSettingsSheet() {
  const container = $('settingsSheetContainer');
  renderSettingsSheet({
    container,
    settings: state.settings,
    onSave: (newSettings) => {
      state.settings = newSettings;
      saveSettings();
      renderAll();
    },
    onClearCache: async () => {
      await storage.set({ [STORAGE_KEYS.SELECTOR_OVERRIDES]: {} });
      sendFlowMessage({ type: MESSAGES.CLEAR_CACHE });
      alert('Cache cleared. Selector registry reset to defaults.');
    },
    onCalibrate: () => {
      sendFlowMessage({ type: MESSAGES.CALIBRATE });
      alert('Calibrate mode started on Google Flow tab. Tap the real buttons on Flow to save their selectors.');
    },
    onExportLog: () => {
      const logs = state.run.log || [];
      const blob = new Blob([logs.join('\n')], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `FlowAutomator-log-${Date.now()}.txt`;
      a.click();
    },
    onResetAll: async () => {
      state.settings = { ...DEFAULT_SETTINGS };
      state.queues = [...DEFAULT_QUEUES];
      state.run = { ...DEFAULT_RUN };
      state.history = [];
      await storage.set({
        [STORAGE_KEYS.SETTINGS]: state.settings,
        [STORAGE_KEYS.QUEUES]: state.queues,
        [STORAGE_KEYS.RUN]: state.run,
        [STORAGE_KEYS.HISTORY]: []
      });
      renderAll();
    },
    onClose: () => {
      container.innerHTML = '';
    }
  });
}

function openHistorySheet() {
  const container = $('historySheetContainer');
  renderHistorySheet({
    container,
    history: state.history,
    onLoadAndRerun: (historyItem) => {
      const q = getActiveQueue();
      if (historyItem.queueSnapshot && historyItem.queueSnapshot.prompts) {
        q.prompts = historyItem.queueSnapshot.prompts.map(p => ({
          ...p,
          status: 'idle'
        }));
      }
      saveQueues();
      renderQueueView();
      renderHeaderAndClapper();
      container.innerHTML = '';
    },
    onClearAll: async () => {
      state.history = [];
      await storage.set({ [STORAGE_KEYS.HISTORY]: [] });
      container.innerHTML = '';
    },
    onClose: () => {
      container.innerHTML = '';
    }
  });
}

function listenToStorageChanges() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (areaName !== 'local') return;
      if (changes[STORAGE_KEYS.RUN]) {
        state.run = changes[STORAGE_KEYS.RUN].newValue || { ...DEFAULT_RUN };
        renderHeaderAndClapper();
        renderBottomActions();
      }
      if (changes[STORAGE_KEYS.HISTORY]) {
        state.history = changes[STORAGE_KEYS.HISTORY].newValue || [];
      }
      if (changes[STORAGE_KEYS.QUEUES]) {
        state.queues = changes[STORAGE_KEYS.QUEUES].newValue || [...DEFAULT_QUEUES];
        renderQueueView();
        renderHeaderAndClapper();
      }
    });
  }
}

// Initialize on DOMContentLoaded
document.addEventListener('DOMContentLoaded', init);
