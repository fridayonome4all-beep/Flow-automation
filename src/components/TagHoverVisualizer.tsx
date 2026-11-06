import React, { useState } from 'react';
import { ReferenceImageSlot } from '../types';
import { ImageIcon, AlertCircle, Link as LinkIcon } from 'lucide-react';

interface TagHoverVisualizerProps {
  promptText: string;
  allSlots: ReferenceImageSlot[];
  onOpenSlotLinker?: (tag: string) => void;
}

export const TagHoverVisualizer: React.FC<TagHoverVisualizerProps> = ({
  promptText,
  allSlots,
  onOpenSlotLinker
}) => {
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  if (!promptText) return null;

  // Split prompt text into tokens and tags
  const tokens = promptText.split(/(@[a-zA-Z0-9_\-]+)/g);

  const getSlotForTag = (tag: string) => {
    return allSlots.find(s => s.tag.toLowerCase() === tag.toLowerCase());
  };

  const getTagColorClass = (tag: string) => {
    const lower = tag.toLowerCase();
    if (lower.includes('scene') || lower.includes('bg') || lower.includes('city') || lower.includes('room')) {
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25';
    }
    if (lower.includes('style') || lower.includes('art') || lower.includes('film') || lower.includes('35mm')) {
      return 'bg-purple-500/15 text-purple-300 border-purple-500/30 hover:bg-purple-500/25';
    }
    return 'bg-blue-500/15 text-blue-300 border-blue-500/30 hover:bg-blue-500/25';
  };

  const activeSlot = hoveredTag ? getSlotForTag(hoveredTag) : null;

  return (
    <div className="relative text-xs leading-relaxed font-mono">
      {tokens.map((token, i) => {
        if (token.startsWith('@')) {
          const slot = getSlotForTag(token);
          const hasImage = Boolean(slot?.imageUrl);

          return (
            <span
              key={i}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTag(token);
                setHoverPos({ x: rect.left, y: rect.bottom + window.scrollY + 6 });
              }}
              onMouseLeave={() => setHoveredTag(null)}
              onClick={() => onOpenSlotLinker && onOpenSlotLinker(token)}
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 mx-0.5 rounded border text-[11px] font-semibold cursor-pointer transition-all ${getTagColorClass(
                token
              )} ${!hasImage ? 'border-dashed opacity-85' : ''}`}
            >
              <span>{token}</span>
              {hasImage ? (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              ) : (
                <span className="text-[10px] text-amber-400">?</span>
              )}
            </span>
          );
        }
        return <span key={i}>{token}</span>;
      })}

      {/* Floating Hover Preview Card */}
      {hoveredTag && hoverPos && (
        <div
          style={{
            top: hoverPos.y,
            left: Math.min(hoverPos.x, window.innerWidth - 240)
          }}
          className="fixed z-50 w-56 p-2.5 rounded-xl bg-[#141720] border border-[#2b3347] shadow-2xl text-xs text-zinc-200 pointer-events-none animate-in fade-in zoom-in-95 duration-150"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="font-mono font-bold text-blue-400 text-xs">{hoveredTag}</span>
            <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-400">
              {activeSlot?.category || 'Reference'}
            </span>
          </div>

          {activeSlot?.imageUrl ? (
            <div className="space-y-1.5">
              <div className="aspect-[4/3] rounded-lg overflow-hidden bg-black border border-[#222838]">
                <img
                  src={activeSlot.imageUrl}
                  alt={activeSlot.label}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-zinc-300">
                <span className="truncate max-w-[120px]">{activeSlot.label}</span>
                <span className="text-zinc-500 font-mono">w: {activeSlot.weight.toFixed(2)}</span>
              </div>
            </div>
          ) : (
            <div className="p-2 rounded-lg bg-amber-950/20 border border-amber-900/30 flex items-start gap-2 text-amber-300 text-[11px]">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <div>
                <p className="font-medium">Unlinked @Tag</p>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  No reference image linked yet. Click tag to assign in vault.
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
