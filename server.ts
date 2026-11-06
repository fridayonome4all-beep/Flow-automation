import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      service: 'flow-automator-studio',
      version: '2.5.0',
      time: new Date().toISOString()
    });
  });

  // Remote config endpoint for the Chrome extension & applet
  app.get('/api/remote-config', (req, res) => {
    res.json({
      version: '2026.11.2',
      updatedAt: '2026-11-02T09:00:00Z',
      flowUrlPatterns: ['https://labs.google/*', 'https://labs.google/fx/tools/flow*'],
      selectors: {
        promptBox: 'textarea, [contenteditable="true"], [role="textbox"], input[type="text"][placeholder*="prompt" i]',
        submitButtons: 'button[aria-label*="Generate" i], button[aria-label*="Create" i], button[aria-label*="Run" i], button[type="submit"]',
        referenceTrigger: 'button[aria-label*="Reference" i], button[aria-label*="Add image" i], [data-action*="reference"]',
        upscaleButton: 'button[aria-label*="Upscale" i], button:has-text("Upscale"), [data-action="upscale"]',
        resolutionDropdown: '[aria-label*="Resolution" i], [aria-label*="Quality" i], button:has-text("1080p"), button:has-text("4K")',
        videoModeTabs: '[role="tab"][aria-label*="Video" i], [data-mode="video"]',
        startFrameInput: 'input[type="file"][accept*="image"]',
        mediaContainers: 'img, video'
      },
      models: {
        image: ['Nano Banana Pro', 'Nano Banana 2.1', 'Nano Banana Lite', 'Imagen 3 Pro'],
        video: ['Veo 3.1 Quality', 'Veo 3.1 Fast', 'Veo 3.1 Lite']
      },
      resolutions: ['720p', '1080p', '2K', '4K'],
      videoModes: [
        { id: 'text', label: 'Text to Video', description: 'Generate strictly from written description' },
        { id: 'start_frame', label: 'Start Frame', description: 'Guide motion starting from an initial keyframe image' },
        { id: 'start_end', label: 'Start + End Frame', description: 'Morph & animate between first and final keyframes' },
        { id: 'reference', label: 'Reference Guided', description: 'Guide motion, subject, or aesthetics from reference media' }
      ],
      refreshWatchdog: {
        defaultStallMinutes: 4,
        recommendedIntervalPrompts: 10
      }
    });
  });

  // Heuristic scanner helper function
  function heuristicScan(rawText: string) {
    const rawPrompts = rawText
      .split(/\n\s*\n/)
      .map(s => s.trim())
      .filter(Boolean);

    const tagRegex = /@([a-zA-Z0-9_\-]+)/g;
    const tagMap = new Map<string, { type: 'subject' | 'scene' | 'style'; count: number; name: string }>();

    rawPrompts.forEach(p => {
      let match;
      while ((match = tagRegex.exec(p)) !== null) {
        const fullTag = '@' + match[1];
        const lower = fullTag.toLowerCase();
        let type: 'subject' | 'scene' | 'style' = 'subject';
        if (lower.includes('scene') || lower.includes('bg') || lower.includes('background') || lower.includes('city') || lower.includes('forest') || lower.includes('room') || lower.includes('planet')) {
          type = 'scene';
        } else if (lower.includes('style') || lower.includes('art') || lower.includes('render') || lower.includes('film') || lower.includes('35mm') || lower.includes('cinematic') || lower.includes('anime')) {
          type = 'style';
        }

        const existing = tagMap.get(fullTag);
        if (existing) {
          existing.count++;
        } else {
          tagMap.set(fullTag, {
            type,
            count: 1,
            name: match[1].replace(/_/g, ' ')
          });
        }
      }
    });

    // Auto-detect common entities if no tags or few tags are present
    const detectedReferences = Array.from(tagMap.entries()).map(([tag, data]) => ({
      tag,
      type: data.type,
      name: data.name,
      count: data.count
    }));

    return {
      detectedReferences,
      taggedPrompts: rawPrompts,
      summary: `Parsed ${rawPrompts.length} prompt(s). Identified ${detectedReferences.length} explicit @reference tag(s).`
    };
  }

  // AI Prompt Scanner & Reference Tagging Endpoint
  app.post('/api/analyze-prompts', async (req, res) => {
    try {
      const { text, autoInjectTags = false } = req.body;
      if (!text || typeof text !== 'string') {
        return res.status(400).json({ error: 'Text content is required' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        const fallback = heuristicScan(text);
        return res.json({
          success: true,
          aiPowered: false,
          fallback: true,
          ...fallback
        });
      }

      const ai = new GoogleGenAI({ apiKey });
      const promptInstructions = `
You are an expert AI prompt engineer and Google Flow automation assistant.
Analyze this batch of image or video generation prompts.

Objectives:
1. Scan the text for all referenced characters/subjects, scene environments, and visual styles.
2. If prompts already have @tag references (like @character1, @cyber_girl, @scene_tokyo), preserve and catalog them.
3. If recurring subjects, scenes, or distinct styles are mentioned without tags, extract them and assign clean tags (e.g., @Subject1, @Subject2, @Scene1, @Style1, or descriptive names like @HeroKnight, @NeonTokyo).
${autoInjectTags ? '4. Rewrite each prompt in "taggedPrompts" to replace or prefix the mentions with the designated @tag, so that image generators can automatically resolve the reference images.' : '4. In "taggedPrompts", provide the prompts with clean standardized tags.'}

Return strictly a JSON object with this exact shape:
{
  "detectedReferences": [
    {
      "tag": "@Subject1",
      "type": "subject", // "subject", "scene", or "style"
      "name": "Human-readable descriptive label",
      "count": 3,
      "description": "Short explanation of what this entity is"
    }
  ],
  "taggedPrompts": [
    "prompt text with @tags"
  ],
  "summary": "Short 1-2 sentence overview of what was identified"
}

Prompts content to analyze:
${text}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: promptInstructions,
        config: {
          responseMimeType: 'application/json'
        }
      });

      const responseText = response.text?.trim() || '{}';
      let parsedAi;
      try {
        parsedAi = JSON.parse(responseText);
      } catch (jsonErr) {
        parsedAi = heuristicScan(text);
      }

      res.json({
        success: true,
        aiPowered: true,
        ...parsedAi
      });
    } catch (err: any) {
      console.warn('AI analysis failed, falling back to heuristic:', err?.message || err);
      const fallback = heuristicScan(req.body?.text || '');
      res.json({
        success: true,
        aiPowered: false,
        fallback: true,
        ...fallback
      });
    }
  });

  // In production serve dist, in dev mount Vite middleware
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Flow Automator running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
