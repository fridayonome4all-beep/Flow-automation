import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Check, 
  Tag, 
  Image as ImageIcon, 
  ArrowRight, 
  Layers, 
  RefreshCw,
  FileCheck,
  AlertCircle,
  Wand2,
  Upload
} from 'lucide-react';
import { 
  DetectedReference, 
  ReferenceCategory, 
  ReferenceImageSlot, 
  SuggestedAssignment 
} from '../types';
import { 
  analyzePromptsWithAI, 
  autoMapReferencesToSlots, 
  quickAutoTagWithLabels,
  analyzeTimelineForRecurringCast
} from '../services/promptScanner';

interface PromptScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  rawText: string;
  detectedReferences: DetectedReference[];
  suggestedAssignments: SuggestedAssignment[];
  onApplyMappedPrompts: (
    newPromptsText: string,
    updatedSubjects: ReferenceImageSlot[],
    updatedScenes: ReferenceImageSlot[],
    updatedStyles: ReferenceImageSlot[]
  ) => void;
  subjectSlots: ReferenceImageSlot[];
  sceneSlots: ReferenceImageSlot[];
  styleSlots: ReferenceImageSlot[];
}

export const PromptScanModal: React.FC<PromptScanModalProps> = ({
  isOpen,
  onClose,
  rawText,
  detectedReferences: initialReferences,
  suggestedAssignments: initialSuggested,
  onApplyMappedPrompts,
  subjectSlots,
  sceneSlots,
  styleSlots
}) => {
  const [references, setReferences] = useState<DetectedReference[]>(initialReferences);
  const [suggested, setSuggested] = useState<SuggestedAssignment[]>(initialSuggested);
  const [isAiScanning, setIsAiScanning] = useState(false);
  const [activeTab, setActiveTab] = useState<'detected' | 'suggested' | 'preview'>('detected');
  const [previewText, setPreviewText] = useState<string>(rawText);
  const [quickTagNotice, setQuickTagNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const allSlots = [...subjectSlots, ...sceneSlots, ...styleSlots];

  // Quick Auto-Tag from existing Reference labels
  const handleQuickAutoTag = () => {
    const { updatedText, matchedCount } = quickAutoTagWithLabels(previewText, allSlots);
    setPreviewText(updatedText);
    if (matchedCount > 0) {
      setQuickTagNotice(`Auto-tagged ${matchedCount} reference mention(s) from your Reference Vault labels!`);
      setActiveTab('preview');
    } else {
      setQuickTagNotice('No matching reference labels found in current text. Name your Reference slots to enable quick-matching.');
    }
  };

  // Timeline Recurring Cast Auto-Tag
  const handleTimelinePreTag = () => {
    const { recurringEntities, suggestedUpdatedText } = analyzeTimelineForRecurringCast(previewText, allSlots);
    setPreviewText(suggestedUpdatedText);
    if (recurringEntities.length > 0) {
      setQuickTagNotice(`Timeline pre-tagged: Found ${recurringEntities.length} recurring character/scene entities across prompt takes!`);
      setActiveTab('preview');
    } else {
      setQuickTagNotice('No recurring character names found occurring across multiple prompts.');
    }
  };

  // Deep AI Scan (Calls server proxy without exposing internal model branding)
  const handleRunAiAnalysis = async () => {
    setIsAiScanning(true);
    try {
      const result = await analyzePromptsWithAI(previewText, true);
      setReferences(result.detectedReferences);
      setPreviewText(result.taggedPrompts.join('\n\n'));
    } catch (err) {
      console.error('Analysis error:', err);
    } finally {
      setIsAiScanning(false);
    }
  };

  const handleUpdateReferenceType = (index: number, newType: ReferenceCategory) => {
    const updated = [...references];
    updated[index] = { ...updated[index], type: newType };
    setReferences(updated);
  };

  const handleApply = () => {
    const { updatedSubjects, updatedScenes, updatedStyles } = autoMapReferencesToSlots(
      references,
      subjectSlots,
      sceneSlots,
      styleSlots
    );

    onApplyMappedPrompts(previewText, updatedSubjects, updatedScenes, updatedStyles);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0f1117] border border-[#232733] rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#212631] bg-[#141722]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-600/10 border border-blue-500/20 text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Prompt Reference Scanner &amp; Tag Manager
              </h2>
              <p className="text-xs text-zinc-400">
                Scans for characters, scenes, and styles to link with Reference slots before running
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

        {/* Action Toolbar */}
        <div className="px-6 py-2.5 bg-[#12151f] border-b border-[#212631] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setActiveTab('detected')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'detected'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              Detected Tags ({references.length})
            </button>

            {suggested.length > 0 && (
              <button
                onClick={() => setActiveTab('suggested')}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  activeTab === 'suggested'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-amber-400 hover:text-amber-300 hover:bg-amber-950/30'
                }`}
              >
                Suggested Assignments ({suggested.length})
              </button>
            )}

            <button
              onClick={() => setActiveTab('preview')}
              className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                activeTab === 'preview'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/60'
              }`}
            >
              Tagged Prompts Preview
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleTimelinePreTag}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a202e] hover:bg-[#232b3d] text-amber-300 border border-amber-500/30 font-medium transition-colors"
              title="Scans the entire prompt timeline and automatically pre-tags recurring character names and locations"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>Pre-Tag Timeline</span>
            </button>

            <button
              onClick={handleQuickAutoTag}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1a202e] hover:bg-[#232b3d] text-zinc-200 border border-[#2b354a] font-medium transition-colors"
              title="Automatically tags keywords matching your Reference Vault labels"
            >
              <Wand2 className="w-3.5 h-3.5 text-blue-400" />
              <span>Quick Auto-Tag</span>
            </button>

            <button
              onClick={handleRunAiAnalysis}
              disabled={isAiScanning}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-medium transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAiScanning ? 'animate-spin' : ''}`} />
              <span>{isAiScanning ? 'Scanning...' : 'Deep AI Scan'}</span>
            </button>
          </div>
        </div>

        {/* Notices */}
        {quickTagNotice && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-blue-950/30 border border-blue-900/40 text-blue-300 text-xs flex items-center justify-between">
            <span>{quickTagNotice}</span>
            <button onClick={() => setQuickTagNotice(null)} className="text-zinc-500 hover:text-white">✕</button>
          </div>
        )}

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'detected' && (
            <div className="space-y-3">
              {references.length === 0 ? (
                <div className="py-12 text-center text-zinc-500">
                  <Tag className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-medium text-zinc-400">No @tags detected in current prompts</p>
                  <p className="text-xs mt-1 max-w-sm mx-auto">
                    Use <strong>Quick Auto-Tag</strong> to link words matching your Vault, or <strong>Deep AI Scan</strong> to detect entities automatically.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {references.map((ref, idx) => (
                    <div
                      key={ref.tag + idx}
                      className="p-3.5 rounded-xl bg-[#131620] border border-[#222736] flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-semibold text-xs text-blue-400">
                              {ref.tag}
                            </span>
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                              {ref.count}x
                            </span>
                            {ref.hasAssignedImage && (
                              <span className="text-[10px] font-medium text-emerald-400 flex items-center gap-0.5">
                                <Check className="w-3 h-3" /> Linked
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-medium text-zinc-200 mt-1 capitalize">
                            {ref.name}
                          </div>
                        </div>

                        <select
                          value={ref.type}
                          onChange={(e) =>
                            handleUpdateReferenceType(idx, e.target.value as ReferenceCategory)
                          }
                          className="bg-[#1a202d] text-xs text-zinc-300 border border-[#2b354a] rounded-lg px-2 py-1 outline-none"
                        >
                          <option value="subject">Subject</option>
                          <option value="scene">Scene</option>
                          <option value="style">Style</option>
                        </select>
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-[#1d2230] text-[11px] text-zinc-400">
                        <span>Vault Target:</span>
                        <span className="font-medium text-zinc-300">
                          {ref.type.toUpperCase()} Slot #{idx + 1}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'suggested' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400 mb-2">
                These @tags are mentioned in your prompts but currently have no reference image attached in your Vault:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {suggested.map((sug, i) => (
                  <div
                    key={i}
                    className="p-3.5 rounded-xl bg-amber-950/10 border border-amber-900/30 flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-amber-400 text-xs">
                        {sug.tag}
                      </span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                        {sug.type}
                      </span>
                    </div>

                    <p className="text-xs text-zinc-300 capitalize">{sug.suggestedName}</p>
                    <div className="text-[11px] text-zinc-400 flex items-center justify-between pt-2 border-t border-amber-900/20">
                      <span>Suggested Slot:</span>
                      <span className="text-amber-300 font-medium font-mono">
                        {sug.type} #{sug.availableSlotIndex}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="space-y-3">
              <div className="text-xs text-zinc-400">Preview prompts ready for execution:</div>
              <textarea
                value={previewText}
                onChange={(e) => setPreviewText(e.target.value)}
                className="w-full h-64 p-3.5 bg-[#0a0c10] border border-[#212631] rounded-xl text-zinc-200 font-mono text-xs leading-relaxed outline-none focus:border-blue-500 resize-none"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-[#212631] bg-[#141722]">
          <span className="text-xs text-zinc-400">
            {references.length} reference tag{references.length !== 1 ? 's' : ''} mapped
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-zinc-400 hover:text-white transition-colors"
            >
              Cancel
            </button>

            <button
              onClick={handleApply}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
            >
              <FileCheck className="w-4 h-4" />
              <span>Apply to Queue &amp; Vault</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
