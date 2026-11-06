import React, { useState } from 'react';
import { 
  Upload, 
  Trash2, 
  Image as ImageIcon, 
  Link as LinkIcon, 
  Search,
  Plus,
  Sliders,
  Check
} from 'lucide-react';
import { ReferenceCategory, ReferenceImageSlot } from '../types';

interface ReferenceManagerProps {
  subjectSlots: ReferenceImageSlot[];
  sceneSlots: ReferenceImageSlot[];
  styleSlots: ReferenceImageSlot[];
  differentImageForEachPrompt: boolean;
  onToggleDifferentImage: (value: boolean) => void;
  onUpdateSlot: (category: ReferenceCategory, slotIndex: number, updates: Partial<ReferenceImageSlot>) => void;
  onClearSlot: (category: ReferenceCategory, slotIndex: number) => void;
  onClearAllCategory: (category: ReferenceCategory) => void;
}

export const ReferenceManager: React.FC<ReferenceManagerProps> = ({
  subjectSlots,
  sceneSlots,
  styleSlots,
  differentImageForEachPrompt,
  onToggleDifferentImage,
  onUpdateSlot,
  onClearSlot,
  onClearAllCategory
}) => {
  const [activeCategory, setActiveCategory] = useState<ReferenceCategory>('subject');
  const [searchQuery, setSearchQuery] = useState('');
  const [urlModalSlot, setUrlModalSlot] = useState<{ category: ReferenceCategory; index: number } | null>(null);
  const [urlInput, setUrlInput] = useState('');

  const currentSlots = 
    activeCategory === 'subject' 
      ? subjectSlots 
      : activeCategory === 'scene' 
      ? sceneSlots 
      : styleSlots;

  const filledSlots = currentSlots.filter(s => Boolean(s.imageUrl));
  // Progressive disclosure: show filled slots + the very next empty slot
  const nextEmptySlot = currentSlots.find(s => !s.imageUrl);

  const displayedSlots = searchQuery.trim()
    ? currentSlots.filter(s => 
        Boolean(s.imageUrl) && (
          s.tag.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.label.toLowerCase().includes(searchQuery.toLowerCase())
        )
      )
    : [...filledSlots];

  const handleFileUpload = (category: ReferenceCategory, index: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
      onUpdateSlot(category, index, {
        imageUrl: result,
        fileName: file.name,
        label: cleanName || `${category} ${index}`
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUrl = () => {
    if (urlModalSlot && urlInput.trim()) {
      onUpdateSlot(urlModalSlot.category, urlModalSlot.index, {
        imageUrl: urlInput.trim(),
        label: `${urlModalSlot.category} ${urlModalSlot.index}`
      });
      setUrlInput('');
      setUrlModalSlot(null);
    }
  };

  return (
    <div className="bg-[#111319] border border-[#232733] rounded-2xl flex flex-col h-full overflow-hidden shadow-sm">
      {/* Top Header */}
      <div className="p-4 bg-[#151821] border-b border-[#212631] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-blue-400" />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-white">
              Reference Vault
            </h2>
            <span className="text-[11px] font-mono text-zinc-400">
              ({filledSlots.length} active)
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-0.5">
            Attach references to mention via @tags (e.g. @subject1, @scene1, @style1)
          </p>
        </div>

        {/* Override Rule */}
        <label className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#181c26] border border-[#262c3d] cursor-pointer text-xs">
          <input
            type="checkbox"
            checked={differentImageForEachPrompt}
            onChange={(e) => onToggleDifferentImage(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-blue-600 focus:ring-0"
          />
          <span className="text-zinc-200 font-medium">
            Sequential Prompt Override
          </span>
        </label>
      </div>

      {/* Category Tabs: Subject / Scene / Style */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#13161f] border-b border-[#212631] text-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {(['subject', 'scene', 'style'] as ReferenceCategory[]).map((cat) => {
            const count = (cat === 'subject' ? subjectSlots : cat === 'scene' ? sceneSlots : styleSlots)
              .filter(s => Boolean(s.imageUrl)).length;
            const isSel = activeCategory === cat;
            const categoryLabels: Record<ReferenceCategory, string> = {
              subject: 'Characters',
              scene: 'Scenes',
              style: 'Styles'
            };
            return (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  isSel
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {categoryLabels[cat]} ({count})
              </button>
            );
          })}
        </div>

        {filledSlots.length > 0 && (
          <button
            onClick={() => onClearAllCategory(activeCategory)}
            className="text-zinc-500 hover:text-red-400 text-xs transition-colors"
          >
            Clear {activeCategory}
          </button>
        )}
      </div>

      {/* Grid of Slots: Filled slots + Progressive Single Empty Add Slot */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {displayedSlots.map((slot) => (
            <div
              key={slot.id}
              className="group relative rounded-xl p-2.5 bg-[#151922] border border-blue-500/30 flex flex-col justify-between transition-all shadow-sm"
            >
              <div className="flex items-center justify-between mb-1.5 text-xs">
                <span className="font-mono font-bold text-blue-400 text-[11px] truncate">
                  {slot.tag}
                </span>
                <button
                  onClick={() => onClearSlot(activeCategory, slot.index)}
                  className="opacity-0 group-hover:opacity-100 text-zinc-500 hover:text-red-400 transition-opacity"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Thumbnail */}
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-black border border-[#222736] relative mb-2">
                <img
                  src={slot.imageUrl}
                  alt={slot.label}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Editable Label */}
              <input
                type="text"
                value={slot.label}
                onChange={(e) =>
                  onUpdateSlot(activeCategory, slot.index, { label: e.target.value })
                }
                placeholder="Label..."
                className="w-full bg-[#0d0f14] border border-[#242a3a] rounded px-1.5 py-0.5 text-[11px] text-zinc-200 outline-none truncate mb-1"
              />

              {/* Weight Slider */}
              <div className="flex items-center justify-between text-[10px] text-zinc-400">
                <span>Weight:</span>
                <span className="font-mono text-zinc-300">{slot.weight.toFixed(2)}</span>
              </div>
            </div>
          ))}

          {/* Progressive Single Empty Slot: Only one visible at a time! */}
          {nextEmptySlot && (
            <div className="rounded-xl border border-dashed border-[#2b3243] hover:border-blue-500/50 bg-[#0e1016]/50 p-3 flex flex-col items-center justify-center text-center transition-all min-h-[160px]">
              <div className="w-8 h-8 rounded-lg bg-[#181c28] flex items-center justify-center text-zinc-400 mb-2">
                <Plus className="w-4 h-4 text-blue-400" />
              </div>
              <span className="text-xs font-semibold text-zinc-200 mb-3">
                Add {activeCategory === 'subject' ? 'Character' : activeCategory === 'scene' ? 'Scene' : 'Style'}
              </span>

              <div className="flex items-center gap-1.5">
                <label className="px-2.5 py-1 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-medium cursor-pointer transition-colors shadow">
                  Upload
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(activeCategory, nextEmptySlot.index, file);
                    }}
                    className="hidden"
                  />
                </label>

                <button
                  onClick={() => setUrlModalSlot({ category: activeCategory, index: nextEmptySlot.index })}
                  className="p-1 rounded-md bg-[#1a1f2c] text-zinc-300 hover:text-white border border-[#2a3347]"
                  title="Paste URL"
                >
                  <LinkIcon className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* URL Input Modal */}
      {urlModalSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-[#141720] border border-[#2b3347] rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-white mb-2">
              Set Image for {urlModalSlot.category} #{urlModalSlot.index}
            </h3>
            <input
              type="text"
              placeholder="https://..."
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              autoFocus
              className="w-full bg-[#0a0c10] border border-[#2b3347] rounded-lg p-2 text-xs text-zinc-200 outline-none font-mono mb-4"
            />
            <div className="flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setUrlModalSlot(null)}
                className="px-3 py-1.5 text-zinc-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveUrl}
                className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
