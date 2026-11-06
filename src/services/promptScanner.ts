import { 
  DetectedReference, 
  ReferenceCategory, 
  ReferenceImageSlot, 
  SuggestedAssignment, 
  PromptItem 
} from '../types';

export interface ScanResult {
  detectedReferences: DetectedReference[];
  suggestedAssignments: SuggestedAssignment[];
  taggedPrompts: string[];
  summary: string;
  aiPowered: boolean;
}

/**
 * Automatically splits and formats raw prompt text with blank lines
 * even if the user pasted them without blank lines.
 */
export function autoFormatAndSplitPrompts(rawText: string): string[] {
  if (!rawText.trim()) return [];

  // First check if already separated by blank lines
  const standardBlocks = rawText
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  // If there are already multiple blank-line separated blocks, return them
  if (standardBlocks.length > 1) {
    return standardBlocks;
  }

  // Otherwise, inspect line by line for ID prefixes (e.g. "24-00", "1-23", "001:", "[ID: ...]")
  const lines = rawText.split('\n');
  const detectedBlocks: string[] = [];
  let currentBlock: string[] = [];

  const idLineRegex = /^\s*(?:(?:\d{1,4}\.\s+)?\d{1,4}[-:\.]\d{1,4}(?:\s+|$)|\[ID:[^\]]+\]|\d{1,4}[\.\:]\s+|[A-Za-z0-9_\-]+[:\-]\s+)/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (currentBlock.length > 0) {
        detectedBlocks.push(currentBlock.join('\n'));
        currentBlock = [];
      }
      continue;
    }

    if (idLineRegex.test(trimmed) && currentBlock.length > 0) {
      detectedBlocks.push(currentBlock.join('\n'));
      currentBlock = [trimmed];
    } else {
      currentBlock.push(trimmed);
    }
  }

  if (currentBlock.length > 0) {
    detectedBlocks.push(currentBlock.join('\n'));
  }

  return detectedBlocks.length > 0 ? detectedBlocks : standardBlocks;
}

/**
 * Extracts prompt ID and clean text from each block.
 * Recognizes patterns like "24-00 16:9...", "1-23...", "IMG-001: prompt", "[ID: 1042] prompt", or assigns index "001".
 */
export function parsePromptLineToItem(block: string, index: number): PromptItem {
  const trimmed = block.trim();
  let hasEmbeddedId = false;
  let customId = String(index + 1).padStart(3, '0');
  let body = trimmed;

  // Pattern 1: [ID: XXX] or [id: XXX]
  const bracketIdMatch = trimmed.match(/^\[ID:\s*([a-zA-Z0-9_\-]+)\]\s*/i);
  if (bracketIdMatch) {
    customId = bracketIdMatch[1];
    hasEmbeddedId = true;
    body = trimmed.replace(bracketIdMatch[0], '').trim();
  } else {
    // Pattern 2: Timecode/hyphen ID e.g. "24-00", "24-05", "1-23" or with sequence number "13. 19-23 Wide"
    const numberedTimecodeMatch = trimmed.match(/^(?:\d{1,4}\.\s+)?(\d{1,4}[-:\.]\d{1,4})\s*[:\-\.]?\s+/);
    if (numberedTimecodeMatch) {
      customId = numberedTimecodeMatch[1];
      hasEmbeddedId = true;
      body = trimmed.slice(numberedTimecodeMatch[0].length).trim();
    } else {
      // Pattern 3: Standard prefix e.g. "IMG-001:", "001 - ", or "1. prompt"
      const prefixMatch = trimmed.match(/^([a-zA-Z0-9_\-]+)\s*[:\-\.]\s+/);
      if (prefixMatch && prefixMatch[1].length <= 15) {
        customId = prefixMatch[1];
        hasEmbeddedId = true;
        body = trimmed.replace(prefixMatch[0], '').trim();
      }
    }
  }

  // Parse @tags in body
  const tagRegex = /@([a-zA-Z0-9_\-]+)/g;
  const tags: PromptItem['tags'] = {
    subject: [],
    scene: [],
    style: [],
    ref: []
  };

  let m;
  while ((m = tagRegex.exec(body)) !== null) {
    const fullTag = '@' + m[1];
    const lower = fullTag.toLowerCase();
    if (lower.includes('scene') || lower.includes('bg') || lower.includes('city') || lower.includes('loc')) {
      tags.scene.push(fullTag);
    } else if (lower.includes('style') || lower.includes('art') || lower.includes('film') || lower.includes('35mm')) {
      tags.style.push(fullTag);
    } else {
      tags.subject.push(fullTag);
    }
  }

  return {
    id: 'p-' + Date.now() + '-' + index,
    customId,
    hasEmbeddedId,
    raw: trimmed,
    text: body,
    tags,
    status: 'idle',
    files: []
  };
}

/**
 * Analyzes prompt timeline for recurring character cast & locations.
 * Detects names and key entities that appear in 2 or more prompts across the timeline.
 */
export function analyzeTimelineForRecurringCast(
  rawText: string,
  existingSlots: ReferenceImageSlot[] = []
): {
  recurringEntities: { name: string; count: number; suggestedType: ReferenceCategory; autoTag: string }[];
  suggestedUpdatedText: string;
} {
  const prompts = rawText
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  if (prompts.length < 2) {
    return { recurringEntities: [], suggestedUpdatedText: rawText };
  }

  // Tokenize and count entity phrases across separate prompt takes
  const phraseCounts = new Map<string, number>();
  const entityRegex = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g;

  prompts.forEach(p => {
    // Strip existing @tags and ID prefixes before phrase extraction
    const cleanBody = p.replace(/^\[ID:[^\]]+\]\s*/i, '').replace(/^[a-zA-Z0-9_\-]+[:\-]\s+/, '').replace(/@[a-zA-Z0-9_\-]+/g, '');
    const matches = cleanBody.match(entityRegex) || [];
    const uniqueInPrompt = new Set(matches.filter(m => m.length > 2 && !['The', 'And', 'With', 'From', 'In', 'On', 'At', 'By', 'For'].includes(m)));

    uniqueInPrompt.forEach(term => {
      phraseCounts.set(term, (phraseCounts.get(term) || 0) + 1);
    });
  });

  const recurringEntities: { name: string; count: number; suggestedType: ReferenceCategory; autoTag: string }[] = [];
  let subjectIndex = 1;
  let sceneIndex = 1;
  let styleIndex = 1;

  phraseCounts.forEach((count, name) => {
    if (count >= 2) {
      const lower = name.toLowerCase();
      let type: ReferenceCategory = 'subject';
      let autoTag = `@subject${subjectIndex++}`;

      if (lower.includes('city') || lower.includes('temple') || lower.includes('forest') || lower.includes('room') || lower.includes('street')) {
        type = 'scene';
        autoTag = `@scene${sceneIndex++}`;
      } else if (lower.includes('style') || lower.includes('cinematic') || lower.includes('anime')) {
        type = 'style';
        autoTag = `@style${styleIndex++}`;
      }

      recurringEntities.push({
        name,
        count,
        suggestedType: type,
        autoTag
      });
    }
  });

  // Generate suggested text pre-tagging recurring entities if not already tagged
  let updated = rawText;
  recurringEntities.forEach(item => {
    const escaped = item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reg = new RegExp(`(?<!@)\\b${escaped}\\b`, 'g');
    updated = updated.replace(reg, item.autoTag);
  });

  return { recurringEntities, suggestedUpdatedText: updated };
}

/**
 * Quick Auto-Tag:
 * Scans prompts and automatically tags occurrences of existing reference labels with their @tag.
 * e.g., if a Subject slot has label "Cyber Samurai" and tag "@subject1", mentions of "cyber samurai" become "@subject1".
 */
export function quickAutoTagWithLabels(
  rawText: string,
  allSlots: ReferenceImageSlot[]
): { updatedText: string; matchedCount: number } {
  let text = rawText;
  let matchedCount = 0;

  // Filter valid slots with custom labels
  const labeledSlots = allSlots.filter(s => 
    s.label && 
    !s.label.match(/^(Subject|Scene|Style)\s+\d+$/i) &&
    s.label.length >= 3
  );

  // Sort longest labels first to avoid partial replacements
  labeledSlots.sort((a, b) => b.label.length - a.label.length);

  labeledSlots.forEach(slot => {
    const escaped = slot.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(?<!@)\\b${escaped}\\b`, 'gi');
    if (regex.test(text)) {
      text = text.replace(regex, () => {
        matchedCount++;
        return slot.tag;
      });
    }
  });

  return { updatedText: text, matchedCount };
}

/**
 * Enhanced Client-side Prompt Scanner
 */
export function scanPromptsClient(
  rawText: string,
  subjectSlots: ReferenceImageSlot[] = [],
  sceneSlots: ReferenceImageSlot[] = [],
  styleSlots: ReferenceImageSlot[] = []
): ScanResult {
  const prompts = rawText
    .split(/\n\s*\n/)
    .map(s => s.trim())
    .filter(Boolean);

  if (prompts.length === 0) {
    return {
      detectedReferences: [],
      suggestedAssignments: [],
      taggedPrompts: [],
      summary: 'No prompts found.',
      aiPowered: false
    };
  }

  const tagRegex = /@([a-zA-Z0-9_\-]+)/g;
  const tagCounts = new Map<string, number>();

  prompts.forEach(prompt => {
    let match;
    const seen = new Set<string>();
    while ((match = tagRegex.exec(prompt)) !== null) {
      const tag = '@' + match[1];
      if (!seen.has(tag)) {
        seen.add(tag);
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }
  });

  const allActiveSlots = [...subjectSlots, ...sceneSlots, ...styleSlots];
  const detected: DetectedReference[] = [];
  const suggested: SuggestedAssignment[] = [];

  tagCounts.forEach((count, tag) => {
    const rawName = tag.replace('@', '');
    const lower = rawName.toLowerCase();

    let type: ReferenceCategory = 'subject';
    if (
      lower.includes('scene') ||
      lower.includes('bg') ||
      lower.includes('background') ||
      lower.includes('city') ||
      lower.includes('room') ||
      lower.includes('exterior')
    ) {
      type = 'scene';
    } else if (
      lower.includes('style') ||
      lower.includes('art') ||
      lower.includes('film') ||
      lower.includes('35mm') ||
      lower.includes('cinematic') ||
      lower.includes('anime')
    ) {
      type = 'style';
    }

    // Check if an image is already linked to this tag
    const existingSlot = allActiveSlots.find(
      s => s.tag.toLowerCase() === tag.toLowerCase() && Boolean(s.imageUrl)
    );

    detected.push({
      tag,
      type,
      name: rawName.replace(/_/g, ' '),
      count,
      hasAssignedImage: Boolean(existingSlot),
      mappedSlotId: existingSlot?.id
    });

    // If no image is assigned, create a suggested assignment
    if (!existingSlot) {
      const targetList = type === 'scene' ? sceneSlots : type === 'style' ? styleSlots : subjectSlots;
      const nextAvailableSlot = targetList.find(s => !s.imageUrl) || targetList[0];

      suggested.push({
        tag,
        type,
        suggestedName: rawName.replace(/_/g, ' '),
        mentionCount: count,
        availableSlotIndex: nextAvailableSlot ? nextAvailableSlot.index : 1,
        targetSlotId: nextAvailableSlot ? nextAvailableSlot.id : `${type}-1`
      });
    }
  });

  return {
    detectedReferences: detected,
    suggestedAssignments: suggested,
    taggedPrompts: prompts,
    summary: `Scanned ${prompts.length} prompt(s). Found ${detected.length} distinct @reference tag(s).`,
    aiPowered: false
  };
}

/**
 * Deep AI Scan (calls server endpoint)
 */
export async function analyzePromptsWithAI(
  rawText: string,
  autoInjectTags: boolean = false
): Promise<ScanResult> {
  try {
    const response = await fetch('/api/analyze-prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: rawText, autoInjectTags })
    });

    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    return {
      detectedReferences: data.detectedReferences || [],
      suggestedAssignments: [],
      taggedPrompts: data.taggedPrompts || rawText.split(/\n\s*\n/).filter(Boolean),
      summary: data.summary || 'Scan complete',
      aiPowered: Boolean(data.aiPowered)
    };
  } catch (err) {
    return scanPromptsClient(rawText);
  }
}

/**
 * Automatically maps references to slots in Subject, Scene, Style
 */
export function autoMapReferencesToSlots(
  references: DetectedReference[],
  subjectSlots: ReferenceImageSlot[],
  sceneSlots: ReferenceImageSlot[],
  styleSlots: ReferenceImageSlot[]
): {
  updatedSubjects: ReferenceImageSlot[];
  updatedScenes: ReferenceImageSlot[];
  updatedStyles: ReferenceImageSlot[];
} {
  const updatedSubjects = [...subjectSlots];
  const updatedScenes = [...sceneSlots];
  const updatedStyles = [...styleSlots];

  references.forEach(ref => {
    let targetList: ReferenceImageSlot[];
    if (ref.type === 'scene') targetList = updatedScenes;
    else if (ref.type === 'style') targetList = updatedStyles;
    else targetList = updatedSubjects;

    const existingIndex = targetList.findIndex(
      s => s.tag.toLowerCase() === ref.tag.toLowerCase()
    );

    if (existingIndex !== -1) {
      targetList[existingIndex] = {
        ...targetList[existingIndex],
        assignedPromptCount: ref.count,
        label: targetList[existingIndex].label || ref.name
      };
    } else {
      const emptyIndex = targetList.findIndex(s => !s.imageUrl);
      if (emptyIndex !== -1) {
        targetList[emptyIndex] = {
          ...targetList[emptyIndex],
          tag: ref.tag,
          label: ref.name,
          assignedPromptCount: ref.count
        };
      }
    }
  });

  return { updatedSubjects, updatedScenes, updatedStyles };
}

export function createInitialSlots(category: ReferenceCategory): ReferenceImageSlot[] {
  return Array.from({ length: 100 }, (_, i) => {
    const num = i + 1;
    return {
      id: `${category}-${num}`,
      index: num,
      category,
      tag: `@${category}${num}`,
      label: `${category.charAt(0).toUpperCase() + category.slice(1)} ${num}`,
      weight: 0.85
    };
  });
}
