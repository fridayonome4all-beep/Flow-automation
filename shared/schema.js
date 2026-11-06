// Shared data models, storage defaults, message types, and schema migrations.

export const EXTENSION_NAME = 'FlowBatch';
export const EXTENSION_FOLDER = 'FlowBatch';
export const SCHEMA_VERSION = 2;

export const MODELS = {
  images: [
    { id: 'Nano Banana 2.1', label: '🍌 Nano Banana 2.1', default: true },
    { id: 'Nano Banana Pro', label: 'Nano Banana Pro' },
    { id: 'Nano Banana Lite', label: 'Nano Banana Lite' }
  ],
  videos: [
    { id: 'Omni Flash 1.1', label: 'Omni Flash 1.1', icon: 'sparkle', supportedDurations: ['4s', '6s', '8s'] },
    { id: 'Veo 3.1 Lite', label: 'Veo 3.1 Lite', icon: 'box', supportedDurations: ['4s', '6s', '8s'] },
    { id: 'Veo 3.1 Fast', label: 'Veo 3.1 Fast', icon: 'zap', default: true, supportedDurations: ['4s', '6s', '8s'] },
    { id: 'Veo 3.1 Quality', label: 'Veo 3.1 Quality', icon: 'gem', supportedDurations: ['4s', '6s', '8s', '10s'] }
  ]
};

export const ASPECT_RATIOS = {
  images: ['16:9', '4:3', '1:1', '3:4', '9:16'],
  videos: ['16:9', '9:16']
};

export const DURATIONS = ['4s', '6s', '8s', '10s'];
export const COUNTS = ['x1', 'x2', 'x3', 'x4'];

export const VIDEO_MODES = [
  { id: 'text', label: 'Text', icon: 'edit' },
  { id: 'start', label: 'Start', icon: 'frame' },
  { id: 'start_end', label: 'S+E', icon: 'split' },
  { id: 'ref', label: 'Ref', icon: 'stack' }
];

export const IMAGE_QUALITIES = [
  { id: 'standard', label: 'Standard', desc: 'Standard generation' },
  { id: '2k', label: '2K upscale', desc: 'Uses extra upscale step, falls back to Standard if unavailable' }
];

export const VIDEO_UPSCALES = [
  { id: 'none', label: 'None' },
  { id: '1080p', label: '1080p' },
  { id: '4k', label: '4K' }
];

export const SPEED_PRESETS = {
  slow: { id: 'slow', label: 'Slow', minS: 15, maxS: 25, concurrency: 1 },
  balanced: { id: 'balanced', label: 'Balanced', minS: 6, maxS: 10, concurrency: 1 },
  fast: { id: 'fast', label: 'Fast', minS: 1, maxS: 3, concurrency: 1 },
  custom: { id: 'custom', label: 'Custom', minS: 5, maxS: 12, concurrency: 1 }
};

export const STORAGE_KEYS = {
  SCHEMA_VERSION: 'schemaVersion',
  SETTINGS: 'settings',
  QUEUES: 'queues',
  ACTIVE_QUEUE_ID: 'activeQueueId',
  RUN: 'run',
  HISTORY: 'history',
  SELECTOR_OVERRIDES: 'selectorOverrides',
  REF_LIBRARY: 'refLibrary'
};

export const MESSAGES = {
  START: 'START',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  STOP: 'STOP',
  CALIBRATE: 'CALIBRATE',
  TEST_SELECTORS: 'TEST_SELECTORS',
  CLEAR_CACHE: 'CLEAR_CACHE',
  DOWNLOAD: 'DOWNLOAD',
  REFRESH_TAB: 'REFRESH_TAB',
  RUN_UPDATE: 'RUN_UPDATE',
  PING: 'PING'
};

export const DEFAULT_SETTINGS = {
  mode: 'images',
  images: {
    model: '🍌 Nano Banana 2.1',
    aspect: '16:9',
    count: 'x1',
    quality: 'standard'
  },
  videos: {
    mode: 'text',
    model: 'Veo 3.1 Fast',
    aspect: '16:9',
    duration: '8s',
    count: 'x1',
    upscale: 'none'
  },
  speed: {
    preset: 'fast',
    minS: 1,
    maxS: 3,
    concurrency: 1
  },
  naming: 'num', // 'num' | 'slug' | 'custom'
  customNamingPattern: '{id}',
  autoDownload: true, // Toggle automatic file download
  autoRefresh: 'off', // 'off' | 3 | 5 | 10
  googleAuth: {
    signedIn: false,
    email: ''
  },
  openSections: {
    model: true,
    refs: false,
    prompts: true,
    queue: true
  }
};

export const DEFAULT_RUN = {
  id: null,
  queueId: null,
  status: 'idle', // 'idle' | 'running' | 'paused' | 'stopped' | 'done' | 'error' | 'rate_limited'
  index: 0,
  done: 0,
  failed: 0,
  startedAt: null,
  currentPromptPreview: '',
  log: []
};

export const DEFAULT_QUEUES = [
  {
    id: 'main',
    name: 'Main',
    type: 'images',
    prompts: []
  }
];

export function createQueue(name, type = 'images') {
  return {
    id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
    name: name || 'Queue',
    type: type,
    prompts: []
  };
}

export function migrateStorage(raw = {}) {
  const currentVersion = raw[STORAGE_KEYS.SCHEMA_VERSION] || 1;
  const migrated = { ...raw };

  if (currentVersion < 2) {
    migrated[STORAGE_KEYS.SETTINGS] = {
      ...DEFAULT_SETTINGS,
      ...(raw[STORAGE_KEYS.SETTINGS] || {})
    };
    if (!migrated[STORAGE_KEYS.QUEUES] || !migrated[STORAGE_KEYS.QUEUES].length) {
      migrated[STORAGE_KEYS.QUEUES] = DEFAULT_QUEUES;
    }
    if (!migrated[STORAGE_KEYS.ACTIVE_QUEUE_ID]) {
      migrated[STORAGE_KEYS.ACTIVE_QUEUE_ID] = 'main';
    }
    if (!migrated[STORAGE_KEYS.RUN]) {
      migrated[STORAGE_KEYS.RUN] = DEFAULT_RUN;
    }
    if (!migrated[STORAGE_KEYS.HISTORY]) {
      migrated[STORAGE_KEYS.HISTORY] = [];
    }
    if (!migrated[STORAGE_KEYS.SELECTOR_OVERRIDES]) {
      migrated[STORAGE_KEYS.SELECTOR_OVERRIDES] = {};
    }
    if (!migrated[STORAGE_KEYS.REF_LIBRARY]) {
      migrated[STORAGE_KEYS.REF_LIBRARY] = [];
    }
    migrated[STORAGE_KEYS.SCHEMA_VERSION] = SCHEMA_VERSION;
  }

  return migrated;
}

// Attach to window for classic non-module content scripts
if (typeof window !== 'undefined') {
  window.FlowSchema = {
    EXTENSION_NAME,
    EXTENSION_FOLDER,
    SCHEMA_VERSION,
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
    createQueue,
    migrateStorage
  };
}
