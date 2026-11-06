import React, { useState } from 'react';
import { Plus, X, Copy, Edit2, Check, Layers } from 'lucide-react';
import { QueueTab } from '../types';

interface QueueTabsBarProps {
  queues: QueueTab[];
  activeQueueId: string;
  onSelectQueue: (id: string) => void;
  onAddQueue: (name: string) => void;
  onRenameQueue: (id: string, newName: string) => void;
  onDeleteQueue: (id: string) => void;
  onDuplicateQueue: (id: string) => void;
}

export const QueueTabsBar: React.FC<QueueTabsBarProps> = ({
  queues,
  activeQueueId,
  onSelectQueue,
  onAddQueue,
  onRenameQueue,
  onDeleteQueue,
  onDuplicateQueue
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [newQueueName, setNewQueueName] = useState('');

  const handleStartRename = (q: QueueTab, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(q.id);
    setEditName(q.name);
  };

  const handleSaveRename = (id: string) => {
    if (editName.trim()) {
      onRenameQueue(id, editName.trim());
    }
    setEditingId(null);
  };

  const handleCreateNew = () => {
    if (newQueueName.trim()) {
      onAddQueue(newQueueName.trim());
      setNewQueueName('');
      setIsAdding(false);
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-1 border-b border-[#212631] px-4 lg:px-6 bg-[#0e1015]">
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mr-1 hidden sm:inline-flex items-center gap-1">
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          Queues:
        </span>

        {queues.map((q) => {
          const isActive = q.id === activeQueueId;
          const promptCount = q.promptsText
            .split(/\n\s*\n/)
            .map((s) => s.trim())
            .filter(Boolean).length;

          if (editingId === q.id) {
            return (
              <div
                key={q.id}
                className="flex items-center gap-1 bg-[#1a1f2c] border border-blue-500/50 rounded-lg px-2 py-1"
              >
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename(q.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  className="bg-transparent text-xs text-white outline-none w-28 font-medium"
                />
                <button
                  onClick={() => handleSaveRename(q.id)}
                  className="p-0.5 text-emerald-400 hover:text-emerald-300"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="p-0.5 text-zinc-400 hover:text-zinc-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            );
          }

          return (
            <div
              key={q.id}
              onClick={() => onSelectQueue(q.id)}
              className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${
                isActive
                  ? 'bg-[#181d28] border-blue-500/50 text-white shadow-sm'
                  : 'bg-[#12151c] border-[#232938] text-zinc-400 hover:text-zinc-200 hover:border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  q.status === 'running'
                    ? 'bg-blue-400 animate-pulse'
                    : q.status === 'done'
                    ? 'bg-emerald-400'
                    : 'bg-zinc-500'
                }`}
              />
              <span className="truncate max-w-[130px]">{q.name}</span>
              <span className="text-[11px] font-mono px-1.5 py-0.2 rounded bg-zinc-800/80 text-zinc-400">
                {promptCount}
              </span>

              {/* Hover actions */}
              <div className="hidden group-hover:flex items-center gap-0.5 ml-1 text-zinc-400">
                <button
                  onClick={(e) => handleStartRename(q, e)}
                  title="Rename Queue"
                  className="p-0.5 hover:text-zinc-200"
                >
                  <Edit2 className="w-3 h-3" />
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDuplicateQueue(q.id);
                  }}
                  title="Duplicate Queue"
                  className="p-0.5 hover:text-zinc-200"
                >
                  <Copy className="w-3 h-3" />
                </button>
                {queues.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteQueue(q.id);
                    }}
                    title="Delete Queue"
                    className="p-0.5 hover:text-red-400"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {isAdding ? (
          <div className="flex items-center gap-1 bg-[#1a1f2c] border border-blue-500/50 rounded-lg px-2 py-1">
            <input
              type="text"
              placeholder="Queue name..."
              value={newQueueName}
              onChange={(e) => setNewQueueName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateNew();
                if (e.key === 'Escape') setIsAdding(false);
              }}
              autoFocus
              className="bg-transparent text-xs text-white outline-none w-28 font-medium placeholder:text-zinc-600"
            />
            <button
              onClick={handleCreateNew}
              className="p-0.5 text-emerald-400 hover:text-emerald-300"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setIsAdding(false)}
              className="p-0.5 text-zinc-400 hover:text-zinc-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsAdding(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-dashed border-[#2b3243] hover:border-blue-500/50 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Queue</span>
          </button>
        )}
      </div>
    </div>
  );
};
