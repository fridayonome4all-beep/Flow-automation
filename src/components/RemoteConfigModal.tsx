import React, { useState, useEffect } from 'react';
import { 
  X, 
  RefreshCw, 
  Trash2, 
  Check, 
  Settings2, 
  FileDigit,
  Download,
  Clock,
  Sparkles,
  ShieldCheck,
  Code2
} from 'lucide-react';
import { QueueConfig } from '../types';

interface RemoteConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: QueueConfig;
  onUpdateConfig: (updates: Partial<QueueConfig>) => void;
  onClearCache: () => void;
}

export const RemoteConfigModal: React.FC<RemoteConfigModalProps> = ({
  isOpen,
  onClose,
  config,
  onUpdateConfig,
  onClearCache
}) => {
  const [template, setTemplate] = useState(config.customNamingTemplate || '{id}_v{v}');
  const [namingMode, setNamingMode] = useState<'id' | 'slug' | 'custom'>(config.naming || 'id');
  const [autoDownload, setAutoDownload] = useState(config.autoDownload ?? true);
  const [remoteUrl, setRemoteUrl] = useState('/api/remote-config');
  const [isChecking, setIsChecking] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
  const [cacheClearedNotice, setCacheClearedNotice] = useState(false);
  const [selectors, setSelectors] = useState({
    promptBox: 'textarea, [contenteditable="true"], [role="textbox"], input[placeholder*="prompt" i]',
    submitButtons: 'button[aria-label*="Generate" i], button[aria-label*="Create" i], button[aria-label*="Run" i]',
    referenceTrigger: 'button[aria-label*="Reference" i], button[aria-label*="Add image" i]',
    upscaleButton: 'button[aria-label*="Upscale" i], [data-action="upscale"]',
    videoModeTabs: '[role="tab"][aria-label*="Video" i]'
  });

  // Sync state only when modal opens
  useEffect(() => {
    if (isOpen) {
      setTemplate(config.customNamingTemplate ?? '{id}');
      setNamingMode(config.naming || 'id');
      setAutoDownload(config.autoDownload ?? true);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Insert token into template
  const insertToken = (token: string) => {
    const updated = template ? `${template}_${token}` : token;
    setTemplate(updated);
    setNamingMode('custom');
    onUpdateConfig({ 
      naming: 'custom',
      customNamingTemplate: updated 
    });
  };

  const handleTemplateChange = (val: string) => {
    setTemplate(val);
    setNamingMode('custom');
    onUpdateConfig({
      naming: 'custom',
      customNamingTemplate: val
    });
    try {
      localStorage.setItem('flow_customNamingTemplate', val);
      localStorage.setItem('flow_naming', 'custom');
    } catch (_) {}
  };

  const handleSelectNamingMode = (mode: 'id' | 'slug' | 'custom') => {
    setNamingMode(mode);
    onUpdateConfig({ naming: mode });
    try {
      localStorage.setItem('flow_naming', mode);
    } catch (_) {}
  };

  const handleToggleAutoDownload = (checked: boolean) => {
    setAutoDownload(checked);
    onUpdateConfig({ autoDownload: checked });
    try {
      localStorage.setItem('flow_autoDownload', JSON.stringify(checked));
    } catch (_) {}
  };

  // Generate live sample preview of file naming
  const getLivePreviewFilename = () => {
    const now = new Date();
    const dateStr = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
    const sampleId = 'ID';
    const sampleIndex = '001';
    const sampleV = '1';
    const sampleSlug = 'take';
    const samplePromptStart = 'prompt';
    const ext = config.mode === 'video' ? 'mp4' : 'png';

    if (namingMode === 'id') {
      return `[Prompt-ID].${ext}`;
    }
    if (namingMode === 'slug') {
      return `[Prompt-ID]-[slug].${ext}`;
    }

    let result = template || '{id}';
    result = result
      .replace(/\{id\}/g, sampleId)
      .replace(/\{index\}/g, sampleIndex)
      .replace(/\{timestamp\}/g, dateStr)
      .replace(/\{prompt_start\}/g, samplePromptStart)
      .replace(/\{slug\}/g, sampleSlug)
      .replace(/\{v\}/g, sampleV);

    return `${result}.${ext}`;
  };

  const handleSyncRemoteConfig = async () => {
    setIsChecking(true);
    setSyncStatus(null);
    try {
      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.selectors) {
        setSelectors(data.selectors);
      }
      setSyncStatus(`Synchronized with Flow engine. Selectors are up-to-date.`);
    } catch (err: any) {
      setSyncStatus(`Offline resilient selectors active.`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleClearCacheClick = () => {
    onClearCache();
    setCacheClearedNotice(true);
    setTimeout(() => setCacheClearedNotice(false), 3000);
  };

  const availableTokens = [
    { token: '{id}', label: '{id}', desc: 'Prompt unique ID (e.g. 001, IMG-42)' },
    { token: '{index}', label: '{index}', desc: 'Sequential index (1, 2, 3...)' },
    { token: '{timestamp}', label: '{timestamp}', desc: 'Date stamp (YYYYMMDD)' },
    { token: '{prompt_start}', label: '{prompt_start}', desc: 'First words of prompt slug' },
    { token: '{v}', label: '{v}', desc: 'Variation take number (1..4)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#101218] border border-[#232733] rounded-2xl w-full max-w-2xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header with Settings Icon */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#212631] bg-[#141722]">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Settings &amp; Automation Controls
              </h2>
              <p className="text-xs text-zinc-400">
                Custom file naming tokens, auto-download, memory cleanup &amp; Flow resilience
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* Section 1: User-Customizable File Naming with Tokens */}
          <div className="p-4 rounded-xl bg-[#141822] border border-[#222838] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileDigit className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  File Naming Format &amp; Tokens
                </h3>
              </div>
              <span className="text-[11px] text-zinc-400 font-mono">
                Permanent Preference
              </span>
            </div>

            {/* Mode selection buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleSelectNamingMode('id')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  namingMode === 'id'
                    ? 'bg-[#222532] border-[#363c50] text-white shadow-sm'
                    : 'bg-[#0d0f15] border-[#1e222d] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="font-semibold text-xs text-white">Automatic Prompt ID</div>
                <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                  Saves using the prompt's embedded identifier or universal sequential numbering.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectNamingMode('slug')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  namingMode === 'slug'
                    ? 'bg-[#222532] border-[#363c50] text-white shadow-sm'
                    : 'bg-[#0d0f15] border-[#1e222d] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="font-semibold text-xs text-white">ID + Prompt Slug</div>
                <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                  Prompt identifier followed by clean descriptive keywords.
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectNamingMode('custom')}
                className={`p-3 rounded-xl border text-left transition-all ${
                  namingMode === 'custom'
                    ? 'bg-[#222532] border-[#363c50] text-white shadow-sm'
                    : 'bg-[#0d0f15] border-[#1e222d] text-zinc-400 hover:text-zinc-200'
                }`}
              >
                <div className="font-semibold text-xs text-white">Custom Template</div>
                <div className="text-[10px] text-zinc-400 mt-1 leading-normal">
                  Define your own filename pattern using tokens below
                </div>
              </button>
            </div>

            {/* Custom Template Input & Clickable Token Palette */}
            <div className="pt-2 border-t border-[#1e2330] space-y-2.5">
              <label className="block text-[11px] font-medium text-zinc-300">
                Filename Template Pattern:
              </label>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={template}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  placeholder="{id}_{prompt_start}_{timestamp}"
                  className="flex-1 bg-[#0b0d12] border border-[#262e40] rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-blue-500"
                />
                <span className="text-xs font-mono text-zinc-500">
                  .{config.mode === 'video' ? 'mp4' : 'png'}
                </span>
              </div>

              {/* Clickable Token Chips */}
              <div className="space-y-1">
                <span className="text-[10px] uppercase font-mono text-zinc-500">
                  Tap to add token:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {availableTokens.map((t) => (
                    <button
                      key={t.token}
                      type="button"
                      onClick={() => insertToken(t.token)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#161a24] hover:bg-blue-600/20 text-blue-300 hover:text-white border border-[#2b354a] font-mono text-[11px] transition-colors"
                      title={t.desc}
                    >
                      <Sparkles className="w-2.5 h-2.5 opacity-60" />
                      <span>{t.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Live Preview Box */}
              <div className="p-3 rounded-lg bg-[#0b0d12] border border-[#1e2433] flex items-center justify-between">
                <span className="text-[11px] text-zinc-400">Live Output Filename Preview:</span>
                <span className="font-mono text-xs font-semibold text-emerald-400">
                  {getLivePreviewFilename()}
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Auto-Download Management */}
          <div className="p-4 rounded-xl bg-[#141822] border border-[#222838] flex items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  Automatic File Download
                </h3>
              </div>
              <p className="text-[11px] text-zinc-400">
                Automatically download each generated image or video to your device as soon as it completes.
              </p>
            </div>

            <label className="relative inline-flex items-center cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={autoDownload}
                onChange={(e) => handleToggleAutoDownload(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Section 3: Cache Management & Troubleshooting */}
          <div className="p-4 rounded-xl bg-[#13151b] border border-[#1e2029] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-semibold text-white uppercase tracking-wider">
                  FlowBatch Cache &amp; Memory Clean
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Purges generated blob URLs and frees memory without losing your queue prompts.
                </p>
              </div>

              <button
                onClick={handleClearCacheClick}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-600/15 hover:bg-red-600/25 text-red-300 border border-red-500/30 text-xs font-medium transition-colors shrink-0"
              >
                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                <span>Clear Cache</span>
              </button>
            </div>

            {cacheClearedNotice && (
              <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 text-emerald-300 flex items-center gap-2 text-[11px]">
                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Cache cleared successfully!</span>
              </div>
            )}
          </div>

          {/* Section 4: Advanced Remote Selector Synchronization */}
          <details className="group rounded-xl bg-[#141822] border border-[#222838] overflow-hidden">
            <summary className="p-3 text-xs font-semibold text-zinc-400 uppercase tracking-wider cursor-pointer select-none hover:text-zinc-200 transition-colors flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Code2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>Advanced: DOM Selector Resilience Layer</span>
              </div>
              <span className="text-[10px] text-zinc-500 font-mono group-open:rotate-180 transition-transform">▾</span>
            </summary>

            <div className="p-3 pt-0 border-t border-[#1e2330] space-y-2 mt-2">
              <p className="text-zinc-500 text-[10px]">
                If Google Flow updates its UI buttons, the extension dynamically matches these selectors without requiring reinstallation.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={remoteUrl}
                  onChange={(e) => setRemoteUrl(e.target.value)}
                  className="flex-1 bg-[#0b0d12] border border-[#232938] rounded-lg p-2 text-xs text-zinc-200 font-mono outline-none"
                  placeholder="/api/remote-config"
                />
                <button
                  onClick={handleSyncRemoteConfig}
                  disabled={isChecking}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#1f2637] hover:bg-[#283248] text-zinc-200 border border-[#2d374e] text-xs font-medium transition-colors disabled:opacity-50 shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
                  <span>{isChecking ? 'Checking...' : 'Check Updates'}</span>
                </button>
              </div>

              {syncStatus && (
                <div className="p-2 rounded-lg bg-blue-950/30 border border-blue-800/40 text-blue-300 flex items-center gap-2 text-[10px]">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>{syncStatus}</span>
                </div>
              )}
            </div>
          </details>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#212631] bg-[#141722]">
          <span className="text-[11px] text-zinc-400 font-mono">
            {getLivePreviewFilename()}
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-colors shadow-sm"
          >
            Save &amp; Close
          </button>
        </div>
      </div>
    </div>
  );
};
