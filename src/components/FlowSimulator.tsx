import React from 'react';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Terminal, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  ExternalLink,
  Layers,
  Sparkles,
  Maximize2
} from 'lucide-react';
import { QueueTab, ReferenceImageSlot } from '../types';

interface GeneratedResult {
  id: string;
  index: number;
  prompt: string;
  imageUrl: string;
  filename: string;
  resolution: string;
  timestamp: string;
  isVideo: boolean;
}

interface FlowSimulatorProps {
  activeQueue: QueueTab;
  isRunning: boolean;
  onStart: () => void;
  onStop: () => void;
  onClearLogs: () => void;
  generatedResults: GeneratedResult[];
  subjectSlots: ReferenceImageSlot[];
}

export const FlowSimulator: React.FC<FlowSimulatorProps> = ({
  activeQueue,
  isRunning,
  onStart,
  onStop,
  onClearLogs,
  generatedResults,
  subjectSlots
}) => {
  const prompts = activeQueue.promptsText
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  const total = prompts.length;
  const currentPrompt = prompts[activeQueue.currentIndex] || prompts[0] || 'No prompt loaded';
  const progressPercent = total ? Math.min(100, Math.round(((activeQueue.currentIndex) / total) * 100)) : 0;

  return (
    <div className="bg-[#12151c] border border-[#212631] rounded-xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* Browser Tab Simulation Header */}
      <div className="px-4 py-2.5 bg-[#151922] border-b border-[#212631] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded bg-[#0e1015] border border-[#242b3b] text-xs font-mono text-zinc-300 ml-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>https://labs.google/fx/tools/flow</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {isRunning ? (
            <button
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-medium transition-colors"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Stop Run</span>
            </button>
          ) : (
            <button
              onClick={onStart}
              disabled={total === 0}
              className="flex items-center gap-1.5 px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Run Simulator</span>
            </button>
          )}

          <button
            onClick={onClearLogs}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200"
            title="Clear logs"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-[#181d28] h-1.5 overflow-hidden">
        <div
          className="bg-gradient-to-r from-blue-500 to-indigo-500 h-full transition-all duration-300"
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 gap-4 p-4">
        {/* Left Column: Simulated Flow UI & Active Prompt Box */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="p-4 rounded-xl bg-[#0e1015] border border-[#222838] space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Google Flow Canvas
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-blue-950/80 text-blue-300 border border-blue-800 text-[11px] font-mono">
                  {activeQueue.config.mode.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 text-[11px] font-mono">
                  {activeQueue.config.mode === 'video'
                    ? activeQueue.config.video.resolution
                    : activeQueue.config.image.resolution}
                </span>
              </div>
            </div>

            {/* Prompt input simulation */}
            <div className="p-3 rounded-lg bg-[#151922] border border-[#262c3e] min-h-[100px] flex flex-col justify-between">
              <div className="text-xs font-mono text-zinc-200 whitespace-pre-wrap leading-relaxed">
                {currentPrompt}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-[#222838] text-[11px] text-zinc-400">
                <span>
                  Targeting model:{' '}
                  <strong className="text-zinc-200">
                    {activeQueue.config.mode === 'video'
                      ? activeQueue.config.video.model
                      : activeQueue.config.image.model}
                  </strong>
                </span>
                <span className="font-mono">
                  Prompt {total > 0 ? activeQueue.currentIndex + 1 : 0} of {total}
                </span>
              </div>
            </div>

            {/* Simulated generation button & upscale triggers */}
            <div className="flex items-center justify-between text-xs pt-1">
              <div className="flex items-center gap-2">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isRunning ? 'bg-amber-400 animate-pulse' : 'bg-zinc-600'
                  }`}
                />
                <span className="text-zinc-400 text-[11px]">
                  {isRunning
                    ? 'Flow automating active queue...'
                    : 'Awaiting queue trigger'}
                </span>
              </div>

              {activeQueue.config.image.autoUpscale && (
                <div className="flex items-center gap-1 text-[11px] text-purple-400">
                  <Maximize2 className="w-3 h-3" />
                  <span>Auto-Upscale to 4K active</span>
                </div>
              )}
            </div>
          </div>

          {/* Generated Media Output Gallery */}
          <div className="flex-1 flex flex-col min-h-[220px] rounded-xl bg-[#0e1015] border border-[#222838] p-3 overflow-hidden">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider">
                Generated Artifacts ({generatedResults.length})
              </h3>
              <span className="text-[11px] text-zinc-500 font-mono">
                Auto-saved into /FlowAutomator/{activeQueue.name}/
              </span>
            </div>

            {generatedResults.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                <Layers className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs">No generated files yet in this session.</p>
                <p className="text-[11px] text-zinc-600 mt-1">
                  Start the queue to observe automatic generation, upscale, and ordered saving.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-[300px]">
                {generatedResults.map((item) => (
                  <div
                    key={item.id}
                    className="group relative rounded-lg overflow-hidden border border-[#222838] bg-[#151922] flex flex-col"
                  >
                    <div className="aspect-video relative overflow-hidden bg-black">
                      <img
                        src={item.imageUrl}
                        alt={item.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                      <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-[10px] font-mono text-zinc-200">
                        {item.resolution}
                      </span>
                    </div>

                    <div className="p-2 text-[11px] flex items-center justify-between">
                      <span className="font-mono text-zinc-300 truncate max-w-[120px]">
                        {item.filename}
                      </span>
                      <a
                        href={item.imageUrl}
                        download={item.filename}
                        className="p-1 text-zinc-400 hover:text-blue-400"
                        title="Download file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Real-time Automation Terminal Logs */}
        <div className="lg:col-span-5 flex flex-col rounded-xl bg-[#0a0c10] border border-[#212631] overflow-hidden">
          <div className="px-3 py-2 bg-[#12151c] border-b border-[#212631] flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-zinc-400 font-mono">
              <Terminal className="w-3.5 h-3.5 text-blue-400" />
              <span>automation-engine.log</span>
            </div>
            <span className="text-[10px] font-mono text-zinc-500">
              {activeQueue.logs.length} events
            </span>
          </div>

          <div className="flex-1 p-3 overflow-y-auto font-mono text-[11px] leading-relaxed space-y-1 text-zinc-300 min-h-[350px]">
            {activeQueue.logs.length === 0 ? (
              <div className="text-zinc-600 italic py-4">
                Automation engine initialized. Press "Start Queue" to launch batches in Flow.
              </div>
            ) : (
              activeQueue.logs.map((log, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-zinc-600 select-none">&gt;</span>
                  <span
                    className={
                      log.includes('Failed') || log.includes('Error')
                        ? 'text-red-400'
                        : log.includes('Upscaling') || log.includes('4K')
                        ? 'text-purple-300'
                        : log.includes('Finished') || log.includes('complete')
                        ? 'text-emerald-400'
                        : log.includes('Auto-refresh')
                        ? 'text-amber-400'
                        : 'text-zinc-300'
                    }
                  >
                    {log}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
