import React, { useState, useEffect } from 'react';
import { 
  X, 
  History, 
  Trash2, 
  CheckSquare, 
  Square, 
  Layers, 
  RotateCcw, 
  Tag, 
  Clock 
} from 'lucide-react';
import { HistoryItem, PromptItem } from '../types';

interface HistoryRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoryItem[];
  onResumeFailedOnly: (failedPrompts: PromptItem[]) => void;
  onRestoreFullQueue: (allPrompts: PromptItem[]) => void;
  onRetryAllFailedInNewQueue: (failedPrompts: PromptItem[]) => void;
  onClearHistory: () => void;
  onDeletePromptsFromHistory?: (historyId: string, promptIdsToDelete: string[]) => void;
  onDeleteSession?: (historyId: string) => void;
}

export const HistoryRecoveryModal: React.FC<HistoryRecoveryModalProps> = ({
  isOpen,
  onClose,
  history,
  onResumeFailedOnly,
  onRestoreFullQueue,
  onRetryAllFailedInNewQueue,
  onClearHistory,
  onDeletePromptsFromHistory,
  onDeleteSession
}) => {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(
    history[0]?.id || null
  );
  const [viewFilter, setViewFilter] = useState<'failed' | 'all' | 'done'>('failed');
  const [selectedPromptIds, setSelectedPromptIds] = useState<Set<string>>(new Set());
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [confirmDeleteSession, setConfirmDeleteSession] = useState(false);

  const selectedRun = history.find(h => h.id === selectedRunId) || history[0];
  const allPrompts = selectedRun?.promptsSnapshot || [];
  const failedPrompts = allPrompts.filter(p => p.status === 'failed' || p.status === 'idle');
  const succeededPrompts = allPrompts.filter(p => p.status === 'done');

  // When run selection changes or modal opens, default selected prompt IDs to all failed/unfinished items
  useEffect(() => {
    if (selectedRun) {
      const failed = (selectedRun.promptsSnapshot || []).filter(
        p => p.status === 'failed' || p.status === 'idle'
      );
      setSelectedPromptIds(new Set(failed.map(p => p.id)));
      setViewFilter(failed.length > 0 ? 'failed' : 'all');
      setConfirmClearAll(false);
      setConfirmDeleteSession(false);
    }
  }, [selectedRunId, isOpen, history.length]);

  if (!isOpen) return null;

  const togglePromptSelection = (id: string) => {
    setSelectedPromptIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const currentFilterPrompts = 
    viewFilter === 'failed' 
      ? failedPrompts 
      : viewFilter === 'done' 
      ? succeededPrompts 
      : allPrompts;

  const toggleSelectAllCurrent = () => {
    const idsInCurrent = currentFilterPrompts.map(p => p.id);
    const allSelected = idsInCurrent.length > 0 && idsInCurrent.every(id => selectedPromptIds.has(id));
    
    setSelectedPromptIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        idsInCurrent.forEach(id => next.delete(id));
      } else {
        idsInCurrent.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleRetrySelected = () => {
    const selectedItems = allPrompts.filter(p => selectedPromptIds.has(p.id));
    if (selectedItems.length === 0) return;
    onRetryAllFailedInNewQueue(selectedItems);
    onClose();
  };

  const handleDeleteMarkedPrompts = () => {
    if (!selectedRun || selectedPromptIds.size === 0) return;
    if (onDeletePromptsFromHistory) {
      onDeletePromptsFromHistory(selectedRun.id, Array.from(selectedPromptIds));
      setSelectedPromptIds(new Set());
    }
  };

  const handleDeleteCurrentSession = () => {
    if (!selectedRun) return;
    if (onDeleteSession) {
      onDeleteSession(selectedRun.id);
      const remaining = history.filter(h => h.id !== selectedRun.id);
      setSelectedRunId(remaining[0]?.id || null);
      setConfirmDeleteSession(false);
    }
  };

  const handleClearAllHistoryClick = () => {
    if (!confirmClearAll) {
      setConfirmClearAll(true);
      setTimeout(() => setConfirmClearAll(false), 4000);
      return;
    }
    onClearHistory();
    setConfirmClearAll(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0c0d12] border border-[#1f2330] rounded-2xl w-full max-w-4xl h-[88dvh] max-h-[88dvh] sm:h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="flex items-center justify-between px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-[#1c202c] bg-[#10121a] shrink-0">
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[#181b26] border border-[#262c3e] flex items-center justify-center text-zinc-300 shrink-0">
              <History className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            </div>
            <div className="min-w-0">
              <h2 className="text-xs sm:text-sm font-bold text-white tracking-tight truncate">
                Run History &amp; Recovery
              </h2>
              <p className="text-[10px] sm:text-[11px] text-zinc-400 truncate hidden xs:block">
                Inspect generation batches, select specific takes, and recover
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {history.length > 0 && (
              <button
                onClick={handleClearAllHistoryClick}
                className={`flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-xl border text-[11px] sm:text-xs font-semibold transition-all ${
                  confirmClearAll
                    ? 'bg-red-600 text-white border-red-500 animate-pulse'
                    : 'bg-[#151722] hover:bg-red-950/40 text-zinc-300 hover:text-red-300 border-[#242838]'
                }`}
                title="Wipe entire history"
              >
                <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                <span>{confirmClearAll ? 'Confirm Clear?' : 'Clear All'}</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-[#1a1d28] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Sessions Strip (Takes only ~40px instead of consuming the viewport) */}
        {history.length > 0 && (
          <div className="flex md:hidden items-center gap-1.5 overflow-x-auto px-3 py-1.5 bg-[#090a0f] border-b border-[#181a24] shrink-0 scrollbar-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 shrink-0 mr-1">
              Runs ({history.length}):
            </span>
            {history.map(item => {
              const isSelected = item.id === (selectedRun?.id);
              return (
                <button
                  key={item.id}
                  onClick={() => setSelectedRunId(item.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium shrink-0 flex items-center gap-1.5 border transition-all ${
                    isSelected
                      ? 'bg-[#1c202d] border-[#38425d] text-white shadow-sm font-semibold'
                      : 'bg-[#10121a] border-[#181b26] text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate max-w-[110px]">{item.queueName}</span>
                  <span className={`text-[9px] font-mono px-1 py-0.2 rounded uppercase ${
                    item.status === 'done' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {item.done}/{item.total}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Main Body Layout */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
          {/* Desktop Left Sessions Sidebar */}
          <div className="hidden md:flex w-60 bg-[#090a0f] border-r border-[#1a1d28] p-3 overflow-y-auto flex-col gap-1.5 shrink-0">
            <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 px-1 py-0.5 shrink-0">
              Sessions ({history.length})
            </div>

            {history.length === 0 ? (
              <div className="py-6 text-center text-zinc-500 text-xs shrink-0 w-full">
                No past runs yet.
              </div>
            ) : (
              history.map(item => {
                const isSelected = item.id === (selectedRun?.id);
                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedRunId(item.id)}
                    className={`text-left p-2.5 rounded-xl text-xs transition-all border w-full flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-[#1c202d] border-[#363d52] text-white shadow-sm'
                        : 'bg-[#10121a] border-[#181b26] text-zinc-400 hover:text-zinc-200 hover:border-[#222736]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 w-full">
                      <span className="font-semibold text-zinc-200 truncate text-xs">
                        {item.queueName}
                      </span>
                      <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded uppercase font-semibold ${
                        item.status === 'done' 
                          ? 'text-emerald-400 bg-emerald-950/40 border border-emerald-800/30' 
                          : item.status === 'idle' || item.status === 'draft'
                          ? 'text-blue-300 bg-blue-950/40 border border-blue-800/30'
                          : 'text-amber-400 bg-amber-950/40 border border-amber-800/30'
                      }`}>
                        {item.status === 'idle' ? 'draft' : item.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono w-full">
                      <span>{item.done}/{item.total} done</span>
                      <span>{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Right Scrollable Prompts Container: Guaranteed smooth touch scroll */}
          <div 
            className="flex-1 overflow-y-auto overscroll-y-auto bg-[#0d0e13] p-3 sm:p-5 space-y-3 min-h-0 touch-pan-y relative"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {selectedRun ? (
              <>
                {/* Session Header Card */}
                <div className="p-3 sm:p-4 rounded-2xl bg-[#13151c] border border-[#1f222d] flex flex-wrap items-center justify-between gap-2.5 shrink-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-white tracking-tight truncate">
                        {selectedRun.queueName}
                      </h3>
                      <span className="text-[10px] text-zinc-400 font-mono bg-[#1a1d27] border border-[#272b38] px-2 py-0.5 rounded-full">
                        {new Date(selectedRun.timestamp).toLocaleDateString()} {new Date(selectedRun.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-xs mt-1.5 flex-wrap">
                      <span className="text-emerald-400 font-medium text-[11px] sm:text-xs">
                        ✓ {succeededPrompts.length} completed
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span className={`text-[11px] sm:text-xs font-medium ${failedPrompts.length > 0 ? 'text-amber-400' : 'text-zinc-400'}`}>
                        {failedPrompts.length} unfinished
                      </span>
                      <span className="text-zinc-600">·</span>
                      <span className="text-zinc-400 text-[11px] sm:text-xs">
                        {allPrompts.length} total
                      </span>
                    </div>
                  </div>

                  {/* Delete session record */}
                  <div className="flex items-center gap-2 shrink-0">
                    {confirmDeleteSession ? (
                      <button
                        onClick={handleDeleteCurrentSession}
                        className="px-2.5 py-1 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold transition-colors"
                      >
                        Confirm Delete
                      </button>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteSession(true)}
                        className="p-1.5 sm:p-2 rounded-xl bg-[#181a24] hover:bg-red-950/30 text-zinc-400 hover:text-red-300 border border-[#262938] transition-colors"
                        title="Delete this session record"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Filter and Select Toolbar */}
                <div className="flex flex-wrap items-center justify-between gap-2 px-0.5 shrink-0">
                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 p-1 rounded-xl bg-[#0a0b10] border border-[#1a1d28] text-xs">
                    <button
                      onClick={() => setViewFilter('failed')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all text-xs ${
                        viewFilter === 'failed'
                          ? 'bg-[#222532] text-white font-semibold shadow-sm border border-[#353b4e]'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Unfinished ({failedPrompts.length})
                    </button>
                    <button
                      onClick={() => setViewFilter('done')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all text-xs ${
                        viewFilter === 'done'
                          ? 'bg-[#222532] text-white font-semibold shadow-sm border border-[#353b4e]'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      Completed ({succeededPrompts.length})
                    </button>
                    <button
                      onClick={() => setViewFilter('all')}
                      className={`px-2.5 sm:px-3 py-1 rounded-lg transition-all text-xs ${
                        viewFilter === 'all'
                          ? 'bg-[#222532] text-white font-semibold shadow-sm border border-[#353b4e]'
                          : 'text-zinc-400 hover:text-zinc-200'
                      }`}
                    >
                      All ({allPrompts.length})
                    </button>
                  </div>

                  {/* Mark/Unmark Controls */}
                  {currentFilterPrompts.length > 0 && (
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={toggleSelectAllCurrent}
                        className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white font-medium transition-colors cursor-pointer"
                      >
                        {currentFilterPrompts.every(p => selectedPromptIds.has(p.id)) && currentFilterPrompts.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-amber-400" />
                        ) : (
                          <Square className="w-4 h-4 text-zinc-400" />
                        )}
                        <span className="text-[11px] sm:text-xs">
                          {currentFilterPrompts.every(p => selectedPromptIds.has(p.id)) ? 'Deselect All' : 'Select All'}
                        </span>
                      </button>

                      {selectedPromptIds.size > 0 && onDeletePromptsFromHistory && (
                        <button
                          onClick={handleDeleteMarkedPrompts}
                          className="flex items-center gap-1 text-[11px] sm:text-xs text-red-400 hover:text-red-300 transition-colors font-medium cursor-pointer"
                          title="Remove selected prompts from history record"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Clear ({selectedPromptIds.size})</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Prompts List: Smooth multiline items with full text readability */}
                <div className="space-y-2 pb-24">
                  {currentFilterPrompts.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 text-xs">
                      {viewFilter === 'failed'
                        ? '✓ No unfinished prompts in this session!'
                        : viewFilter === 'done'
                        ? 'No completed prompts in this session yet.'
                        : 'No prompts recorded.'}
                    </div>
                  ) : (
                    currentFilterPrompts.map((p, idx) => {
                      const isSelected = selectedPromptIds.has(p.id);

                      return (
                        <div
                          key={p.id || idx}
                          onClick={() => togglePromptSelection(p.id)}
                          className={`p-3 sm:p-3.5 rounded-2xl border transition-all flex items-start gap-2.5 sm:gap-3 cursor-pointer touch-pan-y ${
                            isSelected
                              ? 'bg-[#181c28] border-[#38425d] shadow-sm'
                              : 'bg-[#11131a] border-[#1e222e] hover:border-[#2b3142]'
                          }`}
                        >
                          {/* Checkbox button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePromptSelection(p.id);
                            }}
                            className="mt-0.5 text-zinc-400 hover:text-white shrink-0 p-0.5"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-amber-400" />
                            ) : (
                              <Square className="w-4 h-4 text-zinc-400" />
                            )}
                          </button>

                          {/* Identifier Box */}
                          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#1a1d27] border border-[#272b38] flex items-center justify-center font-mono font-bold text-amber-400 text-[11px] sm:text-xs shrink-0 select-none">
                            {p.customId || String(idx + 1).padStart(2, '0')}
                          </div>

                          {/* Full Prompt Text & Metadata */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-zinc-200 font-sans leading-relaxed break-words whitespace-pre-wrap select-text">
                              {p.text}
                            </p>

                            <div className="mt-2 pt-1.5 border-t border-[#1a1d27] flex items-center justify-between text-[10px] sm:text-[11px] gap-2 flex-wrap">
                              <span className={`font-mono text-[9px] sm:text-[10px] px-2 py-0.5 rounded-full uppercase font-semibold ${
                                p.status === 'done'
                                  ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/30'
                                  : 'bg-zinc-800 text-zinc-300 border border-zinc-700/40'
                              }`}>
                                {p.status === 'done' ? 'Completed' : 'Unfinished'}
                              </span>

                              {p.text.includes('@') && (
                                <span className="text-[9px] sm:text-[10px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 flex items-center gap-1">
                                  <Tag className="w-2.5 h-2.5" />
                                  <span>@tagged</span>
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Sticky Bottom Actions Bar (Guaranteed accessible, never pushed off screen) */}
                <div className="sticky bottom-0 z-20 -mx-3 -mb-3 sm:-mx-5 sm:-mb-5 p-3 sm:p-4 bg-[#0d0e13]/95 backdrop-blur-md border-t border-[#1c202c] flex flex-wrap items-center justify-between gap-2 shrink-0 shadow-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                    <button
                      onClick={() => {
                        onRestoreFullQueue(selectedRun.promptsSnapshot);
                        onClose();
                      }}
                      className="py-2 sm:py-2.5 px-3 rounded-xl bg-[#14161f] hover:bg-[#1c202b] text-zinc-300 border border-[#252835] text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer"
                    >
                      Restore All ({allPrompts.length})
                    </button>

                    {failedPrompts.length > 0 && (
                      <button
                        onClick={() => {
                          onResumeFailedOnly(failedPrompts);
                          onClose();
                        }}
                        className="py-2 sm:py-2.5 px-3 rounded-xl bg-[#181b26] hover:bg-[#202534] text-zinc-200 border border-[#282f42] text-[11px] sm:text-xs font-semibold transition-colors cursor-pointer"
                      >
                        Replace Failed ({failedPrompts.length})
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {selectedPromptIds.size > 0 && (
                      <button
                        onClick={handleRetrySelected}
                        className="flex items-center gap-1.5 py-2 sm:py-2.5 px-4 rounded-xl bg-[#242733] hover:bg-[#2e3344] text-white border border-[#3e4558] text-[11px] sm:text-xs font-bold shadow-md transition-all cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>Retry Selected ({selectedPromptIds.size})</span>
                      </button>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="py-20 text-center text-zinc-400 text-xs">
                No session selected.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
