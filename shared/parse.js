// Prompt list parser, per-prompt reference tag block parser, slugifier, and tag validator.

export function parsePromptTags(rawText) {
  if (!rawText) return { cleanText: '', tags: null };

  const trimmed = rawText.trim();
  const tagBlockRegex = /^\[(.*?)\]\s*/;
  const match = trimmed.match(tagBlockRegex);

  if (!match) {
    return { cleanText: trimmed, tags: null };
  }

  const tagBlockContent = match[1];
  const cleanText = trimmed.replace(tagBlockRegex, '').trim();

  const tags = {
    subject: [],
    scene: [],
    style: [],
    start: null,
    end: null,
    ref: []
  };

  // Parse comma-separated or semicolon-separated pairs like "subject: kai.png, scene: market.png"
  const parts = tagBlockContent.split(/[,;]\s*/);
  for (const part of parts) {
    const colonIdx = part.indexOf(':');
    if (colonIdx === -1) continue;

    const key = part.slice(0, colonIdx).trim().toLowerCase();
    const rawVal = part.slice(colonIdx + 1).trim();
    if (!rawVal) continue;

    const files = rawVal.split(/\s*,\s*|\s+/).filter(Boolean);

    if (key === 'subject') {
      tags.subject.push(...files);
    } else if (key === 'scene') {
      tags.scene.push(...files);
    } else if (key === 'style') {
      tags.style.push(...files);
    } else if (key === 'start') {
      tags.start = files[0] || null;
    } else if (key === 'end') {
      tags.end = files[0] || null;
    } else if (key === 'ref' || key === 'reference') {
      tags.ref.push(...files);
    }
  }

  return { cleanText, tags };
}

export function parsePrompts(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return { prompts: [], duplicates: 0, total: 0 };
  }

  const rawBlocks = rawText
    .split(/\n\s*\n/)
    .map(block => block.trim())
    .filter(Boolean);

  const seen = new Set();
  let duplicateCount = 0;

  const prompts = rawBlocks.map((block, index) => {
    const { cleanText, tags } = parsePromptTags(block);
    const normalized = cleanText.toLowerCase();
    const isDuplicate = seen.has(normalized);

    if (isDuplicate) {
      duplicateCount++;
    } else {
      seen.add(normalized);
    }

    return {
      id: 'p_' + Date.now() + '_' + index,
      raw: block,
      text: cleanText,
      tags: tags,
      isDuplicate: isDuplicate,
      status: 'idle', // 'idle' | 'running' | 'done' | 'failed' | 'blocked'
      files: [],
      error: null
    };
  });

  return {
    prompts,
    duplicates: duplicateCount,
    total: prompts.length
  };
}

export function slugify(text, maxWords = 5) {
  if (!text) return 'untitled';
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, maxWords)
    .join('-') || 'prompt';
}

export function validatePromptTags(promptItem, libraryFileNames = new Set()) {
  const missing = [];
  if (!promptItem.tags) return { isValid: true, missing };

  const checkList = [
    ...promptItem.tags.subject,
    ...promptItem.tags.scene,
    ...promptItem.tags.style,
    ...(promptItem.tags.start ? [promptItem.tags.start] : []),
    ...(promptItem.tags.end ? [promptItem.tags.end] : []),
    ...promptItem.tags.ref
  ];

  for (const name of checkList) {
    if (!libraryFileNames.has(name.toLowerCase())) {
      missing.push(name);
    }
  }

  return {
    isValid: missing.length === 0,
    missing
  };
}

// Attach to window for classic content scripts
if (typeof window !== 'undefined') {
  window.FlowParse = {
    parsePromptTags,
    parsePrompts,
    slugify,
    validatePromptTags
  };
}
