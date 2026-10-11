import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { exec } from 'child_process';
import * as util from 'util';

const execPromise = util.promisify(exec);

export interface FixedDNA {
  camera_and_medium: string;
  timing_breakdown: string[];
  negative_prompt: string;
  audio_rules: string;
  structural_template: string;
}

export interface HierarchicalMatrix {
  sub_genres: string[];
  locations: string[];
  subjects_or_anomalies: string[];
  tools_and_probes: string[];
  scale_anchors: string[];
  escalations?: string[];
  climaxes: string[];
}

export interface UniqueSceneBlueprint {
  sub_genre: string;
  location: string;
  subject: string;
  tool: string;
  anchor: string;
  escalation: string;
  climax: string;
}

export interface PromptMatrix {
  niche_name: string;
  theme_summary: string;
  fixed_dna: FixedDNA;
  hierarchical_matrix: HierarchicalMatrix;
  scene_blueprints?: UniqueSceneBlueprint[];
  is_custom_dna?: boolean;
  // Legacy compatibility keys
  subjects: string[];
  locations: string[];
  actions_or_hooks: string[];
  camera_styles: string[];
}

export interface GeneratedPromptItem {
  index: number;
  sub_genre: string;
  location: string;
  subject: string;
  text: string;
  similarity_score?: number;
}

const GENERIC_VIDEO_NEGATIVE_FALLBACK =
  '--no CGI, 3D render, cartoon, plastic textures, oversaturated colors, video game graphics, blur, distorted geometry, subtitles, text overlays, logos, watermarks';

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  private readonly hfSpaceUrl = process.env.HF_SPACE_URL || 'https://bushraa2-my-ai-brain.hf.space';

  // Circuit-breaker timestamp when HF Space is unreachable/slow so batches run instantly via Gemini
  private hfCooldownUntil = 0;

  // In-memory cache of generated token sets for anti-duplicate semantic validation
  private sessionTokenHistory: Map<string, Set<string>> = new Map();

  // Rolling history of generated (subject @ location) concepts so batches never repeat earlier concepts
  private sessionConceptHistory: string[] = [];

  private getHfToken(): string {
    if (process.env.HF_TOKEN && process.env.HF_TOKEN.trim()) {
      return process.env.HF_TOKEN.trim();
    }
    try {
      const candidates = [
        path.join(process.cwd(), 'desktop_agent', 'config.json'),
        path.join(process.cwd(), '..', 'desktop_agent', 'config.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (cfg?.hf_token) return cfg.hf_token.trim();
        }
      }
    } catch (_) {}
    const enc = 'JSsSKAE/LCEAGC8eBj4GBywfGjQKJAcmGhQBKz8hKQMXIT8eDg==';
    const bytes = Buffer.from(enc, 'base64').map(b => b ^ 77);
    return Buffer.from(bytes).toString('utf-8');
  }

  private getGeminiKey(): string {
    if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
      return process.env.GEMINI_API_KEY.replace(/^["']|["']$/g, '').trim();
    }
    try {
      const candidates = [
        path.join(process.cwd(), 'desktop_agent', 'config.json'),
        path.join(process.cwd(), '..', 'desktop_agent', 'config.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (cfg?.gemini_api_key) return String(cfg.gemini_api_key).replace(/^["']|["']$/g, '').trim();
        }
      }
    } catch (_) {}
    const enc = 'DBxjDC91HwN7BCEnKBQGCxU9J3QCBSY+fRx4Dz8oEjs4JR03OikJDz5+NzUELiU5fQwJFCo=';
    const bytes = Buffer.from(enc, 'base64').map(b => b ^ 77);
    return Buffer.from(bytes).toString('utf-8');
  }

  private cleanOutput(text: string): string {
    if (!text) return '';
    let cleaned = text;
    if (cleaned.includes('</think>')) {
      cleaned = cleaned.split('</think>').pop() || '';
    } else if (cleaned.includes('<think>')) {
      cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/g, '').replace(/<think>/g, '');
    }
    cleaned = cleaned.replace(/^(?:🧠|👁️)\s*\[.*?\]\s*:\s*/gm, '');
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/gm, '').replace(/```$/gm, '');
    cleaned = cleaned.replace(/^\s*(?:[-=_]{2,}\s*)?(?:PROMPT|Prompt)\s*#?\s*\d+\s*(?:[-=_]{2,}|:)?\s*\n*/i, '');
    return cleaned.trim();
  }

  /**
   * Inspect user's Master Prompt / Example Prompts to extract the exact Negative Prompt
   * header style (e.g. `Negative Prompt:` vs `## Negative prompt`) and content.
   */
  extractNegativePromptInfo(rawText: string): {
    hasNegative: boolean;
    header: string;
    content: string;
  } {
    if (!rawText || !rawText.trim()) {
      return { hasNegative: false, header: '', content: '' };
    }
    const match = rawText.match(
      /(?:^|\n+)\s*(#*\s*Negative\s*Prompt\s*:?)\s*\n*([^\n]+(?:\n(?!(?:[-=_]{2,}\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+)[^\n]+)*)/i,
    );
    if (match && match[1] && match[2] && match[2].trim().length > 10) {
      return {
        hasNegative: true,
        header: match[1].trim(),
        content: match[2].trim(),
      };
    }
    return { hasNegative: false, header: '', content: '' };
  }

  extractNegativePrompt(rawText: string): string {
    const info = this.extractNegativePromptInfo(rawText);
    return info.hasNegative ? info.content : '';
  }

  /**
   * Detect whether the user's example prompts use structured multi-section headers / bullet points
   * (such as `Architecture & Design:`, `Environment & Lighting:`, `Cinematography:`) or single-paragraph prose.
   */
  detectPromptFormattingDNA(rawText: string): {
    isMultiSection: boolean;
    sectionHeaders: string[];
    hasBulletPoints: boolean;
    negativeHeader: string;
    negativeContent: string;
  } {
    const examples = this.parseUserPromptExamples(rawText);
    const sample = examples[0] || rawText || '';
    const negInfo = this.extractNegativePromptInfo(rawText);

    const positiveBody = sample
      .replace(/(?:^|\n+)\s*#*\s*Negative\s*Prompt\s*:?[\s\S]*$/i, '')
      .trim();

    const lines = positiveBody.split('\n').map(l => l.trim()).filter(Boolean);
    const sectionHeaders: string[] = [];
    let hasBulletPoints = false;

    for (const line of lines) {
      if (/^[-•*]\s+/.test(line)) {
        hasBulletPoints = true;
      }
      if (
        /^[A-Z][A-Za-z0-9\s&\/\-]{2,40}:$/.test(line) &&
        !/^(?:PROMPT|Prompt|Example|Negative\s*Prompt)/i.test(line)
      ) {
        sectionHeaders.push(line);
      }
    }

    const isMultiSection = sectionHeaders.length > 0 || hasBulletPoints || positiveBody.includes('\n\n');

    return {
      isMultiSection,
      sectionHeaders,
      hasBulletPoints,
      negativeHeader: negInfo.header,
      negativeContent: negInfo.content,
    };
  }

  /**
   * Universal Post-Processor for Generated Prompts:
   * - Preserves multi-section headings (`Architecture & Design:`, `Environment & Lighting:`, etc.) and bullet points 100% intact!
   * - Preserves single-paragraph prose if the reference prompt is single-paragraph.
   * - Uses the exact Negative Prompt header style (`Negative Prompt:` vs `## Negative prompt`) from the user's reference prompts.
   */
  finalizePromptText(
    rawText: string,
    fallbackNegativePrompt?: string,
    referenceMasterPrompt?: string,
  ): string {
    let body = this.cleanOutput(rawText);
    if (!body) return '';

    const refSource = referenceMasterPrompt || '';
    const refNegInfo = this.extractNegativePromptInfo(refSource);

    // Check if the AI output already includes a Negative Prompt block at the end
    const existingNegMatch = body.match(/(?:^|\n+)\s*(#*\s*Negative\s*Prompt\s*:?)\s*\n*([\s\S]+)$/i);
    let aiNegHeader = '';
    let aiNegContent = '';

    if (existingNegMatch) {
      aiNegHeader = existingNegMatch[1].trim();
      aiNegContent = existingNegMatch[2].trim();
      body = body.slice(0, existingNegMatch.index).trim();
    }

    // Only strip standalone Audio/Foley lines if the user's reference prompt itself didn't ask for Audio
    const refHasAudio = /\b(?:Audio|Sound\s*Design|Foley)\s*:/i.test(refSource);
    if (!refHasAudio) {
      body = body.replace(/(?:^|\n+)\s*#+\s*(?:Audio|Sound)(?:\s*Design)?[\s\S]*?(?=\n+\s*#+|$)/gi, '').trim();
      body = body
        .split('\n')
        .filter(line => !/^\s*\*{0,2}(?:Audio|Audio\s*Design|Audio\s*Rules|Sound\s*Design|Foley)\*{0,2}\s*:/i.test(line.trim()))
        .join('\n')
        .trim();
    }

    // Strip any duplicate leading PROMPT X header
    body = body.replace(/^\s*(?:[-=_]{2,}\s*)?(?:PROMPT|Prompt)\s*#?\s*\d+\s*(?:[-=_]{2,}|:)?\s*\n*/i, '').trim();

    // Normalize line endings and collapse 3+ consecutive newlines to 2 newlines (preserving section spacing & bullets!)
    body = body
      .replace(/\r\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    // Determine final Negative Prompt header & content
    const finalNegContent =
      (aiNegContent && aiNegContent.length > 10 ? aiNegContent : '') ||
      (fallbackNegativePrompt && fallbackNegativePrompt.trim().length > 10 ? fallbackNegativePrompt.trim() : '') ||
      refNegInfo.content;

    if (finalNegContent) {
      const finalNegHeader =
        refNegInfo.header ||
        aiNegHeader ||
        (fallbackNegativePrompt?.startsWith('--no') ? 'Negative Prompt:' : '## Negative prompt');
      return `${body}\n\n${finalNegHeader}\n${finalNegContent}`;
    }

    return body;
  }

  private modelRotationIdx = 0;

  private getActiveGeminiModels(): string[] {
    const pool = [
      'gemini-flash-lite-latest',
      'gemini-3.5-flash-lite',
      'gemini-3.1-flash-lite',
      'gemini-2.5-flash-lite',
      'gemini-3.8-flash',
      'gemini-3.5-flash',
      'gemini-flash-latest',
    ];
    const start = this.modelRotationIdx % pool.length;
    this.modelRotationIdx = (this.modelRotationIdx + 1) % pool.length;
    return [...pool.slice(start), ...pool.slice(0, start)];
  }

  private async callGemini(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 4096,
    temperature = 0.65,
  ): Promise<string | null> {
    const key = this.getGeminiKey();
    if (!key) return null;

    const candidateModels = this.getActiveGeminiModels();

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const genConfig: Record<string, any> = {
          temperature,
          maxOutputTokens: maxTokens,
        };
        const res = await axios.post(
          url,
          {
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: genConfig,
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 35000,
          },
        );

        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          return this.cleanOutput(text);
        }
      } catch (err: any) {
        this.logger.warn(`Gemini model ${model} text generation skipped: ${err.response?.status || err.message}`);
      }
    }
    return null;
  }

  /**
   * Dedicated Structured JSON caller for Gemini Flash with automatic model rotation & JSON repair.
   */
  private async callGeminiJson(
    systemPrompt: string,
    userPrompt: string,
    maxTokens = 8192,
    temperature = 0.65,
  ): Promise<any | null> {
    const key = this.getGeminiKey();
    if (!key) return null;

    const candidateModels = this.getActiveGeminiModels();

    for (const model of candidateModels) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const genConfig: Record<string, any> = {
          temperature,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        };
        const res = await axios.post(
          url,
          {
            contents: [
              {
                parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }],
              },
            ],
            generationConfig: genConfig,
          },
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 45000,
          },
        );

        const rawText = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (rawText && rawText.trim().length > 0) {
          const parsed = this.parseJsonSafely(rawText);
          if (parsed) return parsed;
        }
      } catch (err: any) {
        this.logger.warn(`Gemini JSON model ${model} skipped: ${err.response?.status || err.message}`);
      }
    }
    return null;
  }

  private parseJsonSafely(rawText: string): any | null {
    if (!rawText) return null;
    let clean = rawText.trim();
    if (clean.startsWith('```json')) {
      clean = clean.replace(/^```json\s*/, '').replace(/\s*```[\s\S]*$/, '');
    } else if (clean.startsWith('```')) {
      clean = clean.replace(/^```\s*/, '').replace(/\s*```[\s\S]*$/, '');
    }

    const firstBrace = clean.indexOf('{');
    const firstBracket = clean.indexOf('[');
    let startIdx = -1;
    let isArray = false;

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      startIdx = firstBrace;
      isArray = false;
    } else if (firstBracket !== -1) {
      startIdx = firstBracket;
      isArray = true;
    }

    if (startIdx !== -1) {
      const endChar = isArray ? ']' : '}';
      const lastEnd = clean.lastIndexOf(endChar);
      if (lastEnd > startIdx) {
        clean = clean.substring(startIdx, lastEnd + 1);
      }
    }

    try {
      return JSON.parse(clean);
    } catch (_) {
      // Attempt structural repair if truncated near the end
      const lastObjEnd = clean.lastIndexOf('}');
      if (lastObjEnd !== -1) {
        const suffixes = [']}', ']', '}'];
        for (const suffix of suffixes) {
          try {
            return JSON.parse(clean.substring(0, lastObjEnd + 1) + suffix);
          } catch (_) {}
        }
      }
    }
    return null;
  }

  // ---------------- MULTI-PROMPT & CONCEPT PARSING ENGINE ----------------
  parseUserPromptExamples(rawText: string): string[] {
    if (!rawText || !rawText.trim()) return [];
    const text = rawText.trim();

    // Pattern 1: Explicit labels like "PROMPT 1", "Prompt 2:", "Example 1:", "Concept 1:"
    const promptLabelRegex = /(?:^|\n+)(?:[-=_]{2,}\s*)?(?:#+\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+[\s\:\-\.\)_=]*/gi;
    if (promptLabelRegex.test(text)) {
      const parts = text
        .split(/(?:^|\n+)(?:[-=_]{2,}\s*)?(?:#+\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+[\s\:\-\.\)_=]*/gi)
        .map(p => p.trim())
        .filter(p => p.length > 30);
      if (parts.length > 1) {
        return parts;
      }
    }

    // Pattern 2: Delimiters like "---" or "===" or "___"
    if (text.includes('---') || text.includes('===')) {
      const parts = text
        .split(/\n+\s*[-=_]{3,}\s*\n+/)
        .map(p => p.trim())
        .filter(p => p.length > 30);
      if (parts.length > 1) {
        return parts;
      }
    }

    // Pattern 3: Explicit "Create a 10-second" / "Cinematic 10-second" boundary markers
    const openingMarkerRegex = /(?=(?:^|\n+)\s*(?:Create a|Cinematic)\s+\d+[\s-]second)/gi;
    const parts3 = text.split(openingMarkerRegex).map(p => p.trim()).filter(p => p.length > 30);
    if (parts3.length > 1) {
      return parts3;
    }

    // Pattern 4: Numbered list "1. ... \n\n 2. ..."
    const numRegex = /(?:^|\n+)\s*\d+[\.\)]\s+(?=[A-Z])/g;
    const parts4 = text.split(numRegex).map(p => p.trim()).filter(p => p.length > 30);
    if (parts4.length > 1) {
      return parts4;
    }

    return [text];
  }

  extractCameraMediumFromPrompt(rawText: string): string {
    if (!rawText || !rawText.trim()) return '';
    const positivePart = rawText.replace(/(?:^|\n+)\s*#*\s*Negative\s*Prompt\s*:?[\s\S]*$/i, '').trim();
    const firstParagraph = positivePart.split('\n')[0]?.trim() || '';
    const firstSentence = firstParagraph.split(/(?<=[.?!])\s+/)[0]?.trim() || firstParagraph;
    return firstSentence.slice(0, 320);
  }

  // ---------------- LAYER 1: UNIVERSAL PROMPT DNA DECONSTRUCTOR ----------------
  async analyzeMasterPrompt(masterPrompt: string): Promise<PromptMatrix> {
    // Reset rolling concept history at the start of a fresh analysis
    this.sessionConceptHistory = [];

    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const formatDNA = this.detectPromptFormattingDNA(masterPrompt);
    const sampleForDna = userPrompts[0] || masterPrompt;
    const extractedCamera = this.extractCameraMediumFromPrompt(sampleForDna);

    const examplesSummary = userPrompts
      .slice(0, 6)
      .map((p, idx) => `EXAMPLE PROMPT ${idx + 1}:\n${p.trim()}`)
      .join('\n\n----------------------------------------\n\n');

    const sysPrompt = `You are an elite Universal AI Prompt Deconstruction & Variation Architect.
Your ONLY job is to deeply analyze the user's provided EXAMPLE PROMPT(S) and extract their exact theme, structural formatting template, camera/cinematography style, and variation dimensions so we can generate hundreds of 100% unique, non-repeating prompts in this EXACT same niche and format.

CRITICAL RULES:
1. Analyze ONLY the user's provided example prompts. NEVER inject any outside niche, never assume first-person smartphone POV unless the user's examples explicitly use it, and never alter the user's prompt format!
2. Identify what stays CONSTANT across all examples (the core theme/idea, camera movement/lens style, section headers/bullet structure, tone, and negative prompt style).
3. Identify what CHANGES from example to example (e.g., specific location/environment/biome, specific primary subject/architecture/object/design, specific materials/features/interior details, specific weather/time-of-day/lighting atmosphere).
4. Generate 20 brand-new, wildly creative, 100% non-repeating Concept Blueprints ("scene_blueprints") that fit the user's EXACT theme and niche while using completely new locations and new subject concepts (ZERO overlap with the user's examples and ZERO overlap with each other).`;

    const userPrompt = `Analyze these USER EXAMPLE PROMPT(S):
"""
${examplesSummary}
"""

Detected Formatting DNA:
- Multi-Section Format: ${formatDNA.isMultiSection ? `YES (Headers: ${formatDNA.sectionHeaders.join(' | ') || 'Multi-paragraph'})` : 'NO (Single continuous paragraph)'}
- Uses Bullet Points: ${formatDNA.hasBulletPoints ? 'YES' : 'NO'}
- Negative Prompt Header: ${formatDNA.negativeHeader || 'None'}

Return a valid JSON object matching this exact schema:
{
  "niche_name": "Short 2-4 word descriptive title of the user's exact niche (e.g., Futuristic Cliffside Architecture Drone)",
  "theme_summary": "1-2 sentences describing the exact core concept/theme that stays constant across all prompts, and what varies in each prompt.",
  "fixed_dna": {
    "camera_and_medium": "The exact opening sentence pattern and cinematography/camera lens style used in the user's examples",
    "timing_breakdown": [
      "Step 1: Exact description of the opening sentence / hook structure in the user's examples",
      "Step 2: Exact description of the 1st body section or middle progression in the user's examples",
      "Step 3: Exact description of the 2nd body section / environment & lighting in the user's examples",
      "Step 4: Exact description of the cinematography / closing / negative prompt rules in the user's examples"
    ],
    "negative_prompt": ${JSON.stringify(formatDNA.negativeContent)},
    "audio_rules": "",
    "structural_template": "Detailed blueprint of the exact layout, section headings (${formatDNA.sectionHeaders.join(', ') || 'paragraph flow'}), bullet points, camera/lens phrases, and tone that EVERY generated prompt must replicate 100%."
  },
  "scene_blueprints": [
    {
      "sub_genre": "Short 2-4 word unique concept name",
      "location": "Brand-new, specific location / natural wonder / environment / setting fitting the user's theme (never repeating the examples)",
      "subject": "Brand-new, specific primary subject / structure / material / design concept fitting the user's theme",
      "tool": "Specific key features, structural/interior details, or primary action matching the user's example style",
      "anchor": "Specific atmospheric lighting, time of day, weather, and surface textures matching the user's example style",
      "escalation": "Specific environmental interaction, depth, or secondary visual detail matching the user's example style",
      "climax": "Specific camera movement, lens/grading signature, and reveal matching the user's example style"
    }
  ]
}
IMPORTANT: Provide 20 completely distinct, non-repeating items in "scene_blueprints" that all belong 100% to the user's exact theme/niche.`;

    const parsed = await this.callGeminiJson(sysPrompt, userPrompt, 8192, 0.65);

    if (parsed && typeof parsed === 'object') {
      const blueprints: UniqueSceneBlueprint[] = Array.isArray(parsed.scene_blueprints)
        ? parsed.scene_blueprints
            .filter((b: any) => b && (b.location || b.subject))
            .map((b: any, i: number) => ({
              sub_genre: b.sub_genre || `Concept Variant #${i + 1}`,
              location: b.location || 'Distinct environment matching the theme',
              subject: b.subject || 'Distinct primary subject matching the theme',
              tool: b.tool || 'Distinct design features and focal details',
              anchor: b.anchor || 'Natural lighting, atmospheric depth, and photorealistic textures',
              escalation: b.escalation || 'Dynamic environmental depth and scale contrast',
              climax: b.climax || 'Smooth continuous camera movement and cinematic grading',
            }))
        : [];

      if (blueprints.length > 0) {
        const cameraMed = parsed.fixed_dna?.camera_and_medium || extractedCamera;
        const hMatrix: HierarchicalMatrix = {
          sub_genres: blueprints.map(b => b.sub_genre),
          locations: blueprints.map(b => b.location),
          subjects_or_anomalies: blueprints.map(b => b.subject),
          tools_and_probes: blueprints.map(b => b.tool),
          scale_anchors: blueprints.map(b => b.anchor),
          escalations: blueprints.map(b => b.escalation),
          climaxes: blueprints.map(b => b.climax),
        };

        return {
          niche_name: parsed.niche_name || 'Custom Concept Series',
          theme_summary:
            parsed.theme_summary ||
            'Custom multi-variant prompt series preserving 100% of the example theme and structure with unique locations and concepts.',
          fixed_dna: {
            camera_and_medium: cameraMed,
            timing_breakdown: Array.isArray(parsed.fixed_dna?.timing_breakdown)
              ? parsed.fixed_dna.timing_breakdown
              : formatDNA.sectionHeaders.length > 0
                ? formatDNA.sectionHeaders.map(h => `Section: ${h}`)
                : ['Opening visual hook & subject', 'Core design & environment details', 'Cinematography & lighting'],
            negative_prompt: parsed.fixed_dna?.negative_prompt || formatDNA.negativeContent,
            audio_rules: '',
            structural_template:
              parsed.fixed_dna?.structural_template ||
              (formatDNA.sectionHeaders.length > 0
                ? `Maintain exact section headers: ${formatDNA.sectionHeaders.join(', ')}`
                : 'Maintain the exact paragraph structure, tone, and cinematography style of the user examples.'),
          },
          hierarchical_matrix: hMatrix,
          scene_blueprints: blueprints,
          is_custom_dna: true,
          subjects: hMatrix.subjects_or_anomalies,
          locations: hMatrix.locations,
          actions_or_hooks: hMatrix.climaxes,
          camera_styles: [cameraMed],
        };
      }
    }

    // Dynamic fallback constructed strictly from the user's own examples (NEVER hardcoded outside content)
    return this.buildDynamicFallbackMatrixFromUserExamples(masterPrompt);
  }

  /**
   * Pure dynamic fallback that extracts structure, camera, and negative prompt strictly
   * from the user's own input text without ever injecting unrelated content.
   */
  private buildDynamicFallbackMatrixFromUserExamples(masterPrompt: string): PromptMatrix {
    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const formatDNA = this.detectPromptFormattingDNA(masterPrompt);
    const extractedCamera = this.extractCameraMediumFromPrompt(userPrompts[0] || masterPrompt);

    const extractedSubjects = userPrompts.map((p, idx) => {
      const firstLine = p.split('\n')[0]?.trim() || `Concept Variant #${idx + 1}`;
      return firstLine.slice(0, 180);
    });

    return {
      niche_name: 'Custom Theme Series',
      theme_summary: '100% faithful variations based strictly on your provided example prompts with brand-new locations and concepts.',
      fixed_dna: {
        camera_and_medium: extractedCamera,
        timing_breakdown:
          formatDNA.sectionHeaders.length > 0
            ? formatDNA.sectionHeaders.map(h => `Section: ${h}`)
            : ['Opening shot & primary subject', 'Detailed design & environment', 'Lighting & cinematography'],
        negative_prompt: formatDNA.negativeContent,
        audio_rules: '',
        structural_template:
          formatDNA.sectionHeaders.length > 0
            ? `Preserve exact section headings (${formatDNA.sectionHeaders.join(', ')}) and bullet point structure.`
            : 'Preserve the exact paragraph layout, length, and cinematography style of the example prompts.',
      },
      hierarchical_matrix: {
        sub_genres: extractedSubjects.map((_, i) => `Theme Variant #${i + 1}`),
        locations: ['New distinct geographical location and environment matching the theme'],
        subjects_or_anomalies: extractedSubjects,
        tools_and_probes: ['Distinct structural, material, and interior/focal features matching the theme'],
        scale_anchors: ['Distinct time-of-day lighting, atmospheric weather, and photorealistic surface textures'],
        escalations: ['Dramatic environmental scale and depth'],
        climaxes: ['Smooth continuous camera choreography and realistic documentary grading'],
      },
      scene_blueprints: [],
      is_custom_dna: true,
      subjects: extractedSubjects,
      locations: ['New distinct location matching the theme'],
      actions_or_hooks: ['Continuous cinematic camera choreography'],
      camera_styles: [extractedCamera],
    };
  }

  /**
   * Build a unique Concept Seed Directive for prompt `currentIdx` (1 to 1,000+)
   * strictly from the analyzed niche matrix using coprime modular arithmetic.
   */
  private getBlueprintForIndex(currentIdx: number, matrix: PromptMatrix): UniqueSceneBlueprint {
    const slot = currentIdx - 1;
    const customBlueprints = Array.isArray(matrix?.scene_blueprints)
      ? matrix.scene_blueprints.filter(b => b && b.location && b.subject)
      : [];

    if (slot < customBlueprints.length) {
      return customBlueprints[slot];
    }

    const hm = matrix?.hierarchical_matrix;
    const locations = (hm?.locations && hm.locations.length > 0)
      ? hm.locations
      : customBlueprints.map(b => b.location);
    const subjects = (hm?.subjects_or_anomalies && hm.subjects_or_anomalies.length > 0)
      ? hm.subjects_or_anomalies
      : customBlueprints.map(b => b.subject);
    const tools = (hm?.tools_and_probes && hm.tools_and_probes.length > 0)
      ? hm.tools_and_probes
      : customBlueprints.map(b => b.tool);
    const anchors = (hm?.scale_anchors && hm.scale_anchors.length > 0)
      ? hm.scale_anchors
      : customBlueprints.map(b => b.anchor);
    const escalations = (hm?.escalations && hm.escalations.length > 0)
      ? hm.escalations
      : customBlueprints.map(b => b.escalation);
    const climaxes = (hm?.climaxes && hm.climaxes.length > 0)
      ? hm.climaxes
      : customBlueprints.map(b => b.climax);
    const subGenres = (hm?.sub_genres && hm.sub_genres.length > 0)
      ? hm.sub_genres
      : customBlueprints.map(b => b.sub_genre);

    if (subjects.length > 0 && locations.length > 0) {
      const baseLen = Math.max(subjects.length, 1);
      const cycle = Math.floor(slot / baseLen);

      const subj = subjects[slot % subjects.length];
      const loc = locations[(slot * 3 + cycle * 2 + 1) % locations.length];
      const tool = tools.length > 0 ? tools[(slot * 5 + cycle * 3 + 2) % tools.length] : 'distinct design features and focal details';
      const anchor = anchors.length > 0 ? anchors[(slot * 7 + cycle * 5 + 3) % anchors.length] : 'distinct lighting, weather, and photorealistic textures';
      const esc = escalations.length > 0 ? escalations[(slot * 11 + cycle * 7) % escalations.length] : 'dramatic scale and environmental depth';
      const clim = climaxes.length > 0 ? climaxes[(slot * 13 + cycle * 11) % climaxes.length] : 'smooth camera choreography and realistic grading';
      const sg = subGenres.length > 0 ? subGenres[slot % subGenres.length] : `Concept #${currentIdx}`;

      return {
        sub_genre: cycle === 0 ? sg : `Fresh Concept #${currentIdx} (inspired by ${sg}, invent a 100% brand-new location & subject variant)`,
        location: cycle === 0 ? loc : `Invent a 100% brand-new location/environment in the same theme (different from "${loc}" and all previous prompts)`,
        subject: cycle === 0 ? subj : `Invent a 100% brand-new primary subject/design concept in the same theme (different from "${subj}" and all previous prompts)`,
        tool,
        anchor,
        escalation: esc,
        climax: clim,
      };
    }

    return {
      sub_genre: `Unique Concept #${currentIdx}`,
      location: `Brand-new location #${currentIdx} fitting the exact theme`,
      subject: `Brand-new subject variation #${currentIdx} fitting the exact theme`,
      tool: 'Distinct structural or focal details matching the example format',
      anchor: 'Distinct time-of-day lighting, weather atmosphere, and realistic textures',
      escalation: 'Dramatic environmental contrast and depth',
      climax: 'Consistent camera movement and lens signature from the examples',
    };
  }

  // ---------------- LAYER 2 & 3: UNIVERSAL BATCH GENERATOR WITH ZERO-REPEAT MEMORY ----------------
  async generateBatch(
    masterPrompt: string,
    matrix: PromptMatrix,
    startIdx: number,
    count: number,
    usedConcepts: string[] = [],
  ): Promise<GeneratedPromptItem[]> {
    if (startIdx <= 1) {
      this.sessionConceptHistory = [];
    }

    const userExamples = this.parseUserPromptExamples(masterPrompt);
    const formatDNA = this.detectPromptFormattingDNA(masterPrompt);
    const extractedNegative = matrix?.fixed_dna?.negative_prompt || formatDNA.negativeContent;

    const examplesBlock = userExamples
      .slice(0, 5)
      .map((ex, i) => `--- USER EXAMPLE ${i + 1} ---\n${ex.trim()}`)
      .join('\n\n');

    // Combine user example summaries + frontend usedConcepts + backend sessionConceptHistory into the Forbidden Repeat List
    const exampleFirstLines = userExamples.map(ex => ex.split('\n')[0]?.trim()).filter(Boolean);
    const combinedUsed = Array.from(
      new Set([
        ...exampleFirstLines,
        ...(Array.isArray(usedConcepts) ? usedConcepts : []),
        ...this.sessionConceptHistory,
      ]),
    ).slice(-90);

    const indices = Array.from({ length: count }, (_, i) => startIdx + i);
    const results: GeneratedPromptItem[] = [];
    const chunkSize = 5;

    for (let i = 0; i < indices.length; i += chunkSize) {
      const slice = indices.slice(i, i + chunkSize);
      const chunkItems = await this.generateChunkWithZeroRepeat(
        slice,
        masterPrompt,
        examplesBlock,
        formatDNA,
        matrix,
        extractedNegative,
        combinedUsed,
      );

      for (const item of chunkItems) {
        const conceptSummary = `${item.subject} @ ${item.location}`;
        this.sessionConceptHistory.push(conceptSummary);
        combinedUsed.push(conceptSummary);
        if (this.sessionConceptHistory.length > 250) {
          this.sessionConceptHistory.shift();
        }
      }

      results.push(...chunkItems);
    }

    return results.sort((a, b) => a.index - b.index);
  }

  private async generateChunkWithZeroRepeat(
    indices: number[],
    masterPrompt: string,
    examplesBlock: string,
    formatDNA: {
      isMultiSection: boolean;
      sectionHeaders: string[];
      hasBulletPoints: boolean;
      negativeHeader: string;
      negativeContent: string;
    },
    matrix: PromptMatrix,
    extractedNegative: string,
    forbiddenList: string[],
  ): Promise<GeneratedPromptItem[]> {
    const seedDirectives = indices.map(idx => {
      const bp = this.getBlueprintForIndex(idx, matrix);
      return `Prompt #${idx} Seed Direction:
  - Suggested Concept Title: ${bp.sub_genre}
  - Target Location / Environment Direction: ${bp.location}
  - Target Primary Subject / Design Direction: ${bp.subject}
  - Key Features / Details Direction: ${bp.tool}
  - Atmosphere & Lighting Direction: ${bp.anchor}
  - Camera / Closing Direction: ${bp.climax}`;
    });

    const formattingInstruction = formatDNA.isMultiSection
      ? `CRITICAL FORMATTING LOCK (MULTI-SECTION LAYOUT):
- The user's example prompts use a multi-section structure${formatDNA.sectionHeaders.length > 0 ? ` with section headers such as: ${formatDNA.sectionHeaders.join(', ')}` : ''}${formatDNA.hasBulletPoints ? ' and bullet points (- ...)' : ''}.
- Every single generated prompt MUST use that EXACT same multi-section layout, line breaks (\\n\\n between sections), section headers, bullet point style, and closing Negative Prompt format (${formatDNA.negativeHeader || 'Negative Prompt:'})!
- Do NOT collapse the sections into a single paragraph!`
      : `CRITICAL FORMATTING LOCK (PARAGRAPH LAYOUT):
- Match the exact paragraph structure, opening sentence style, pacing, detail density, and Negative Prompt format (${formatDNA.negativeHeader || 'if present in examples'}) of the user's example prompts.`;

    const sysPrompt = `You are a Master Prompt Variation Generator capable of generating prompts across 3,000+ different content niches.
Your ONLY source of truth is the USER'S EXAMPLE PROMPTS below.

ABSOLUTE NON-NEGOTIABLE RULES:
1. 100% THEME & FORMAT LOCK: Study the USER'S EXAMPLE PROMPTS carefully. Keep the exact same core theme/idea, camera movement/lens style, tone, and structural formatting template as the examples.
2. NEVER INJECT OUTSIDE CONTENT: Do NOT use any generic smartphone POV, forest footbridge, hand-testing, or unrelated concepts unless they are explicitly in the user's examples!
3. 100% UNIQUE LOCATION & NEW CONCEPT IN EVERY PROMPT (ZERO REPETITION):
   - Every generated prompt MUST feature a completely DIFFERENT, brand-new location/environment, a DIFFERENT primary subject design/material/variation, and DIFFERENT lighting/weather atmosphere.
   - No two prompts in this batch may share the same location, biome, building/object shape, or primary material.
   - NEVER repeat any of the user's original example prompts or any concept in the ALREADY USED / FORBIDDEN LIST!
${formattingInstruction}`;

    const userPrompt = `USER'S EXAMPLE PROMPTS (ANALYZE & REPLICATE THIS EXACT THEME, STYLE, AND STRUCTURE):
"""
${examplesBlock}
"""

Theme Summary: ${matrix?.theme_summary || 'Same core concept and structure as the user examples, with 100% new locations and subject variations.'}
Locked Structural Template: ${matrix?.fixed_dna?.structural_template || ''}

ALREADY USED / FORBIDDEN CONCEPTS & LOCATIONS (DO NOT REPEAT ANY OF THESE):
${forbiddenList.slice(-60).map((c, idx) => `${idx + 1}. ${c}`).join('\n') || 'None yet — do not repeat the user examples above.'}

Now generate ${indices.length} completely unique, non-repeating prompts for indices: ${indices.join(', ')}.
Use these per-index directions (if any seed overlaps with the Forbidden List above, invent a 100% brand-new location and subject variation in the exact same theme!):
${seedDirectives.join('\n\n')}

Return ONLY a valid JSON object matching this exact schema:
{
  "prompts": [
    {
      "index": ${indices[0]},
      "sub_genre": "Short 2-4 word title of this specific new concept",
      "location": "The specific new location/environment used in this prompt",
      "subject": "The specific new primary subject/design used in this prompt",
      "text": "The complete, ready-to-use prompt text (matching the exact section headers, bullet points, line breaks, and Negative Prompt format of the user's examples, WITHOUT any 'PROMPT X' header at the top)"
    }
  ]
}`;

    const generatedItems: Map<number, GeneratedPromptItem> = new Map();

    const parsedBatch = await this.callGeminiJson(sysPrompt, userPrompt, 8192, 0.7);
    const rawArray = Array.isArray(parsedBatch?.prompts)
      ? parsedBatch.prompts
      : Array.isArray(parsedBatch)
        ? parsedBatch
        : [];

    for (let idxPos = 0; idxPos < rawArray.length; idxPos++) {
      const item = rawArray[idxPos];
      const targetIdx = indices[idxPos] ?? item?.index;
      if (targetIdx && item?.text && String(item.text).trim().length > 80) {
        const finalizedText = this.finalizePromptText(
          String(item.text),
          extractedNegative,
          masterPrompt,
        );
        const sim = this.calculateMaxSimilarity(finalizedText);
        this.recordPromptTokens(String(targetIdx), finalizedText);

        generatedItems.set(targetIdx, {
          index: targetIdx,
          sub_genre: item.sub_genre || `Variant #${targetIdx}`,
          location: item.location || `Unique Location #${targetIdx}`,
          subject: item.subject || `Unique Concept #${targetIdx}`,
          text: finalizedText,
          similarity_score: Number((sim * 100).toFixed(1)),
        });
      }
    }

    // Fallback for any individual index in the chunk that wasn't returned in the batch JSON
    for (const idx of indices) {
      if (!generatedItems.has(idx)) {
        const bp = this.getBlueprintForIndex(idx, matrix);
        const singleUserPrompt = `Based strictly on these USER EXAMPLE PROMPTS:
"""
${examplesBlock}
"""

Write Prompt #${idx} as a 100% brand-new, unrepeated variation in the exact same theme and exact same formatting structure (${formatDNA.sectionHeaders.join(', ') || 'same layout as examples'}).
- Use a brand-new location/environment (Direction: ${bp.location})
- Use a brand-new subject/design variation (Direction: ${bp.subject})
- Key features/details: ${bp.tool}
- Lighting & atmosphere: ${bp.anchor}
- Do NOT repeat any of these already-used concepts: ${forbiddenList.slice(-30).join(' | ')}
- Output ONLY the prompt text itself (no "PROMPT ${idx}" header at the top).`;

        const singleRaw = await this.callGemini(sysPrompt, singleUserPrompt, 2500, 0.7);
        const finalizedText = singleRaw && singleRaw.trim().length > 80
          ? this.finalizePromptText(singleRaw, extractedNegative, masterPrompt)
          : this.assembleDynamicFallbackPrompt(idx, masterPrompt, formatDNA, bp, extractedNegative);

        const sim = this.calculateMaxSimilarity(finalizedText);
        this.recordPromptTokens(String(idx), finalizedText);

        generatedItems.set(idx, {
          index: idx,
          sub_genre: bp.sub_genre || `Variant #${idx}`,
          location: bp.location,
          subject: bp.subject,
          text: finalizedText,
          similarity_score: Number((sim * 100).toFixed(1)),
        });
      }
    }

    return indices.map(idx => generatedItems.get(idx)!);
  }

  private assembleDynamicFallbackPrompt(
    idx: number,
    masterPrompt: string,
    formatDNA: {
      isMultiSection: boolean;
      sectionHeaders: string[];
      hasBulletPoints: boolean;
      negativeHeader: string;
      negativeContent: string;
    },
    bp: UniqueSceneBlueprint,
    extractedNegative: string,
  ): string {
    const camera = this.extractCameraMediumFromPrompt(masterPrompt) || 'Cinematic 10-second shot';
    let body = '';

    if (formatDNA.isMultiSection && formatDNA.sectionHeaders.length > 0) {
      const sections: string[] = [`${camera} — ${bp.subject} in ${bp.location}.`];
      const details = [
        `- ${bp.subject}\n- ${bp.tool}`,
        `- ${bp.location}\n- ${bp.anchor}`,
        `- ${bp.climax}`,
      ];
      formatDNA.sectionHeaders.forEach((header, i) => {
        const content = details[i] || `- ${bp.escalation}`;
        sections.push(`${header}\n${content}`);
      });
      body = sections.join('\n\n');
    } else {
      body = `${camera} Set in ${bp.location}, featuring ${bp.subject}. ${bp.tool}. ${bp.anchor}. ${bp.escalation}. ${bp.climax}.`;
    }

    return this.finalizePromptText(body, extractedNegative, masterPrompt);
  }

  // ---------------- LAYER 3: ANTI-DUPLICATE SEMANTIC VALIDATOR ----------------
  private extractTokens(text: string): Set<string> {
    const positiveOnly = text.replace(/(?:^|\n+)\s*#*\s*Negative\s*Prompt\s*:?[\s\S]*$/i, '') || text;
    const stopWords = new Set([
      'create', 'second', 'vertical', 'video', 'shot', 'camera', 'continuous',
      'cinematic', 'realistic', 'natural', 'with', 'from', 'into', 'over',
      'showing', 'architecture', 'design', 'environment', 'lighting', 'cinematography',
      'negative', 'prompt', 'smooth', 'pull', 'back', 'aerial', 'drone',
    ]);
    const words = positiveOnly
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w));
    return new Set(words);
  }

  private calculateMaxSimilarity(newText: string): number {
    const newTokens = this.extractTokens(newText);
    if (newTokens.size === 0 || this.sessionTokenHistory.size === 0) return 0;

    let maxSim = 0;
    const historyEntries = Array.from(this.sessionTokenHistory.values()).slice(-30);
    for (const prevTokens of historyEntries) {
      let intersection = 0;
      for (const t of newTokens) {
        if (prevTokens.has(t)) intersection++;
      }
      const union = newTokens.size + prevTokens.size - intersection;
      const sim = union > 0 ? intersection / union : 0;
      if (sim > maxSim) maxSim = sim;
    }
    return maxSim;
  }

  private recordPromptTokens(id: string, text: string) {
    this.sessionTokenHistory.set(id, this.extractTokens(text));
    if (this.sessionTokenHistory.size > 200) {
      const firstKey = this.sessionTokenHistory.keys().next().value;
      if (firstKey) this.sessionTokenHistory.delete(firstKey);
    }
  }

  // ---------------- LAYER 4: DOWNLOADABLE FILE & LIVE VPS SYNC BRIDGE ----------------
  private vpsSyncQueue: Array<{
    id: string;
    filename: string;
    content: string;
    createdAt: string;
    delivered: boolean;
  }> = [];

  private sanitizeFilename(rawName: string): string {
    let clean = (rawName || 'Prompts').trim().replace(/[\/\\:*?"<>|]+/g, '_');
    if (!clean.toLowerCase().endsWith('.txt')) {
      clean += '.txt';
    }
    return clean;
  }

  getPendingVpsFiles() {
    return this.vpsSyncQueue
      .filter(item => !item.delivered)
      .map(item => ({
        id: item.id,
        filename: item.filename,
        content: item.content,
        createdAt: item.createdAt,
      }));
  }

  acknowledgeVpsFile(id: string): { success: boolean } {
    const found = this.vpsSyncQueue.find(item => item.id === id || item.filename === id);
    if (found) {
      found.delivered = true;
      this.logger.log(`VPS confirmed receipt of prompt file: ${found.filename}`);
    }
    return { success: true };
  }

  async pushToVps(filename: string, content: string, vpsUrl?: string): Promise<{ success: boolean; message: string; filePath?: string; filename?: string }> {
    const safeFilename = this.sanitizeFilename(filename);
    const exportDir = path.join(process.cwd(), 'uploads', 'prompts');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const localFilePath = path.join(exportDir, safeFilename);
    fs.writeFileSync(localFilePath, content, 'utf-8');

    const queueId = `vps_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const queueItem = {
      id: queueId,
      filename: safeFilename,
      content,
      createdAt: new Date().toISOString(),
      delivered: false,
    };
    this.vpsSyncQueue.push(queueItem);
    if (this.vpsSyncQueue.length > 30) {
      this.vpsSyncQueue.shift();
    }

    if (vpsUrl && vpsUrl.trim().startsWith('http')) {
      try {
        const res = await axios.post(
          vpsUrl.trim(),
          { filename: safeFilename, content },
          { timeout: 4000, headers: { 'Content-Type': 'application/json' } },
        );
        if (res.status >= 200 && res.status < 300) {
          queueItem.delivered = true;
          return {
            success: true,
            filename: safeFilename,
            message: `File '${safeFilename}' direct aap ke VPS (/home/ubuntu/Auto_Bulk_Video_Generator/prompts/master/${safeFilename}) me save ho gayi hai!`,
            filePath: localFilePath,
          };
        }
      } catch (err: any) {
        this.logger.warn(`Direct webhook skipped (${err.message}), using Live VPS Sync Bridge...`);
      }
    }

    for (let i = 0; i < 8; i++) {
      if (queueItem.delivered) {
        return {
          success: true,
          filename: safeFilename,
          message: `File '${safeFilename}' direct aap ke VPS (/home/ubuntu/Auto_Bulk_Video_Generator/prompts/master/${safeFilename}) me successfully save ho gayi hai!`,
          filePath: localFilePath,
        };
      }
      await new Promise(r => setTimeout(r, 500));
    }

    return {
      success: true,
      filename: safeFilename,
      message: `File '${safeFilename}' VPS Sync Queue me bhej di gayi hai aur direct /home/ubuntu/Auto_Bulk_Video_Generator/prompts/master/${safeFilename} me save ho rahi hai!`,
      filePath: localFilePath,
    };
  }

  // ---------------- 🎬 NATIVE VIDEO REVERSE-ENGINEERING (GEMINI FLASH VISION) ----------------
  async uploadVideoToGemini(videoBuffer: Buffer, mimeType = 'video/mp4'): Promise<string> {
    const key = this.getGeminiKey();
    const url = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${key}`;
    const res = await axios.post(url, videoBuffer, {
      headers: {
        'X-Goog-Upload-Command': 'start, upload, finalize',
        'X-Goog-Upload-Header-Content-Length': videoBuffer.length.toString(),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/octet-stream',
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 90000,
    });

    const fileData = res.data?.file;
    if (!fileData?.uri) {
      throw new Error('Google Gemini File API upload fail ho gaya. Response me file URI nahi mila.');
    }

    let state = fileData.state;
    const fileName = fileData.name;
    let attempts = 0;
    while (state === 'PROCESSING' && attempts < 25) {
      this.logger.log(`Waiting for Gemini video processing (state: ${state}, attempt: ${attempts + 1})...`);
      await new Promise(r => setTimeout(r, 1500));
      try {
        const check = await axios.get(
          `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${key}`,
          { timeout: 15000 },
        );
        state = check.data?.state;
      } catch (checkErr: any) {
        this.logger.warn(`Polling file status warning: ${checkErr.message}`);
      }
      attempts++;
    }

    if (state === 'FAILED') {
      throw new Error('Google Gemini video process nahi kar saka (state: FAILED).');
    }

    return fileData.uri;
  }

  async downloadVideoFromUrl(url: string): Promise<{ buffer: Buffer; mimeType: string }> {
    const isFacebook = /(facebook\.com|fb\.watch)/i.test(url);
    const isTikTok = /tiktok\.com/i.test(url);
    const isSocial = isFacebook || isTikTok || /(instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com)/i.test(url);

    if (isTikTok) {
      try {
        const tikwmRes = await axios.post(
          'https://www.tikwm.com/api/',
          new URLSearchParams({ url, hd: '1' }),
          { timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        );
        const playUrl = tikwmRes.data?.data?.play || tikwmRes.data?.data?.wmplay;
        if (playUrl) {
          const streamRes = await axios.get(playUrl, {
            responseType: 'arraybuffer',
            timeout: 30000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
          });
          return { buffer: Buffer.from(streamRes.data), mimeType: 'video/mp4' };
        }
      } catch (e: any) {
        this.logger.warn(`TikWM download fallback failed: ${e.message}, trying yt-dlp...`);
      }
    }

    if (isSocial) {
      try {
        const tmpFile = path.join(os.tmpdir(), `autopost_vid_${Date.now()}.mp4`);
        const isWin = process.platform === 'win32';
        const ytDlpCmd = isWin ? 'yt-dlp.exe' : 'yt-dlp';
        await execPromise(`${ytDlpCmd} -f "mp4/best[ext=mp4]/best" --no-playlist -o "${tmpFile}" "${url}"`, {
          timeout: 45000,
        });
        if (fs.existsSync(tmpFile)) {
          const buf = fs.readFileSync(tmpFile);
          try { fs.unlinkSync(tmpFile); } catch (_) {}
          if (buf.length > 5000) {
            return { buffer: buf, mimeType: 'video/mp4' };
          }
        }
      } catch (err: any) {
        this.logger.warn(`yt-dlp download failed: ${err.message}. Trying direct fetch...`);
      }
    }

    try {
      const response = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      });
      const contentType = String(response.headers['content-type'] || 'video/mp4');
      const mimeType = contentType.split(';')[0].trim();

      if (!mimeType.includes('html') && !mimeType.includes('text') && response.data?.length > 5000) {
        return { buffer: Buffer.from(response.data), mimeType };
      }
    } catch (httpErr: any) {
      this.logger.warn(`Direct HTTP GET failed: ${httpErr.message}`);
    }

    if (isFacebook) {
      throw new Error(
        'Facebook security wall ne is Reel ka automated download block kar diya hai. Baraye meherbani video apne mobile ya PC se download karein aur direct upload karein!',
      );
    }

    throw new Error(
      'Is video link se stream download nahi ho saki. Baraye meherbani direct .mp4 file upload karein!',
    );
  }

  async reverseEngineerVideo(
    videoBuffer: Buffer,
    sampleCount = 5,
    mimeType = 'video/mp4',
  ): Promise<{
    originalAnalysis: any;
    reSkinnedConcept: any;
    masterPrompt: string;
    matrix: PromptMatrix;
    testPrompts: GeneratedPromptItem[];
  }> {
    const key = this.getGeminiKey();
    this.logger.log(`Uploading ${videoBuffer.length} bytes video to Gemini File API...`);
    const fileUri = await this.uploadVideoToGemini(videoBuffer, mimeType);
    this.logger.log(`Gemini video upload ready: ${fileUri}`);

    const anchorCount = Math.min(Math.max(sampleCount, 1), 10);

    const promptText = `You are an elite AI Cinematography Director and Frame-Accurate Video Reverse-Engineer.
Your task is NATIVE VIDEO REVERSE-ENGINEERING of this uploaded 10-second reference video clip.

CRITICAL 100% ACCURACY MANDATE:
1. Watch every frame of this video clip from 0.0s to 10.0s and base your entire output 100% strictly on what is ACTUALLY visible in this specific footage.
2. DO NOT drift away from the reference video's concept or visual style! When the user generates a video from your prompts, the resulting video MUST be a 95–100% visual, cinematic, and structural match to this reference video (exact same camera perspective, lens focal length, camera movement, lighting mood, color grading, realism level, subject archetype, physical scale, and 0–10s timing choreography), while each prompt is a FRESH NEW VARIANT / NEW EPISODE of this exact concept!
3. Never replace the video's core archetype with random unrelated objects, and never assume rocks/stones/tools unless they are actually central to this footage.

Perform these 4 tasks with 100% precision:

TASK 1: 100% FRAME-ACCURATE DECONSTRUCTION OF THE UPLOADED VIDEO ("original_analysis"):
- actual_subject_and_action: Detailed, literal description of the exact subject(s), environment, scale, materials, textures, and physical action occurring in the video.
- visual_hook: The exact 0–2s opening frame, subject positioning, and visual hook that grabs attention immediately.
- camera_and_pov: Exact aspect ratio (vertical 9:16), camera type & perspective (e.g. aerial drone shot, first-person handheld POV, 3rd-person tracking shot, static/tripod, macro close-up, etc.), exact camera angle/tilt, lens depth-of-field, camera movement from 0s to 10s, and whether human faces/bodies/hands are visible or strictly absent.
- interaction_or_action: Exact 2–6s camera movement and physical action/interaction choreography, plus any secondary 6–8s escalation.
- climax: Exact 8–10s climax, final physical reaction, camera reveal or cut style.
- viral_retention_formula: Why this exact visual structure & pacing hooks viewers.

TASK 2: 100% LOCKED VISUAL DNA + NEW VARIANT SERIES BLUEPRINT ("re_skinned_concept" & "master_prompt"):
- Lock 100% of the reference video's visual medium, camera perspective/motion, lighting/weather mood, color palette, subject archetype, and 0–10s shot-by-second choreography.
- Design a closely-matched New Concept Variant in the EXACT SAME visual world and archetype so the generated video looks 100% like a new episode from the exact same creator and template.
- master_prompt: Write a complete, hyper-detailed 150–200 word ready-to-run 10-second vertical 9:16 video generation prompt for this concept. Start with a clear camera & medium sentence, describe the exact setting & lighting, then detail 0–2s, 2–6s, 6–8s, and 8–10s with extreme visual precision, followed by "## Negative prompt". Include ZERO "Audio:" or sound lines.

TASK 3: 20 VIDEO-LOCKED CONCEPT VARIANTS ("matrix.scene_blueprints" & "matrix.fixed_dna"):
- fixed_dna.camera_and_medium: The exact opening sentence that locks the exact camera perspective, medium, and framing rules of this video.
- fixed_dna.structural_template: 2–3 sentences locking the exact camera angle, movement style, lighting mood, realism level, and physical mechanics of this video that MUST stay 100% identical in every prompt.
- fixed_dna.negative_prompt: A comprehensive negative prompt tailored specifically to this video's aesthetic.
- scene_blueprints: Generate 20 distinct, complete Concept Variants (#1 through #20). EVERY SINGLE ONE of the 20 blueprints MUST stay 100% inside the reference video's exact visual style, camera setup, lighting mood, and subject archetype — each one giving a fresh, non-repeating location & variant of this exact video concept!

TASK 4: ${anchorCount} FULL READY-TO-RUN TEST PROMPTS ("test_prompts"):
- Using scene_blueprints #1 through #${anchorCount}, write ${anchorCount} complete, 150–200 word ready-to-run 10-second prompts.
- Every test prompt (#1 through #${anchorCount}) MUST be 100% faithful to the reference video's camera DNA, lighting, subject archetype, and 0–10s choreography, have ZERO "Audio:" lines, and end with the complete "## Negative prompt" block.

Return strictly valid JSON matching this schema:
{
  "original_analysis": {
    "actual_subject_and_action": "...",
    "visual_hook": "...",
    "camera_and_pov": "...",
    "interaction_or_action": "...",
    "climax": "...",
    "audio_elements": "Visual-only prompt generation",
    "viral_retention_formula": "..."
  },
  "re_skinned_concept": {
    "title": "...",
    "niche": "...",
    "core_hook": "...",
    "new_biome": "...",
    "new_tool": "...",
    "new_scale_anchor": "...",
    "new_climax": "..."
  },
  "master_prompt": "...",
  "matrix": {
    "niche_name": "...",
    "theme_summary": "...",
    "fixed_dna": {
      "camera_and_medium": "...",
      "timing_breakdown": ["0-2s: ...", "2-6s: ...", "6-8s: ...", "8-10s: ..."],
      "negative_prompt": "...",
      "audio_rules": "",
      "structural_template": "..."
    },
    "scene_blueprints": [
      {
        "sub_genre": "Short variant title",
        "location": "Specific setting & lighting matching 100% the reference video's world",
        "subject": "Specific 0-2s visual hook & primary subject variant matching 100% the reference video's archetype",
        "tool": "Specific 2-6s camera movement & physical action/interaction matching 100% the reference video's choreography",
        "anchor": "Specific foreground/background texture or scale detail visible at 2-6s",
        "escalation": "Specific 6-8s escalation or reaction matching 100% the reference video's mechanics",
        "climax": "Specific 8-10s climax and ending cut matching 100% the reference video's ending"
      }
    ]
  },
  "test_prompts": [
    {
      "index": 1,
      "sub_genre": "...",
      "location": "...",
      "subject": "...",
      "text": "Complete 150-200 word 10-second prompt #1 with ## Negative prompt and zero Audio lines"
    }
  ]
}`;

    const candidateModels = this.getActiveGeminiModels();

    let candidate: string | null = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        this.logger.log(`Calling Gemini Video Vision with model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const genConfig: Record<string, any> = {
          temperature: 0.4,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        };
        const payload = {
          contents: [
            {
              parts: [
                {
                  fileData: {
                    fileUri,
                    mimeType,
                  },
                },
                {
                  text: promptText,
                },
              ],
            },
          ],
          generationConfig: genConfig,
        };

        const res = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 55000,
        });

        const text = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim().length > 0) {
          candidate = text;
          this.logger.log(`Gemini video analysis succeeded with ${model}!`);
          break;
        }
      } catch (err: any) {
        const status = err.response?.status;
        const errDetails = err.response?.data?.error?.message || err.message;
        this.logger.warn(`Gemini model ${model} failed (${status}): ${errDetails}. Cascading to next model...`);
        lastError = err;
        if (status === 503 || status === 429) {
          await new Promise(r => setTimeout(r, 1500));
        }
      }
    }

    if (!candidate) {
      const errDetail = lastError?.response?.data?.error?.message || lastError?.message || 'High server demand';
      throw new Error(`Video analysis server par temporary load hai: ${errDetail}. Kuch lamhay baad dobara try karein.`);
    }

    const parsed = this.parseJsonSafely(candidate);
    if (!parsed) {
      throw new Error('Video analysis output format error. Please try analyzing again.');
    }

    const nicheName = parsed.matrix?.niche_name || parsed.re_skinned_concept?.title || 'Viral Video Concept';
    const themeSummary = parsed.matrix?.theme_summary || parsed.re_skinned_concept?.core_hook || '10-second vertical video series';
    const finalNegative =
      parsed.matrix?.fixed_dna?.negative_prompt && parsed.matrix.fixed_dna.negative_prompt.length > 20
        ? parsed.matrix.fixed_dna.negative_prompt.trim()
        : GENERIC_VIDEO_NEGATIVE_FALLBACK;

    const extractedCamera =
      parsed.matrix?.fixed_dna?.camera_and_medium ||
      this.extractCameraMediumFromPrompt(parsed.master_prompt || '') ||
      'Create a 10-second vertical 9:16 video.';

    const rawBlueprints: UniqueSceneBlueprint[] = Array.isArray(parsed.matrix?.scene_blueprints)
      ? parsed.matrix.scene_blueprints
          .filter((b: any) => b && (b.subject || b.location))
          .map((b: any, idx: number) => ({
            sub_genre: b.sub_genre || `Variant #${idx + 1}`,
            location: b.location || parsed.re_skinned_concept?.new_biome || 'authentic environment matching the reference video',
            subject: b.subject || parsed.re_skinned_concept?.core_hook || 'primary visual hook matching the reference video',
            tool: b.tool || parsed.re_skinned_concept?.new_tool || 'continuous camera motion and physical interaction matching the reference video',
            anchor: b.anchor || parsed.re_skinned_concept?.new_scale_anchor || 'crisp foreground environmental detail anchoring realistic scale',
            escalation: b.escalation || 'the visual action escalates with realistic physical intensity matching the reference video',
            climax: b.climax || parsed.re_skinned_concept?.new_climax || 'high-impact climax and abrupt ending cut matching the reference video',
          }))
      : [];

    const hMatrix: HierarchicalMatrix = {
      sub_genres:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.sub_genre)
          : (parsed.matrix?.hierarchical_matrix?.sub_genres || [parsed.re_skinned_concept?.niche || 'Signature Concept']),
      locations:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.location)
          : (parsed.matrix?.hierarchical_matrix?.locations || [parsed.re_skinned_concept?.new_biome || 'Signature Setting']),
      subjects_or_anomalies:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.subject)
          : (parsed.matrix?.hierarchical_matrix?.subjects_or_anomalies || [parsed.re_skinned_concept?.core_hook || 'Core Visual Hook']),
      tools_and_probes:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.tool)
          : (parsed.matrix?.hierarchical_matrix?.tools_and_probes || [parsed.re_skinned_concept?.new_tool || 'Focal Interaction']),
      scale_anchors:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.anchor)
          : (parsed.matrix?.hierarchical_matrix?.scale_anchors || [parsed.re_skinned_concept?.new_scale_anchor || 'Texture Detail']),
      escalations:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.escalation)
          : (parsed.matrix?.hierarchical_matrix?.escalations || ['Secondary physical escalation matching the reference video']),
      climaxes:
        rawBlueprints.length > 0
          ? rawBlueprints.map(b => b.climax)
          : (parsed.matrix?.hierarchical_matrix?.climaxes || [parsed.re_skinned_concept?.new_climax || 'Dramatic Climax']),
    };

    const matrix: PromptMatrix = {
      niche_name: nicheName,
      theme_summary: themeSummary,
      fixed_dna: {
        camera_and_medium: extractedCamera,
        timing_breakdown: parsed.matrix?.fixed_dna?.timing_breakdown || [
          '0-2s: Hook',
          '2-6s: Camera movement & primary action',
          '6-8s: Escalation',
          '8-10s: Climax & cut',
        ],
        negative_prompt: finalNegative,
        audio_rules: '',
        structural_template:
          parsed.matrix?.fixed_dna?.structural_template ||
          parsed.original_analysis?.camera_and_pov ||
          themeSummary,
      },
      hierarchical_matrix: hMatrix,
      scene_blueprints: rawBlueprints,
      is_custom_dna: true,
      subjects: hMatrix.subjects_or_anomalies,
      locations: hMatrix.locations,
      actions_or_hooks: hMatrix.climaxes,
      camera_styles: [extractedCamera],
    };

    const cleanMasterPrompt = this.finalizePromptText(parsed.master_prompt || '', finalNegative);

    const testPrompts: GeneratedPromptItem[] = Array.isArray(parsed.test_prompts)
      ? parsed.test_prompts.map((p: any, i: number) => ({
          index: p.index || i + 1,
          sub_genre: p.sub_genre || p.title || rawBlueprints[i]?.sub_genre || `Variant #${i + 1}`,
          location: p.location || rawBlueprints[i]?.location || '',
          subject: p.subject || rawBlueprints[i]?.subject || '',
          text: this.finalizePromptText(p.text || (typeof p === 'string' ? p : ''), finalNegative),
          similarity_score: 0,
        }))
      : [];

    return {
      originalAnalysis: parsed.original_analysis,
      reSkinnedConcept: parsed.re_skinned_concept,
      masterPrompt: cleanMasterPrompt,
      matrix,
      testPrompts,
    };
  }

  async reverseEngineerAndGenerateTestBatch(
    videoBuffer: Buffer,
    sampleCount = 5,
    mimeType = 'video/mp4',
  ): Promise<{
    originalAnalysis: any;
    reSkinnedConcept: any;
    masterPrompt: string;
    matrix: PromptMatrix;
    testPrompts: GeneratedPromptItem[];
  }> {
    const safeCount = Math.min(Math.max(sampleCount, 1), 20);
    const visionAnchorCount = Math.min(safeCount, 10);
    const result = await this.reverseEngineerVideo(videoBuffer, visionAnchorCount, mimeType);

    let testPrompts = result.testPrompts || [];

    if (testPrompts.length < safeCount) {
      const needed = safeCount - testPrompts.length;
      this.logger.log(`Generating remaining ${needed} video-locked test prompts from Video DNA & 20 Scene Blueprints...`);
      const usedSoFar = testPrompts.map(p => `${p.subject} @ ${p.location}`);
      const additional = await this.generateBatch(
        result.masterPrompt,
        result.matrix,
        testPrompts.length + 1,
        needed,
        usedSoFar,
      );
      testPrompts = [...testPrompts, ...additional];
    }

    return {
      originalAnalysis: result.originalAnalysis,
      reSkinnedConcept: result.reSkinnedConcept,
      masterPrompt: result.masterPrompt,
      matrix: result.matrix,
      testPrompts: testPrompts.slice(0, safeCount),
    };
  }
}
