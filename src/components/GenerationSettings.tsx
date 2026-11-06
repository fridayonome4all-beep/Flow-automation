import React from 'react';
import { 
  Film, 
  Image as ImageIcon, 
  FolderOpen,
  Sparkles,
  RefreshCw,
  Layers
} from 'lucide-react';
import { 
  QueueConfig, 
  QualityResolution, 
  VideoModeType, 
  ReferenceImageSlot 
} from '../types';

interface GenerationSettingsProps {
  config: QueueConfig;
  onChangeConfig: (updates: Partial<QueueConfig>) => void;
  availableSubjectSlots: ReferenceImageSlot[];
  onOpenPerPromptModal?: () => void;
  onOpenScanModal?: () => void;
  onToggleSimulator?: () => void;
  isSimulatorActive?: boolean;
  activeView: 'studio' | 'references' | 'simulator';
  setActiveView: (view: 'studio' | 'references' | 'simulator') => void;
}

export const GenerationSettings: React.FC<GenerationSettingsProps> = ({
  config,
  onChangeConfig,
  availableSubjectSlots,
  onOpenPerPromptModal,
  onOpenScanModal,
  onToggleSimulator,
  isSimulatorActive = false,
  activeView,
  setActiveView
}) => {
  const isVideo = config.mode === 'video';

  const videoModels = [
    { id: 'Omni Flash 1.1', label: 'Omni Flash 1.1', icon: '✦' },
    { id: 'Veo 3.1 Lite', label: 'Veo 3.1 Lite', icon: '🎞' },
    { id: 'Veo 3.1 Fast', label: 'Veo 3.1 Fast', icon: '⚡' },
    { id: 'Veo 3.1 Quality', label: 'Veo 3.1 Quality', icon: '💎' },
  ];

  const imageModels = [
    { id: '🍌 Nano Banana 2.1', label: '🍌 Nano Banana 2.1', icon: '🍌', isDefault: true },
    { id: 'Nano Banana Pro', label: 'Nano Banana Pro', icon: '⚡' },
    { id: 'Imagen 3 Pro', label: 'Imagen 3 Pro', icon: '✦' },
    { id: 'Nano Banana Lite', label: 'Nano Banana Lite', icon: '💎' },
  ];

  return (
    <div className="bg-[#0e0f14] border border-[#1e2029] rounded-2xl flex flex-col overflow-hidden shadow-sm">
      {/* Top Header Bar: Studio & Reference tabs */}
      <div className="px-4 py-3 bg-[#12141a] border-b border-[#1e2029] space-y-3">
        <div className="flex items-center justify-between gap-2">
          {/* Studio & Reference Vault Switcher */}
          <div className="flex items-center p-0.5 bg-[#090a0d] border border-[#1a1c24] rounded-xl text-xs font-semibold">
            <button
              onClick={() => setActiveView('studio')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'studio'
                  ? 'bg-[#242733] border border-[#373c4d] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Studio</span>
            </button>

            <button
              onClick={() => setActiveView('references')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeView === 'references'
                  ? 'bg-[#242733] border border-[#373c4d] text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>References</span>
            </button>
          </div>

          {/* Quick Tools: Scan @Tags, Simulator (Settings is in Prompts header) */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onOpenScanModal && (
              <button
                onClick={onOpenScanModal}
                className="p-1.5 rounded-lg bg-[#161820] hover:bg-[#1e212b] border border-[#242733] text-zinc-400 hover:text-amber-400 transition-colors"
                title="Scan Prompts for @references"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            )}

            {onToggleSimulator && (
              <button
                onClick={onToggleSimulator}
                className={`p-1.5 rounded-lg border transition-colors ${
                  isSimulatorActive
                    ? 'bg-[#242733] text-white border-[#373c4d]'
                    : 'bg-[#161820] hover:bg-[#1e212b] border-[#242733] text-zinc-400 hover:text-white'
                }`}
                title="Toggle Flow Tab Simulator Runner"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Top Images / Videos Mode Toggle Pills */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#090a0d] border border-[#1a1c24] rounded-xl">
          <button
            onClick={() => onChangeConfig({ mode: 'image' })}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              !isVideo
                ? 'bg-[#222530] text-white shadow-sm border border-[#353a4a]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <ImageIcon className="w-4 h-4" />
            <span>Images</span>
          </button>

          <button
            onClick={() => onChangeConfig({ mode: 'video' })}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              isVideo
                ? 'bg-[#222530] text-white shadow-sm border border-[#353a4a]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Film className="w-4 h-4" />
            <span>Videos</span>
          </button>
        </div>
      </div>

      {/* Main Settings Options */}
      <div className="p-4 space-y-4 text-xs">
        {/* Model Selection (Nano Banana 2.1 is default for images) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-zinc-300 block">
              {isVideo ? 'Video model' : 'Image model'}
            </label>
            {!isVideo && (
              <span className="text-[10px] text-amber-400 font-mono font-medium">
                🍌 Nano Banana 2.1 Default
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(isVideo ? videoModels : imageModels).map((m) => {
              const currentModel = isVideo ? config.video.model : (config.image.model || '🍌 Nano Banana 2.1');
              const isSelected = currentModel === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (isVideo) {
                      onChangeConfig({ video: { ...config.video, model: m.id } });
                    } else {
                      onChangeConfig({ image: { ...config.image, model: m.id } });
                    }
                  }}
                  className={`flex items-center gap-2 p-2.5 rounded-xl border text-left font-medium transition-all ${
                    isSelected
                      ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm'
                      : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                  }`}
                >
                  <span className="text-sm shrink-0">{m.icon}</span>
                  <span className="text-xs truncate">{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Video Mode Selection if in Video mode */}
        {isVideo && (
          <div className="space-y-2">
            <label className="font-semibold text-zinc-300 block">Video mode</label>
            <div className="grid grid-cols-4 gap-1.5">
              {[
                { id: 'text', label: 'Text', icon: '✎' },
                { id: 'start_frame', label: 'Start', icon: '⛶' },
                { id: 'start_end', label: 'S+E', icon: '⏸' },
                { id: 'reference', label: 'Ref', icon: '🗂' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() =>
                    onChangeConfig({
                      video: { ...config.video, videoMode: m.id as VideoModeType }
                    })
                  }
                  className={`py-2 px-1 text-center rounded-xl border font-medium text-xs transition-all ${
                    config.video.videoMode === m.id
                      ? 'bg-[#242733] border-[#3e4456] text-white'
                      : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                  }`}
                >
                  <span className="mr-1 opacity-70">{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Aspect Ratio (16:9 widescreen default for all generations) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-zinc-300 block">Aspect ratio</label>
            <span className="text-[10px] text-zinc-400 font-mono">16:9 Widescreen Default</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {(isVideo ? ['16:9', '9:16'] : ['16:9', '9:16', '1:1', '4:3', '3:4']).map((asp) => {
              const currentAsp = isVideo ? config.video.aspect : (config.image.aspect || '16:9');
              const isSelected = currentAsp === asp;
              return (
                <button
                  key={asp}
                  onClick={() => {
                    if (isVideo) {
                      onChangeConfig({ video: { ...config.video, aspect: asp } });
                    } else {
                      onChangeConfig({ image: { ...config.image, aspect: asp } });
                    }
                  }}
                  className={`py-2 px-3 text-center rounded-xl border font-mono font-medium text-xs transition-all ${
                    isSelected
                      ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm'
                      : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                  }`}
                >
                  {asp}
                </button>
              );
            })}
          </div>
        </div>

        {/* Duration (Videos) */}
        {isVideo && (
          <div className="space-y-2">
            <label className="font-semibold text-zinc-300 block">Duration</label>
            <div className="grid grid-cols-4 gap-2">
              {['4s', '6s', '8s', '10s'].map((d) => (
                <button
                  key={d}
                  onClick={() => onChangeConfig({ video: { ...config.video, duration: d } })}
                  className={`py-2 text-center rounded-xl border font-mono font-medium text-xs transition-all ${
                    config.video.duration === d
                      ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm'
                      : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Videos/Images per prompt */}
        <div className="space-y-2">
          <label className="font-semibold text-zinc-300 block">
            {isVideo ? 'Videos per prompt' : 'Images per prompt'}
          </label>
          <div className="grid grid-cols-4 gap-2">
            {['1', '2', '3', '4'].map((cnt) => {
              const currentVal = isVideo ? config.video.count : config.image.count;
              const isSelected = currentVal === cnt;
              return (
                <button
                  key={cnt}
                  onClick={() => {
                    if (isVideo) {
                      onChangeConfig({ video: { ...config.video, count: cnt } });
                    } else {
                      onChangeConfig({ image: { ...config.image, count: cnt } });
                    }
                  }}
                  className={`py-2 text-center rounded-xl border font-mono font-semibold text-xs transition-all ${
                    isSelected
                      ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm'
                      : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                  }`}
                >
                  ×{cnt}
                </button>
              );
            })}
          </div>
        </div>

        {/* Upscale / Quality Section (Strictly NO 780p or 720p!) */}
        <div className="space-y-2">
          <label className="font-semibold text-zinc-300 block">
            {isVideo ? 'Upscale' : 'Image Quality'}
          </label>

          {isVideo ? (
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'standard', label: 'None' },
                { id: '1080p', label: '1080p' },
                { id: '4K', label: '4K' },
              ].map((opt) => {
                const isSelected = (config.video.resolution || '1080p') === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      onChangeConfig({
                        video: {
                          ...config.video,
                          resolution: opt.id as QualityResolution,
                          autoUpscale: opt.id !== 'standard'
                        }
                      })
                    }
                    className={`py-2 text-center rounded-xl border font-mono font-semibold text-xs transition-all ${
                      isSelected
                        ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm'
                        : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'standard', label: 'Standard', desc: 'Direct generation (no upscale)' },
                { id: '2K', label: '2K', desc: 'Auto-upscaled high resolution' },
              ].map((opt) => {
                const isSelected = (config.image.resolution || 'standard') === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      onChangeConfig({
                        image: {
                          ...config.image,
                          resolution: opt.id as QualityResolution,
                          autoUpscale: opt.id === '2K'
                        }
                      })
                    }
                    className={`py-2.5 px-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm'
                        : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                    }`}
                  >
                    <div className="font-semibold text-xs">{opt.label}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5">{opt.desc}</div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Per-Prompt References Override Card matching Screenshot_20261105-170710_9377a47c.png */}
        {!isVideo && onOpenPerPromptModal && (
          <div
            onClick={onOpenPerPromptModal}
            className="p-3.5 rounded-2xl bg-[#13151b] hover:bg-[#161822] border border-[#1f222d] hover:border-[#2f3546] transition-all cursor-pointer flex items-center gap-3.5 shadow-sm group"
          >
            <div className="w-10 h-10 rounded-xl bg-[#1c202a] border border-[#272b38] group-hover:border-[#3a4256] flex items-center justify-center text-zinc-300 shrink-0 transition-colors">
              <FolderOpen className="w-5 h-5 text-zinc-300" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-white text-xs tracking-tight flex items-center justify-between">
                <span>Reference images per prompt</span>
                <span className="text-[10px] text-zinc-500 font-mono group-hover:text-zinc-300 transition-colors">Open →</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed mt-0.5">
                Assign individual reference portraits per prompt (overrides global references)
              </p>
            </div>
          </div>
        )}

        {/* Generation Speed (Controls sequential timing between prompts) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="font-semibold text-zinc-300 block">Generation Speed</label>
            <span className="text-[10px] font-mono text-zinc-400">
              {config.speed === 'fast' ? 'Fast (1-2s delay)' : config.speed === 'balanced' ? 'Balanced (6s delay)' : config.speed === 'slow' ? 'Slow (15s delay)' : `Custom: ${config.customDelay}s`}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {[
              { id: 'slow', label: 'Slow' },
              { id: 'balanced', label: 'Balanced' },
              { id: 'fast', label: 'Fast' },
              { id: 'custom', label: 'Custom' },
            ].map((s) => (
              <button
                key={s.id}
                onClick={() => onChangeConfig({ speed: s.id as any })}
                className={`py-2 text-center rounded-xl border text-xs font-medium transition-all ${
                  config.speed === s.id
                    ? 'bg-[#242733] border-[#3e4456] text-white shadow-sm font-semibold'
                    : 'bg-[#13151b] border-[#1d2028] text-zinc-400 hover:text-zinc-200 hover:border-[#282c37]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {config.speed === 'custom' && (
            <div className="pt-2 space-y-1.5">
              <div className="flex justify-between text-zinc-400 text-[11px]">
                <span>Sequential delay:</span>
                <span className="font-mono text-white font-bold">{config.customDelay}s</span>
              </div>
              <input
                type="range"
                min="1"
                max="30"
                step="1"
                value={config.customDelay}
                onChange={(e) => onChangeConfig({ customDelay: parseInt(e.target.value) || 2 })}
                className="w-full accent-zinc-400 cursor-pointer"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
