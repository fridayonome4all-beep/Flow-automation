export type GenerationMode = 'image' | 'video';

export type VideoModeType = 'text' | 'start_frame' | 'start_end' | 'reference';

export type QualityResolution = 'standard' | '1080p' | '2K' | '4K';

export type ReferenceCategory = 'subject' | 'scene' | 'style';

export interface ReferenceImageSlot {
  id: string;
  index: number;
  category: ReferenceCategory;
  tag: string;
  label: string;
  imageUrl?: string;
  fileName?: string;
  weight: number;
  assignedPromptCount?: number;
}

export interface DetectedReference {
  tag: string;
  type: ReferenceCategory;
  name: string;
  count: number;
  description?: string;
  mappedSlotId?: string;
  hasAssignedImage?: boolean;
}

export interface SuggestedAssignment {
  tag: string;
  type: ReferenceCategory;
  suggestedName: string;
  mentionCount: number;
  availableSlotIndex: number;
  targetSlotId: string;
}

export interface PromptItem {
  id: string;
  customId: string; // e.g. '001', '24-00', or user custom ID
  hasEmbeddedId?: boolean; // true if prompt text contained its own ID
  raw: string;
  text: string;
  tags?: {
    subject: string[];
    scene: string[];
    style: string[];
    start?: string | null;
    end?: string | null;
    ref?: string[];
  } | null;
  status: 'idle' | 'running' | 'done' | 'failed' | 'blocked';
  files: string[];
  error?: string | null;
  generatedUrl?: string;
  referenceImageUrl?: string; // Direct per-prompt reference image override
  referenceImageName?: string;
}

export interface GoogleAccount {
  isSignedIn: boolean;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

export interface QueueConfig {
  mode: GenerationMode;
  speed: 'fast' | 'balanced' | 'slow' | 'custom';
  customDelay: number;
  customMinS?: number;
  customMaxS?: number;
  customConcurrency?: number;
  
  // File naming: 'id' | 'slug' | 'custom'
  naming: 'id' | 'slug' | 'custom';
  customNamingTemplate: string; // e.g. '{id}_v{v}' or '{id}_{prompt_start}_{timestamp}'
  autoDownload: boolean; // Auto-download generated media as soon as completed

  image: {
    model: string;
    aspect: string;
    count: string;
    quality: string;
    resolution: QualityResolution;
    autoUpscale: boolean;
  };

  video: {
    model: string;
    videoMode: VideoModeType;
    aspect: string;
    duration: string;
    count: string;
    resolution: QualityResolution;
    autoUpscale: boolean;
    startFrameSlotId?: string;
    endFrameSlotId?: string;
  };

  references: {
    enabled: boolean;
    differentImageForEachPrompt: boolean;
    subjectSlots: ReferenceImageSlot[];
    sceneSlots: ReferenceImageSlot[];
    styleSlots: ReferenceImageSlot[];
  };

  reliability: {
    autoRefreshTab: boolean;
    refreshIntervalPrompts: number;
    watchdogTimeoutMinutes: number;
    clearCacheBeforeRun: boolean;
  };
}

export interface QueueTab {
  id: string;
  name: string;
  promptsText: string;
  parsedPrompts: PromptItem[];
  config: QueueConfig;
  status: 'idle' | 'running' | 'paused' | 'done' | 'stopped' | 'error';
  currentIndex: number;
  completedCount: number;
  failedCount: number;
  logs: string[];
  lastRunTimestamp?: number;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  queueName: string;
  status: 'done' | 'interrupted' | 'stopped' | 'error' | 'idle' | 'draft';
  total: number;
  done: number;
  failed: number;
  mode: GenerationMode;
  promptsSnapshot: PromptItem[];
}

export interface RemoteConfig {
  version: string;
  updatedAt: string;
  flowUrlPatterns: string[];
  selectors: Record<string, string>;
  models: {
    image: string[];
    video: string[];
  };
  resolutions: QualityResolution[];
}
