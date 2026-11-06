/**
 * FlowBatch - Main Application Studio
 * Enterprise bulk automation for Google Flow with ID-based saving, 
 * progressive slot disclosure, prompt @tag visualizer, and smart recovery history.
 */

import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, AlertCircle } from 'lucide-react';
import { Header } from './components/Header';
import { PromptEditor } from './components/PromptEditor';
import { ReferenceManager } from './components/ReferenceManager';
import { GenerationSettings } from './components/GenerationSettings';
import { FlowSimulator } from './components/FlowSimulator';
import { PromptScanModal } from './components/PromptScanModal';
import { RemoteConfigModal } from './components/RemoteConfigModal';
import { HistoryRecoveryModal } from './components/HistoryRecoveryModal';
import { ReferencePerPromptModal } from './components/ReferencePerPromptModal';
import { GoogleDriveModal } from './components/GoogleDriveModal';
import { 
  QueueTab, 
  QueueConfig, 
  ReferenceImageSlot, 
  DetectedReference, 
  ReferenceCategory,
  HistoryItem,
  PromptItem,
  SuggestedAssignment,
  GoogleAccount
} from './types';
import { 
  createInitialSlots, 
  scanPromptsClient, 
  parsePromptLineToItem,
  autoFormatAndSplitPrompts
} from './services/promptScanner';

const DEFAULT_CONFIG: QueueConfig = {
  mode: 'image',
  speed: 'fast',
  customDelay: 8,
  naming: 'id', // Default to unique ID
  customNamingTemplate: '{id}',
  autoDownload: true, // Auto-download on generation completion
  image: {
    model: '🍌 Nano Banana 2.1',
    aspect: '16:9',
    count: '1',
    quality: 'standard',
    resolution: 'standard',
    autoUpscale: false,
  },
  video: {
    model: 'Veo 3.1 Fast',
    videoMode: 'start_frame',
    aspect: '16:9',
    duration: '8s',
    count: '1',
    resolution: '1080p',
    autoUpscale: false,
  },
  references: {
    enabled: true,
    differentImageForEachPrompt: false,
    subjectSlots: createInitialSlots('subject'),
    sceneSlots: createInitialSlots('scene'),
    styleSlots: createInitialSlots('style'),
  },
  reliability: {
    autoRefreshTab: false, // Default off so tab is never interrupted unexpectedly
    refreshIntervalPrompts: 10,
    watchdogTimeoutMinutes: 4,
    clearCacheBeforeRun: false,
  },
};

export default function App() {
  // Start with clean empty queues (no dummy demo text or generic placeholders)
  const [queues, setQueues] = useState<QueueTab[]>([
    {
      id: 'main',
      name: 'Main Queue',
      promptsText: '',
      parsedPrompts: [],
      config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      status: 'idle',
      currentIndex: 0,
      completedCount: 0,
      failedCount: 0,
      logs: ['FlowBatch initialized. Load or paste prompts to begin.'],
    }
  ]);

  const [activeQueueId, setActiveQueueId] = useState<string>('main');
  const [activeView, setActiveView] = useState<'studio' | 'references' | 'simulator'>('studio');
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isPerPromptModalOpen, setIsPerPromptModalOpen] = useState(false);
  const [isConfirmRestartOpen, setIsConfirmRestartOpen] = useState(false);
  const [isDriveModalOpen, setIsDriveModalOpen] = useState(false);

  const [googleAccount, setGoogleAccount] = useState<GoogleAccount>({
    isSignedIn: true,
    email: 'mtempone222@gmail.com',
    name: 'Michael',
    avatarUrl: null
  });
  const [flowTabStatus, setFlowTabStatus] = useState<'connected' | 'disconnected' | 'searching'>('connected');

  const [detectedReferences, setDetectedReferences] = useState<DetectedReference[]>([]);
  const [suggestedAssignments, setSuggestedAssignments] = useState<SuggestedAssignment[]>([]);
  
  // Account-agnostic persistent history (survives email changes and browser sessions)
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('flow_global_history');
      if (saved) return JSON.parse(saved);
    } catch (_) {}
    return [];
  });

  const [generatedResults, setGeneratedResults] = useState<any[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem('flow_global_history', JSON.stringify(history));
    } catch (_) {}
  }, [history]);

  const runTimerRef = useRef<NodeJS.Timeout | null>(null);
  const activeQueue = queues.find((q) => q.id === activeQueueId) || queues[0];

  // Auto-scan, parse prompts into items, and auto-save prompt progress to history immediately
  useEffect(() => {
    if (activeQueue) {
      const rawBlocks = autoFormatAndSplitPrompts(activeQueue.promptsText);
      const items = rawBlocks.map((b, i) => parsePromptLineToItem(b, i));

      const scanResult = scanPromptsClient(
        activeQueue.promptsText,
        activeQueue.config.references.subjectSlots,
        activeQueue.config.references.sceneSlots,
        activeQueue.config.references.styleSlots
      );

      setDetectedReferences(scanResult.detectedReferences);
      setSuggestedAssignments(scanResult.suggestedAssignments);

      // Preserve status of items if text is identical
      updateActiveQueue({ parsedPrompts: items });

      // Automatically capture loaded prompts to history so work is preserved every step of the way
      if (items.length > 0) {
        setHistory((prev) => {
          const existingIdx = prev.findIndex(
            (h) => h.queueName === activeQueue.name && (h.status === 'idle' || h.status === 'draft')
          );
          const snapshot: HistoryItem = {
            id: existingIdx >= 0 ? prev[existingIdx].id : 'draft-' + Date.now(),
            timestamp: Date.now(),
            queueName: activeQueue.name,
            status: 'idle',
            total: items.length,
            done: items.filter((p) => p.status === 'done').length,
            failed: items.filter((p) => p.status === 'failed').length,
            mode: activeQueue.config.mode,
            promptsSnapshot: JSON.parse(JSON.stringify(items))
          };
          if (existingIdx >= 0) {
            const nextList = [...prev];
            nextList[existingIdx] = snapshot;
            return nextList;
          }
          return [snapshot, ...prev.slice(0, 24)];
        });
      }
    }
  }, [activeQueue?.promptsText]);

  const updateActiveQueue = (updates: Partial<QueueTab>) => {
    setQueues((prev) =>
      prev.map((q) => (q.id === activeQueueId ? { ...q, ...updates } : q))
    );
  };

  const updateActiveConfig = (configUpdates: Partial<QueueConfig>) => {
    updateActiveQueue({
      config: {
        ...activeQueue.config,
        ...configUpdates,
      },
    });
  };

  // Queue Management
  const handleAddQueue = (name: string) => {
    const newId = 'q-' + Date.now();
    const newQueue: QueueTab = {
      id: newId,
      name,
      promptsText: '',
      parsedPrompts: [],
      config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      status: 'idle',
      currentIndex: 0,
      completedCount: 0,
      failedCount: 0,
      logs: [`Queue "${name}" created.`],
    };
    setQueues((prev) => [...prev, newQueue]);
    setActiveQueueId(newId);
  };

  const handleRenameQueue = (id: string, newName: string) => {
    setQueues((prev) =>
      prev.map((q) => (q.id === id ? { ...q, name: newName } : q))
    );
  };

  const handleDeleteQueue = (id: string) => {
    if (queues.length <= 1) return;
    setQueues((prev) => prev.filter((q) => q.id !== id));
    if (activeQueueId === id) {
      const remaining = queues.filter((q) => q.id !== id);
      setActiveQueueId(remaining[0].id);
    }
  };

  const handleDuplicateQueue = (id: string) => {
    const source = queues.find((q) => q.id === id);
    if (!source) return;
    const duplicated: QueueTab = {
      ...JSON.parse(JSON.stringify(source)),
      id: 'q-' + Date.now(),
      name: `${source.name} (Copy)`,
      status: 'idle',
      currentIndex: 0,
      completedCount: 0,
      failedCount: 0,
    };
    setQueues((prev) => [...prev, duplicated]);
    setActiveQueueId(duplicated.id);
  };

  // Reference Slot Updates
  const handleUpdateSlot = (
    category: ReferenceCategory,
    slotIndex: number,
    updates: Partial<ReferenceImageSlot>
  ) => {
    const targetKey =
      category === 'subject'
        ? 'subjectSlots'
        : category === 'scene'
        ? 'sceneSlots'
        : 'styleSlots';

    const currentList = activeQueue.config.references[targetKey];
    const updatedList = currentList.map((slot) =>
      slot.index === slotIndex ? { ...slot, ...updates } : slot
    );

    updateActiveConfig({
      references: {
        ...activeQueue.config.references,
        [targetKey]: updatedList,
      },
    });
  };

  const handleClearSlot = (category: ReferenceCategory, slotIndex: number) => {
    handleUpdateSlot(category, slotIndex, {
      imageUrl: undefined,
      fileName: undefined,
      label: `${category.charAt(0).toUpperCase() + category.slice(1)} ${slotIndex}`,
    });
  };

  const handleClearAllCategory = (category: ReferenceCategory) => {
    const targetKey =
      category === 'subject'
        ? 'subjectSlots'
        : category === 'scene'
        ? 'sceneSlots'
        : 'styleSlots';

    updateActiveConfig({
      references: {
        ...activeQueue.config.references,
        [targetKey]: createInitialSlots(category),
      },
    });
  };

  // Tap to Retry individual prompt
  const handleRetryPrompt = (promptId: string) => {
    const updated = activeQueue.parsedPrompts.map(p => {
      if (p.id === promptId) {
        return { ...p, status: 'idle' as const, error: null };
      }
      return p;
    });
    updateActiveQueue({ parsedPrompts: updated });
    handleStartQueue();
  };

  // Execution Simulator Loop with Start, Pause, Resume, and Stop
  const runBatchStep = (startIndex: number) => {
    const items = [...activeQueue.parsedPrompts];
    if (startIndex >= items.length) {
      finishQueueRun();
      return;
    }

    let index = startIndex;

    const executeStep = () => {
      if (index >= items.length) {
        finishQueueRun();
        return;
      }

      const item = items[index];
      const timeStr = new Date().toLocaleTimeString();
      const promptId = item.customId || String(index + 1).padStart(3, '0');

      // Update current prompt item to running
      items[index] = { ...items[index], status: 'running' };
      updateActiveQueue({ parsedPrompts: [...items], currentIndex: index });

      // Strict ID naming rule: match exact ID without adding generic text
      const isVideo = activeQueue.config.mode === 'video';
      const ext = isVideo ? 'mp4' : 'png';
      let filename = `${promptId}.${ext}`;
      if (activeQueue.config.naming === 'slug') {
        const slug = item.text.slice(0, 20).toLowerCase().replace(/[^a-z0-9]+/g, '-');
        filename = `${promptId}-${slug}.${ext}`;
      } else if (activeQueue.config.naming === 'custom') {
        filename = (activeQueue.config.customNamingTemplate || '{id}_v{v}')
          .replace('{id}', promptId)
          .replace('{v}', '1')
          + `.${ext}`;
      }

      const newLogs = [
        ...activeQueue.logs,
        `[${timeStr}] TAKE #${promptId}: "${item.text.slice(0, 45)}..."`,
        `[${timeStr}] Flow generation output received. Strict ID: ${promptId}`,
        `[${timeStr}] Saved ${filename}`,
      ];

      items[index] = {
        ...items[index],
        status: 'done',
        files: [filename]
      };

      const resultItem = {
        id: `res-${Date.now()}-${index}`,
        index: index + 1,
        prompt: item.text,
        imageUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="225" viewBox="0 0 400 225"><rect width="400" height="225" fill="%23141722"/><text x="50%" y="50%" fill="%23eceef2" font-family="monospace" font-size="14" dominant-baseline="middle" text-anchor="middle">Generated Artifact ' + promptId + '</text></svg>',
        filename,
        resolution: isVideo ? activeQueue.config.video.resolution : activeQueue.config.image.resolution,
        timestamp: timeStr,
        isVideo
      };

      setGeneratedResults(prev => [resultItem, ...prev]);

      index++;
      updateActiveQueue({
        parsedPrompts: [...items],
        currentIndex: index,
        completedCount: index,
        logs: newLogs
      });

      // Calculate sequential delay from Speed setting
      const getDelayMs = () => {
        if (activeQueue.config.speed === 'fast') return 1200;
        if (activeQueue.config.speed === 'balanced') return 6000;
        if (activeQueue.config.speed === 'slow') return 15000;
        return (activeQueue.config.customDelay || 3) * 1000;
      };

      if (index < items.length) {
        runTimerRef.current = setTimeout(executeStep, getDelayMs());
      } else {
        finishQueueRun();
      }
    };

    runTimerRef.current = setTimeout(executeStep, 400);
  };

  const finishQueueRun = () => {
    setIsRunning(false);
    setIsPaused(false);
    updateActiveQueue({
      status: 'done',
      logs: [
        ...activeQueue.logs,
        `[${new Date().toLocaleTimeString()}] ✓ Finished batch cleanly. Ready for review (no auto-refresh).`
      ]
    });

    const items = activeQueue.parsedPrompts;
    const newHistoryItem: HistoryItem = {
      id: 'hist-' + Date.now(),
      timestamp: Date.now(),
      queueName: activeQueue.name,
      status: 'done',
      total: items.length,
      done: items.filter(p => p.status === 'done').length,
      failed: items.filter(p => p.status === 'failed').length,
      mode: activeQueue.config.mode,
      promptsSnapshot: JSON.parse(JSON.stringify(items))
    };
    setHistory(prev => [newHistoryItem, ...prev.slice(0, 24)]);
  };

  // Helper to compute target filename based on queue configuration
  const computeTargetFilename = (prompt: PromptItem, config: QueueConfig): string => {
    const ext = config.mode === 'video' ? 'mp4' : 'png';
    const customId = prompt.customId || '01';
    if (config.naming === 'id') {
      return `${customId}.${ext}`;
    }
    if (config.naming === 'slug') {
      const slug = prompt.text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30);
      return `${customId}-${slug || 'take'}.${ext}`;
    }
    const tmpl = config.customNamingTemplate || '{id}';
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    return tmpl
      .replace(/\{id\}/g, customId)
      .replace(/\{index\}/g, customId)
      .replace(/\{timestamp\}/g, dateStr)
      .replace(/\{prompt_start\}/g, prompt.text.slice(0, 15).replace(/[^a-zA-Z0-9]/g, ''))
      .replace(/\{slug\}/g, 'take')
      .replace(/\{v\}/g, '1') + `.${ext}`;
  };

  const handleStartQueue = () => {
    const rawItems = activeQueue.parsedPrompts;
    if (rawItems.length === 0) return;

    // =========================================================================
    // PRE-CHECK STEP: Cross-reference existing saved filenames in history
    // against current pending prompts to automatically skip or flag already generated files.
    // =========================================================================
    const savedFilenames = new Set<string>();
    const savedCustomIds = new Set<string>();
    const savedTexts = new Set<string>();

    history.forEach((h) => {
      (h.promptsSnapshot || []).forEach((hp) => {
        if (hp.status === 'done') {
          if (hp.customId) {
            const cleanId = hp.customId.toLowerCase().trim();
            savedCustomIds.add(cleanId);
            savedFilenames.add(`${cleanId}.png`);
            savedFilenames.add(`${cleanId}.mp4`);
          }
          if (hp.text) {
            savedTexts.add(hp.text.trim().toLowerCase());
          }
          const fname = computeTargetFilename(hp, activeQueue.config).toLowerCase();
          savedFilenames.add(fname);
        }
      });
    });

    // Check each pending prompt against the saved history signatures
    const preCheckSkipped: { id: string; filename: string }[] = [];
    const items = rawItems.map((p) => {
      if (p.status === 'done') return p; // Already completed in active queue

      const targetFilename = computeTargetFilename(p, activeQueue.config);
      const targetLower = targetFilename.toLowerCase();
      const idMatch = p.customId && savedCustomIds.has(p.customId.toLowerCase().trim());
      const filenameMatch = savedFilenames.has(targetLower);
      const textMatch = savedTexts.has(p.text.trim().toLowerCase());

      if (filenameMatch || idMatch || textMatch) {
        preCheckSkipped.push({ id: p.customId, filename: targetFilename });
        return {
          ...p,
          status: 'done' as const,
          error: `[Pre-check] Already generated in history (${targetFilename}). Auto-skipped.`,
        };
      }
      return p;
    });

    // Update activeQueue if any items were auto-flagged/skipped
    if (preCheckSkipped.length > 0) {
      updateActiveQueue({ parsedPrompts: items });
    }

    // Check if ALL prompts are now completed (either prior or via Pre-check)
    const allDone = items.length > 0 && items.every((p) => p.status === 'done');
    if (allDone) {
      const skippedSummary = preCheckSkipped.length > 0
        ? `Pre-check verified that all ${items.length} prompts were already generated (${preCheckSkipped.length} skipped from history). No new files to create.`
        : `All ${items.length} prompts in this queue are already completed.`;

      updateActiveQueue({
        parsedPrompts: items,
        logs: [
          ...activeQueue.logs,
          `[${new Date().toLocaleTimeString()}] 🔍 Pre-check Complete: ${skippedSummary}`,
        ],
      });
      setIsConfirmRestartOpen(true);
      return;
    }

    // Find the first prompt that is NOT done yet, so we resume remaining without re-generating completed ones
    const firstUnfinishedIdx = items.findIndex((p) => p.status !== 'done');
    const startIdx = firstUnfinishedIdx >= 0 ? firstUnfinishedIdx : 0;
    const completedSoFar = items.filter((p) => p.status === 'done').length;

    const preCheckLog = preCheckSkipped.length > 0
      ? `[${new Date().toLocaleTimeString()}] 🔍 Pre-check: Cross-referenced saved history. Automatically skipped ${preCheckSkipped.length} existing file(s) (${preCheckSkipped.slice(0, 3).map(s => s.filename).join(', ')}${preCheckSkipped.length > 3 ? ` +${preCheckSkipped.length - 3} more` : ''}).`
      : null;

    const resumeLog = startIdx > 0
      ? `[${new Date().toLocaleTimeString()}] Resuming queue from prompt #${startIdx + 1} (${items.length - startIdx} remaining). Preserved ${completedSoFar} generated artifacts.`
      : `[${new Date().toLocaleTimeString()}] Queue started: ${items.length} prompts. Target format: ${activeQueue.config.naming.toUpperCase()}-based ordered file names.`;

    const newLogs = preCheckLog ? [...activeQueue.logs, preCheckLog, resumeLog] : [...activeQueue.logs, resumeLog];

    setIsRunning(true);
    setIsPaused(false);
    updateActiveQueue({
      parsedPrompts: items,
      status: 'running',
      currentIndex: startIdx,
      completedCount: completedSoFar,
      failedCount: 0,
      logs: newLogs,
    });

    runBatchStep(startIdx);
  };

  const handleForceRestartAll = () => {
    setIsConfirmRestartOpen(false);
    const resetItems = activeQueue.parsedPrompts.map(p => ({ ...p, status: 'idle' as const, error: null }));
    setIsRunning(true);
    setIsPaused(false);
    updateActiveQueue({
      parsedPrompts: resetItems,
      status: 'running',
      currentIndex: 0,
      completedCount: 0,
      failedCount: 0,
      logs: [
        ...activeQueue.logs,
        `[${new Date().toLocaleTimeString()}] User confirmed restart: Resetting status and regenerating all ${resetItems.length} prompts.`,
      ],
    });

    runBatchStep(0);
  };

  const handlePauseQueue = () => {
    if (runTimerRef.current) {
      clearTimeout(runTimerRef.current);
    }
    setIsPaused(true);
    updateActiveQueue({
      status: 'paused',
      logs: [
        ...activeQueue.logs,
        `[${new Date().toLocaleTimeString()}] Queue paused by user.`
      ]
    });
  };

  const handleResumeQueue = () => {
    setIsPaused(false);
    setIsRunning(true);
    updateActiveQueue({
      status: 'running',
      logs: [
        ...activeQueue.logs,
        `[${new Date().toLocaleTimeString()}] Queue resumed.`
      ]
    });
    runBatchStep(activeQueue.currentIndex);
  };

  const handleStopQueue = () => {
    if (runTimerRef.current) {
      clearTimeout(runTimerRef.current);
    }
    setIsRunning(false);
    setIsPaused(false);
    updateActiveQueue({
      status: 'stopped',
      logs: [
        ...activeQueue.logs,
        `[${new Date().toLocaleTimeString()}] Queue stopped by user.`
      ]
    });
  };

  const handleDeletePromptItem = (promptId: string) => {
    const remaining = activeQueue.parsedPrompts.filter(p => p.id !== promptId);
    const rebuilt = remaining.map(p => `${p.customId ? p.customId + ': ' : ''}${p.text}`).join('\n\n');
    updateActiveQueue({
      parsedPrompts: remaining,
      promptsText: rebuilt
    });
  };

  const handleSavePerPromptReferences = (updatedItems: PromptItem[]) => {
    const rebuilt = updatedItems.map(p => `${p.customId ? p.customId + ': ' : ''}${p.text}`).join('\n\n');
    updateActiveQueue({
      parsedPrompts: updatedItems,
      promptsText: rebuilt
    });
  };

  // Recovery Actions from History
  const handleResumeFailedOnly = (failedItems: PromptItem[]) => {
    const rawRebuilt = failedItems.map(p => `${p.customId}: ${p.text}`).join('\n\n');
    updateActiveQueue({
      promptsText: rawRebuilt,
      parsedPrompts: failedItems.map(p => ({ ...p, status: 'idle' })),
      currentIndex: 0,
      completedCount: 0,
      status: 'idle',
      logs: [`Resumed ${failedItems.length} unfinished / failed prompts from previous session.`]
    });
  };

  const handleRestoreFullQueue = (allPrompts: PromptItem[]) => {
    const rawRebuilt = allPrompts.map(p => `${p.customId}: ${p.text}`).join('\n\n');
    updateActiveQueue({
      promptsText: rawRebuilt,
      parsedPrompts: allPrompts,
      currentIndex: 0,
      status: 'idle',
      logs: ['Full queue restored from history.']
    });
  };

  const handleRetryAllFailedInNewQueue = (failedItems: PromptItem[]) => {
    const newQueueId = 'retry-' + Date.now();
    const rawRebuilt = failedItems.map(p => `${p.customId}: ${p.text}`).join('\n\n');
    const newQueue: QueueTab = {
      id: newQueueId,
      name: `Retry Queue (${failedItems.length})`,
      promptsText: rawRebuilt,
      parsedPrompts: failedItems.map(p => ({ ...p, status: 'idle', error: null })),
      config: JSON.parse(JSON.stringify(activeQueue.config)),
      status: 'idle',
      currentIndex: 0,
      completedCount: 0,
      failedCount: 0,
      logs: [
        `[${new Date().toLocaleTimeString()}] Queue created with ${failedItems.length} failed prompts from previous session.`,
        `[${new Date().toLocaleTimeString()}] Click Start to execute immediately.`
      ]
    };

    setQueues(prev => [...prev, newQueue]);
    setActiveQueueId(newQueueId);
  };

  const handleDeletePromptsFromHistory = (historyId: string, promptIdsToDelete: string[]) => {
    setHistory(prev => prev.map(item => {
      if (item.id === historyId) {
        const remainingPrompts = item.promptsSnapshot.filter(p => !promptIdsToDelete.includes(p.id));
        return {
          ...item,
          promptsSnapshot: remainingPrompts,
          total: remainingPrompts.length,
          done: remainingPrompts.filter(p => p.status === 'done').length,
          failed: remainingPrompts.filter(p => p.status === 'failed' || p.status === 'idle').length
        };
      }
      return item;
    }).filter(item => item.promptsSnapshot.length > 0));
  };

  const handleDeleteSession = (historyId: string) => {
    setHistory(prev => prev.filter(item => item.id !== historyId));
  };

  const handleClearCache = () => {
    setGeneratedResults([]);
    updateActiveQueue({
      logs: [`[${new Date().toLocaleTimeString()}] Cache and memory buffers cleared.`],
      currentIndex: 0,
      completedCount: 0,
      status: 'idle',
    });
  };

  const allActiveSlots = [
    ...activeQueue.config.references.subjectSlots,
    ...activeQueue.config.references.sceneSlots,
    ...activeQueue.config.references.styleSlots
  ];

  const allPromptsDone = activeQueue.parsedPrompts.length > 0 && activeQueue.parsedPrompts.every(p => p.status === 'done');
  const somePromptsDone = !allPromptsDone && activeQueue.parsedPrompts.some(p => p.status === 'done');
  const remainingCount = activeQueue.parsedPrompts.filter(p => p.status !== 'done').length;

  return (
    <div className="min-h-screen flex flex-col bg-[#090a0d] text-[#eceef2] font-sans antialiased">
      {/* Top Application Header (Short name, Flow status beacon in center, Google emblem on right) */}
      <Header
        flowTabStatus={flowTabStatus}
        onConnectFlowTab={() => setFlowTabStatus('connected')}
        googleAccount={googleAccount}
        onToggleGoogleSignIn={() => setIsDriveModalOpen(true)}
        queueProgress={{
          total: activeQueue.parsedPrompts.length,
          completed: activeQueue.parsedPrompts.filter(p => p.status === 'done').length,
          isRunning,
          isPaused
        }}
      />

      {/* Main Workspace Body - Strictly contained for extension popup/sheet view */}
      <main className="flex-1 p-3 sm:p-4 max-w-md sm:max-w-xl lg:max-w-4xl mx-auto w-full">
        {activeView === 'studio' && (
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 pb-20 sm:pb-24">
            {/* Prompts Queue Editor (Shows first on mobile) */}
            <div className="lg:col-span-7 space-y-4">
              <PromptEditor
                promptsText={activeQueue.promptsText}
                parsedPrompts={activeQueue.parsedPrompts}
                onChangePrompts={(text) => updateActiveQueue({ promptsText: text })}
                detectedReferences={detectedReferences}
                allSlots={allActiveSlots}
                onOpenScanModal={() => setIsScanModalOpen(true)}
                onSelectTag={() => setActiveView('references')}
                onRetryPrompt={handleRetryPrompt}
                onOpenHistoryModal={() => setIsHistoryModalOpen(true)}
                onOpenSettingsModal={() => setIsConfigModalOpen(true)}
                onClearQueue={() => updateActiveQueue({ promptsText: '', parsedPrompts: [] })}
                onDeletePromptItem={handleDeletePromptItem}
                queues={queues}
                activeQueueId={activeQueueId}
                onSelectQueue={setActiveQueueId}
                onAddQueue={handleAddQueue}
                onDeleteQueue={handleDeleteQueue}
                completedCount={activeQueue.completedCount}
              />
            </div>

            {/* Generation Settings & Parameters (Studio & References view switcher is here!) */}
            <div className="lg:col-span-5 space-y-4">
              <GenerationSettings
                config={activeQueue.config}
                onChangeConfig={updateActiveConfig}
                availableSubjectSlots={activeQueue.config.references.subjectSlots}
                onOpenPerPromptModal={() => setIsPerPromptModalOpen(true)}
                onOpenScanModal={() => setIsScanModalOpen(true)}
                onToggleSimulator={() => setActiveView('simulator')}
                isSimulatorActive={false}
                activeView={activeView}
                setActiveView={setActiveView}
              />
            </div>
          </div>
        )}

        {activeView === 'references' && (
          <div className="pb-20 sm:pb-24 space-y-4">
            {/* Quick Return to Studio */}
            <div className="flex items-center justify-between bg-[#11141e] border border-[#202636] rounded-xl p-2.5">
              <span className="text-xs font-semibold text-white">Reference Vault &amp; Turnaround Sheets</span>
              <button
                onClick={() => setActiveView('studio')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                ← Back to Studio
              </button>
            </div>

            <ReferenceManager
              subjectSlots={activeQueue.config.references.subjectSlots}
              sceneSlots={activeQueue.config.references.sceneSlots}
              styleSlots={activeQueue.config.references.styleSlots}
              differentImageForEachPrompt={
                activeQueue.config.references.differentImageForEachPrompt
              }
              onToggleDifferentImage={(val) =>
                updateActiveConfig({
                  references: {
                    ...activeQueue.config.references,
                    differentImageForEachPrompt: val,
                  },
                })
              }
              onUpdateSlot={handleUpdateSlot}
              onClearSlot={handleClearSlot}
              onClearAllCategory={handleClearAllCategory}
            />
          </div>
        )}

        {activeView === 'simulator' && (
          <div className="pb-20 sm:pb-24 space-y-4">
            <div className="flex items-center justify-between bg-[#11141e] border border-[#202636] rounded-xl p-2.5">
              <span className="text-xs font-semibold text-white">FlowBatch Flow Tab Simulator</span>
              <button
                onClick={() => setActiveView('studio')}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold"
              >
                ← Back to Studio
              </button>
            </div>

            <FlowSimulator
              activeQueue={activeQueue}
              isRunning={isRunning}
              onStart={handleStartQueue}
              onStop={handleStopQueue}
              onClearLogs={() => updateActiveQueue({ logs: [] })}
              generatedResults={generatedResults}
              subjectSlots={activeQueue.config.references.subjectSlots}
            />
          </div>
        )}
      </main>

      {/* Sticky Bottom Execution Action Bar (The ONLY place for Start / Pause / Resume / Stop) */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-[#0c0e14]/95 backdrop-blur-md border-t border-[#1e2330] p-3 shadow-2xl">
        <div className="max-w-md sm:max-w-xl lg:max-w-4xl mx-auto flex items-center gap-3">
          {isRunning ? (
            isPaused ? (
              <button
                onClick={handleResumeQueue}
                className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Resume</span>
              </button>
            ) : (
              <button
                onClick={handlePauseQueue}
                className="flex-1 py-3 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2"
              >
                <Pause className="w-4 h-4 fill-current" />
                <span>Pause</span>
              </button>
            )
          ) : (
            <button
              onClick={handleStartQueue}
              disabled={activeQueue.parsedPrompts.length === 0 || !googleAccount.isSignedIn}
              className={`flex-1 py-3 px-4 rounded-xl font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 ${
                activeQueue.parsedPrompts.length === 0 || !googleAccount.isSignedIn
                  ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                  : allPromptsDone
                  ? 'bg-[#1b2230] hover:bg-[#252f42] text-emerald-300 border border-emerald-500/40 cursor-pointer'
                  : somePromptsDone
                  ? 'bg-[#1e2434] hover:bg-[#283146] text-amber-300 border border-amber-500/40 cursor-pointer'
                  : 'bg-[#1e2434] hover:bg-[#283146] text-white border border-[#303a52]'
              }`}
            >
              {allPromptsDone ? (
                <span>✓ All Generated (Re-run?)</span>
              ) : somePromptsDone ? (
                <span>Resume ({remainingCount} Remaining)</span>
              ) : (
                <span>Start</span>
              )}
            </button>
          )}

          <button
            onClick={handleStopQueue}
            disabled={!isRunning}
            className={`py-3 px-6 rounded-xl font-semibold text-sm transition-colors ${
              isRunning
                ? 'bg-[#1e2434] hover:bg-[#283146] text-red-400 border border-[#303a52] cursor-pointer'
                : 'bg-[#141720] text-zinc-600 border border-[#1e2330] cursor-not-allowed'
            }`}
          >
            <span>Stop</span>
          </button>
        </div>
      </div>

      {/* Reference images per prompt Modal with magnetic cast auto-linking */}
      <ReferencePerPromptModal
        isOpen={isPerPromptModalOpen}
        onClose={() => setIsPerPromptModalOpen(false)}
        prompts={activeQueue.parsedPrompts}
        availableSlots={allActiveSlots}
        onSavePrompts={handleSavePerPromptReferences}
        onUploadSlotImage={(slotTag, file) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            const cleanTag = slotTag.toLowerCase().replace('@', '');
            const subSlots = activeQueue.config.references.subjectSlots;
            const targetIdx = subSlots.findIndex(
              s => s.tag.toLowerCase() === `@${cleanTag}` || s.label.toLowerCase() === cleanTag
            );
            if (targetIdx >= 0) {
              handleUpdateSlot('subject', subSlots[targetIdx].index, {
                imageUrl: dataUrl,
                fileName: file.name
              });
            } else {
              // Assign to first empty subject slot
              const emptyIdx = subSlots.findIndex(s => !s.imageUrl);
              if (emptyIdx >= 0) {
                handleUpdateSlot('subject', subSlots[emptyIdx].index, {
                  imageUrl: dataUrl,
                  fileName: file.name,
                  tag: `@${cleanTag}`,
                  label: cleanTag.charAt(0).toUpperCase() + cleanTag.slice(1)
                });
              }
            }
          };
          reader.readAsDataURL(file);
        }}
      />

      {/* Prompt Reference Scanner & Auto-Tagging Modal */}
      <PromptScanModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        rawText={activeQueue.promptsText}
        detectedReferences={detectedReferences}
        suggestedAssignments={suggestedAssignments}
        onApplyMappedPrompts={(newPrompts, updatedSub, updatedScn, updatedSty) => {
          updateActiveQueue({
            promptsText: newPrompts,
            config: {
              ...activeQueue.config,
              references: {
                ...activeQueue.config.references,
                subjectSlots: updatedSub,
                sceneSlots: updatedScn,
                styleSlots: updatedSty,
              },
            },
          });
        }}
        subjectSlots={activeQueue.config.references.subjectSlots}
        sceneSlots={activeQueue.config.references.sceneSlots}
        styleSlots={activeQueue.config.references.styleSlots}
      />

      {/* Session History & Recovery Modal */}
      <HistoryRecoveryModal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        history={history}
        onResumeFailedOnly={handleResumeFailedOnly}
        onRestoreFullQueue={handleRestoreFullQueue}
        onRetryAllFailedInNewQueue={handleRetryAllFailedInNewQueue}
        onClearHistory={() => setHistory([])}
        onDeletePromptsFromHistory={handleDeletePromptsFromHistory}
        onDeleteSession={handleDeleteSession}
      />

      {/* Settings & Automation Controls Modal */}
      <RemoteConfigModal
        isOpen={isConfigModalOpen}
        onClose={() => setIsConfigModalOpen(false)}
        config={activeQueue.config}
        onUpdateConfig={updateActiveConfig}
        onClearCache={handleClearCache}
      />

      {/* Google Drive Upload & Device Delivery Modal */}
      <GoogleDriveModal
        isOpen={isDriveModalOpen}
        onClose={() => setIsDriveModalOpen(false)}
        googleAccount={googleAccount}
        onUpdateAccount={(acc) => setGoogleAccount(prev => ({ ...prev, ...acc }))}
      />

      {/* Safety Confirmation Dialog against Accidental Duplication */}
      {isConfirmRestartOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-[#101219] border border-[#232735] rounded-2xl p-5 max-w-sm w-full space-y-4 shadow-2xl">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Queue Already Completed</h3>
                <p className="text-[11px] text-zinc-400">
                  All {activeQueue.parsedPrompts.length} prompts have already generated images.
                </p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-[#161822] p-3 rounded-xl border border-[#212534]">
              Re-running this queue will re-generate artifacts and may create duplicate files. What would you like to do?
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                onClick={() => setIsConfirmRestartOpen(false)}
                className="py-2 px-3 rounded-xl bg-[#171922] hover:bg-[#20232e] border border-[#272a38] text-zinc-300 text-xs font-medium transition-colors"
              >
                Keep Completed
              </button>
              <button
                onClick={handleForceRestartAll}
                className="py-2 px-4 rounded-xl bg-[#242733] hover:bg-[#2e3241] border border-[#3e4456] text-white text-xs font-semibold shadow-sm transition-colors"
              >
                Restart &amp; Re-run All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
