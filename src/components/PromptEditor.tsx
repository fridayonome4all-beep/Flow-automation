import React, { useRef, useState } from 'react';
import { 
  Upload, 
  Trash2, 
  Clock, 
  Settings2,
  Plus,
  X,
  Sparkles,
  Layers,
  Tag,
  Check,
  AlertCircle
} from 'lucide-react';
import { DetectedReference, ReferenceImageSlot, PromptItem, QueueTab } from '../types';
import { autoFormatAndSplitPrompts } from '../services/promptScanner';

interface PromptEditorProps {
  promptsText: string;
  parsedPrompts: PromptItem[];
  onChangePrompts: (text: string) => void;
  detectedReferences: DetectedReference[];
  allSlots: ReferenceImageSlot[];
  onOpenScanModal: () => void;
  onSelectTag: (tag: string) => void;
  onRetryPrompt?: (promptId: string) => void;
  onOpenHistoryModal?: () => void;
  onOpenSettingsModal?: () => void;
  onClearQueue?: () => void;
  onDeletePromptItem?: (id: string) => void;
  queues: QueueTab[];
  activeQueueId: string;
  onSelectQueue: (id: string) => void;
  onAddQueue: (name: string) => void;
  onDeleteQueue: (id: string) => void;
  completedCount?: number;
}

export const PromptEditor: React.FC<PromptEditorProps> = ({
  promptsText,
  parsedPrompts,
  onChangePrompts,
  detectedReferences,
  allSlots,
  onOpenScanModal,
  onSelectTag,
  onRetryPrompt,
  onOpenHistoryModal,
  onOpenSettingsModal,
  onClearQueue,
  onDeletePromptItem,
  queues,
  activeQueueId,
  onSelectQueue,
  onAddQueue,
  onDeleteQueue,
  completedCount = 0
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<'upload' | 'paste'>('paste');
  const [draftText, setDraftText] = useState(promptsText);
  const [isAddingQueue, setIsAddingQueue] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');

  React.useEffect(() => {
    setDraftText(promptsText);
  }, [promptsText]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const blocks = autoFormatAndSplitPrompts(text);
      const formatted = blocks.join('\n\n');
      setDraftText(formatted);
      onChangePrompts(formatted);
    } catch (err) {
      console.error('Failed reading prompt file:', err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLoadPromptsClick = () => {
    const blocks = autoFormatAndSplitPrompts(draftText);
    const formatted = blocks.join('\n\n');
    setDraftText(formatted);
    onChangePrompts(formatted);
  };

  const handleCreateQueue = () => {
    if (newQueueName.trim()) {
      onAddQueue(newQueueName.trim());
      setNewQueueName('');
      setIsAddingQueue(false);
    }
  };

  const getStatusBadge = (status: PromptItem['status'], error?: string | null) => {
    if (error && error.includes('[Pre-check]')) {
      return (
        <span 
          className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-teal-500/15 text-teal-300 border border-teal-500/30 flex items-center gap-1 shrink-0"
          title={error}
        >
          <Check className="w-2.5 h-2.5 text-teal-400" />
          <span>DONE</span>
        </span>
      );
    }
    switch (status) {
      case 'running':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-500/50 flex items-center gap-1.5 shrink-0 shadow-sm shadow-blue-500/20 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            <span>RUNNING</span>
          </span>
        );
      case 'done':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 flex items-center gap-1 shrink-0">
            <Check className="w-2.5 h-2.5 text-emerald-400" />
            <span>DONE</span>
          </span>
        );
      case 'failed':
      case 'blocked':
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/40 flex items-center gap-1 shrink-0">
            <AlertCircle className="w-2.5 h-2.5 text-red-400" />
            <span>FAILED</span>
          </span>
        );
      case 'idle':
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[9px] font-mono font-semibold uppercase tracking-wider bg-zinc-800/80 text-zinc-400 border border-zinc-700/40 shrink-0">
            PENDING
          </span>
        );
    }
  };

  const getStatusLabel = (status: PromptItem['status'], error?: string | null) => {
    if (error && error.includes('[Pre-check]')) {
      return (
        <div className="flex items-center gap-1.5 text-[11px] text-teal-400 font-mono" title={error}>
          <span className="w-1.5 h-1.5 rounded-full bg-teal-400" />
          <span className="font-semibold">Pre-checked (Saved)</span>
        </div>
      );
    }
    switch (status) {
      case 'running':
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-blue-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            <span className="font-semibold">Generating</span>
          </div>
        );
      case 'done':
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-semibold">Completed</span>
          </div>
        );
      case 'failed':
      case 'blocked':
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-red-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="font-semibold">Failed</span>
          </div>
        );
      case 'idle':
      default:
        return (
          <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
            <span>Pending</span>
          </div>
        );
    }
  };

  return (
    <div className="flex flex-col bg-[#11131a] border border-[#1e222e] rounded-2xl overflow-hidden shadow-sm">
      {/* Prompts Input Section with refined outlines */}
      <div className="p-4 border-b border-[#1c202c] space-y-3 bg-[#13151e]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-white tracking-tight">Prompts</h2>
            <span className="text-[11px] text-zinc-400 font-mono bg-[#1a1d27] border border-[#252a38] px-2 py-0.5 rounded-full">
              {parsedPrompts.length} prompt{parsedPrompts.length !== 1 ? 's' : ''}
            </span>
          </div>

          {onOpenSettingsModal && (
            <button
              onClick={onOpenSettingsModal}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171a24] hover:bg-[#202534] border border-[#262c3e] text-xs font-medium text-zinc-200 transition-colors shadow-sm"
              title="Settings & Naming Preferences"
            >
              <Settings2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Settings</span>
            </button>
          )}
        </div>

        {/* Upload File / Paste Text Switcher */}
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#0a0b10] border border-[#1a1d28] rounded-xl">
          <button
            onClick={() => setInputMode('upload')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              inputMode === 'upload'
                ? 'bg-[#222532] text-white shadow-sm border border-[#353b4e]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Upload File
          </button>
          <button
            onClick={() => setInputMode('paste')}
            className={`py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
              inputMode === 'paste'
                ? 'bg-[#222532] text-white shadow-sm border border-[#353b4e]'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Paste Text
          </button>
        </div>

        {/* Textarea or Drop Box with immediate auto-tagging synchronization */}
        {inputMode === 'upload' ? (
          <div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".txt,.csv"
              className="hidden"
            />
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#262c3e] hover:border-[#38425d] rounded-2xl p-5 text-center cursor-pointer transition-colors bg-[#0b0d13]/70 hover:bg-[#0e111a]"
            >
              <Upload className="w-5 h-5 text-zinc-400 mx-auto mb-2" />
              <p className="text-xs font-semibold text-zinc-200">
                Drop a .txt file or click to browse
              </p>
              <p className="text-[11px] text-zinc-500 mt-0.5">
                Automatically formats takes and synchronizes timeline references
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <textarea
              value={draftText}
              onChange={(e) => {
                const val = e.target.value;
                setDraftText(val);
                // Synchronize automatically as user types or pastes
                onChangePrompts(val);
              }}
              placeholder="Paste prompts here..."
              className="w-full h-20 p-3 bg-[#0a0b10] border border-[#1e2330] focus:border-[#3a445d] rounded-xl text-zinc-100 placeholder:text-zinc-600 font-mono text-xs resize-none outline-none leading-relaxed transition-colors"
            />

            <button
              onClick={handleLoadPromptsClick}
              className="w-full py-2.5 px-4 rounded-xl bg-[#222532] hover:bg-[#2b3040] border border-[#353b4e] text-white font-semibold text-xs transition-colors shadow-sm"
            >
              Load prompts
            </button>
          </div>
        )}
      </div>

      {/* Queue Section (Queue tabs, counter, and styled card list) */}
      <div className="flex flex-col bg-[#0c0e14]">
        {/* Queue Header & Actions */}
        <div className="px-4 py-3 flex items-center justify-between border-b border-[#1b1f2b] bg-[#10121a]">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-white tracking-wide">Queue</span>
            <span className="text-[11px] font-mono font-semibold text-zinc-400 px-2 py-0.5 rounded-full bg-[#171a25] border border-[#232838]">
              {completedCount} / {parsedPrompts.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onOpenHistoryModal && (
              <button
                onClick={onOpenHistoryModal}
                className="p-1.5 rounded-lg bg-[#161924] hover:bg-[#202534] border border-[#242939] text-zinc-400 hover:text-white transition-colors"
                title="View run history"
              >
                <Clock className="w-4 h-4" />
              </button>
            )}

            {parsedPrompts.length > 0 && onClearQueue && (
              <button
                onClick={onClearQueue}
                className="px-2.5 py-1 rounded-lg bg-[#161924] hover:bg-[#202534] border border-[#242939] text-[11px] font-medium text-zinc-300 hover:text-white transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Consolidated Queue Tabs */}
        <div className="px-3 py-2 border-b border-[#191c28] flex items-center justify-between gap-2 overflow-x-auto bg-[#0a0b10]">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {queues.map((q) => {
              const isSelected = q.id === activeQueueId;
              return (
                <div
                  key={q.id}
                  onClick={() => onSelectQueue(q.id)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold cursor-pointer border transition-all ${
                    isSelected
                      ? 'bg-[#222532] border-[#363c50] text-white shadow-sm'
                      : 'bg-[#12141c] border-[#1d202b] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span>{q.name}</span>
                  {queues.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteQueue(q.id);
                      }}
                      className="text-zinc-500 hover:text-red-400 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {isAddingQueue ? (
              <div className="flex items-center gap-1 bg-[#161a25] border border-[#353b4e] rounded-full px-2 py-0.5">
                <input
                  type="text"
                  placeholder="Queue..."
                  value={newQueueName}
                  onChange={(e) => setNewQueueName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateQueue();
                    if (e.key === 'Escape') setIsAddingQueue(false);
                  }}
                  autoFocus
                  className="bg-transparent text-xs text-white outline-none w-20 font-medium"
                />
                <button onClick={handleCreateQueue} className="text-emerald-400 text-xs font-bold">✓</button>
                <button onClick={() => setIsAddingQueue(false)} className="text-zinc-400 text-xs">✕</button>
              </div>
            ) : (
              <button
                onClick={() => setIsAddingQueue(true)}
                className="p-1 rounded-full bg-[#13151e] hover:bg-[#1a1e2a] border border-[#222736] text-zinc-400 hover:text-white transition-colors"
                title="Add new queue tab"
              >
                <Plus className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Queued Prompt Cards styled like premium executive dashboard */}
        <div className="p-3 space-y-2.5 max-h-[440px] overflow-y-auto">
          {parsedPrompts.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No prompts in queue. Paste or type prompts above.
            </div>
          ) : (
            parsedPrompts.map((item, idx) => (
              <div
                key={item.id}
                className={`p-3.5 rounded-2xl border transition-all duration-300 ${
                  item.status === 'running'
                    ? 'bg-[#141b2c] border-blue-500/70 ring-1 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.2)] animate-pulse'
                    : item.status === 'done'
                    ? 'bg-[#101518] border-emerald-900/40 text-zinc-300'
                    : item.status === 'failed'
                    ? 'bg-[#1a1215] border-red-900/50'
                    : 'bg-[#13151b] border-[#1f222d] hover:border-[#2a3040]'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Left rounded ID box with status tint */}
                  <div className={`w-10 h-10 rounded-xl border flex items-center justify-center font-mono font-bold text-xs shrink-0 select-none shadow-sm transition-colors ${
                    item.status === 'running'
                      ? 'bg-blue-950/70 border-blue-500/60 text-blue-300'
                      : item.status === 'done'
                      ? 'bg-emerald-950/50 border-emerald-800/40 text-emerald-300'
                      : item.status === 'failed'
                      ? 'bg-red-950/50 border-red-800/40 text-red-300'
                      : 'bg-[#1c202a] border-[#272b38] text-amber-400'
                  }`}>
                    {item.customId || String(idx + 1).padStart(2, '0')}
                  </div>

                  {/* Body text & actions */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs text-zinc-200 font-sans leading-relaxed line-clamp-3">
                        {item.text}
                      </p>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {/* High-visibility Status Badge directly in list editor */}
                        {getStatusBadge(item.status, item.error)}

                        {onDeletePromptItem && (
                          <button
                            onClick={() => onDeletePromptItem(item.id)}
                            className="p-1 rounded text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                            title="Remove from queue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Metadata tags and status */}
                    <div className="mt-2.5 pt-2 border-t border-[#1b1f2b] flex items-center justify-between text-[11px]">
                      {getStatusLabel(item.status, item.error)}

                      <div className="flex items-center gap-1.5">
                        {item.referenceImageUrl ? (
                          <span className="text-[10px] font-mono text-zinc-300 bg-[#1c202a] px-2 py-0.5 rounded-full border border-[#272b38]">
                            Ref Attached
                          </span>
                        ) : item.text.includes('@') ? (
                          <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            <span>@auto-tagged</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
