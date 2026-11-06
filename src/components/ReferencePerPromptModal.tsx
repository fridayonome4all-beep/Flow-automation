import React, { useState } from 'react';
import { X, Plus, Edit2, Trash2, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { PromptItem, ReferenceImageSlot } from '../types';

interface ReferencePerPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompts: PromptItem[];
  availableSlots: ReferenceImageSlot[];
  onSavePrompts: (updatedPrompts: PromptItem[]) => void;
  onUploadSlotImage?: (slotTag: string, file: File) => void;
}

export const ReferencePerPromptModal: React.FC<ReferencePerPromptModalProps> = ({
  isOpen,
  onClose,
  prompts,
  availableSlots = [],
  onSavePrompts,
  onUploadSlotImage
}) => {
  const [items, setItems] = useState<PromptItem[]>(() => JSON.parse(JSON.stringify(prompts)));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setItems(JSON.parse(JSON.stringify(prompts)));
      setEditingId(null);
    }
  }, [isOpen, prompts]);

  if (!isOpen) return null;

  const handleCustomImageUpload = (promptId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      setItems(prev => prev.map(item => {
        if (item.id === promptId) {
          return {
            ...item,
            referenceImageUrl: dataUrl,
            referenceImageName: file.name
          };
        }
        return item;
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomImage = (promptId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === promptId) {
        return {
          ...item,
          referenceImageUrl: undefined,
          referenceImageName: undefined
        };
      }
      return item;
    }));
  };

  const handleDeletePrompt = (promptId: string) => {
    setItems(prev => prev.filter(item => item.id !== promptId));
  };

  const handleStartEdit = (item: PromptItem) => {
    setEditingId(item.id);
    setEditText(item.text);
  };

  const handleSaveEdit = (promptId: string) => {
    setItems(prev => prev.map(item => {
      if (item.id === promptId) {
        return { ...item, text: editText };
      }
      return item;
    }));
    setEditingId(null);
  };

  const handleSaveAll = () => {
    onSavePrompts(items);
    onClose();
  };

  // Helper to extract all @tags mentioned in prompt text
  const extractTags = (text: string): string[] => {
    const matches = text.match(/@([a-zA-Z0-9_-]+)/g);
    if (!matches) return [];
    return Array.from(new Set(matches));
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-[#12141c] border border-[#232734] rounded-2xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#212634] bg-[#151824]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-semibold text-white tracking-wide">
              Reference images per prompt
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-[#202534] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content - Scrollable Prompt Cards with Magnetic Cast Snapping */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {items.length === 0 ? (
            <div className="py-12 text-center text-zinc-500 text-xs">
              No prompts loaded in the queue. Paste prompts and click "Load prompts" first.
            </div>
          ) : (
            items.map((item, idx) => {
              const tags = extractTags(item.text);
              const hasTags = tags.length > 0;
              const matchedSlotWithImage = hasTags ? availableSlots.find(s => {
                const sTag = s.tag.toLowerCase();
                const sLabel = s.label.toLowerCase();
                return Boolean(s.imageUrl) && tags.some(t => {
                  const clean = t.toLowerCase();
                  return sTag === clean || sLabel === clean.replace('@', '') || `@${sLabel}` === clean;
                });
              }) : null;

              return (
                <div
                  key={item.id}
                  className="bg-[#181b26] border border-[#252a3a] rounded-xl p-3 flex gap-3 items-start transition-all hover:border-[#32394e]"
                >
                  {/* Left Column: Magnetic @Tag References OR Custom Reference Slot */}
                  <div className="shrink-0 flex gap-1.5 overflow-x-auto max-w-[140px]">
                    {hasTags ? (
                      matchedSlotWithImage ? (
                        <div 
                          className="w-24 h-24 rounded-xl border border-blue-500/50 bg-[#11131a] relative group overflow-hidden shrink-0 flex flex-col"
                          title={`${tags.join(', ')}: Reference attached`}
                        >
                          <img
                            src={matchedSlotWithImage.imageUrl}
                            alt={tags[0]}
                            className="w-full h-18 object-cover rounded-t"
                          />
                          <div className="bg-[#0e1118] text-[9px] font-mono text-center py-0.5 text-blue-300 font-bold truncate px-1">
                            {tags.join(' ')}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="w-24 h-24 rounded-xl border-2 border-dashed border-[#282e3e] flex flex-col items-center justify-center text-center p-1.5 bg-[#10131b] shrink-0 select-none"
                          title="This prompt uses @tag. Remove the tag to manually pick an image."
                        >
                          <span className="text-[11px] font-bold text-zinc-300 font-sans">uses @tag</span>
                          <span className="text-[9px] text-zinc-500 mt-1 leading-tight">
                            remove the tag<br />to pick images
                          </span>
                        </div>
                      )
                    ) : item.referenceImageUrl ? (
                      <div className="w-24 h-24 relative rounded-xl border border-[#2f3548] bg-[#11131a] overflow-hidden shrink-0">
                        <img
                          src={item.referenceImageUrl}
                          alt="Custom Reference"
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={() => handleRemoveCustomImage(item.id)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/75 text-zinc-300 hover:text-red-400 transition-colors"
                          title="Remove custom image"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <label 
                        className="w-24 h-24 rounded-xl border-2 border-dashed border-[#282e3e] hover:border-blue-500/60 flex flex-col items-center justify-center cursor-pointer bg-[#10131b] hover:bg-[#131722] shrink-0 transition-colors group"
                        title="Click to attach custom image for this prompt"
                      >
                        <Plus className="w-6 h-6 text-zinc-500 group-hover:text-zinc-200 transition-colors stroke-[1.75]" />
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleCustomImageUpload(item.id, file);
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* Right Column: Prompt ID & Text & Actions */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between min-h-[96px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-amber-400 font-mono truncate">
                        {idx + 1}. {item.customId}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {editingId === item.id ? (
                          <button
                            onClick={() => handleSaveEdit(item.id)}
                            className="p-1 rounded text-emerald-400 hover:bg-emerald-950/30 transition-colors"
                            title="Save prompt text"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleStartEdit(item)}
                            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-[#252b3b] transition-colors"
                            title="Edit prompt text"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={() => handleDeletePrompt(item.id)}
                          className="p-1 rounded text-zinc-400 hover:text-red-400 hover:bg-red-950/30 transition-colors"
                          title="Delete prompt"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {editingId === item.id ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full h-16 p-1.5 bg-[#0e1017] border border-[#2e364a] rounded text-xs text-zinc-100 font-mono resize-none outline-none focus:border-blue-500"
                        autoFocus
                      />
                    ) : (
                      <p className="text-[11px] text-zinc-300 font-sans line-clamp-3 leading-relaxed break-words mt-1">
                        {item.text}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer matching Screenshot_20261103-093513.png */}
        <div className="px-5 py-3 border-t border-[#1e222d] bg-[#12141c] flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl border border-[#262a37] bg-[#171922] hover:bg-[#20232f] text-zinc-300 font-medium text-xs transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveAll}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#242733] hover:bg-[#2e3241] border border-[#3e4456] text-white font-semibold text-xs shadow-sm transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
