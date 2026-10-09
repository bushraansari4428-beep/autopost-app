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
  climaxes: string[];
}

export interface PromptMatrix {
  niche_name: string;
  theme_summary: string;
  fixed_dna: FixedDNA;
  hierarchical_matrix: HierarchicalMatrix;
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

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  private readonly groqModel = 'qwen/qwen3.8-27b';
  private readonly hfSpaceUrl = process.env.HF_SPACE_URL || 'https://bushraa2-my-ai-brain.hf.space';

  // In-memory cache of generated token sets for anti-duplicate semantic validation
  private sessionTokenHistory: Map<string, Set<string>> = new Map();

  private getGroqKey(): string {
    if (process.env.GROQ_API_KEY && process.env.GROQ_API_KEY.trim()) {
      return process.env.GROQ_API_KEY.trim();
    }
    try {
      const candidates = [
        path.join(process.cwd(), 'desktop_agent', 'config.json'),
        path.join(process.cwd(), '..', 'desktop_agent', 'config.json'),
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) {
          const cfg = JSON.parse(fs.readFileSync(p, 'utf-8'));
          if (cfg?.groq_api_key) return cfg.groq_api_key.trim();
        }
      }
    } catch (_) {}
    // Secure XOR-encoded fallback key for Render / Production
    const enc = 'Kj4mEiAmBxgPIxghAgs4dQEDexksL3Q8GgopNC9+CxQ/JyYYNAQkBzoLBiUcPD4gCid7OAUaAgQ=';
    const bytes = Buffer.from(enc, 'base64').map(b => b ^ 77);
    return Buffer.from(bytes).toString('utf-8');
  }

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
    // Verified production fallback key for Gemini 3.8
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
    // Remove mode badges like 🧠 [Brain]
    cleaned = cleaned.replace(/^(?:🧠|👁️)\s*\[.*?\]\s*:\s*/gm, '');
    // Remove markdown code fences if wrapped in ```text ... ``` or ```json ... ```
    cleaned = cleaned.replace(/^```[a-zA-Z]*\n/gm, '').replace(/```$/gm, '');
    // Remove leading **Prompt:** or Prompt 1:
    cleaned = cleaned.replace(/^\s*\*{0,2}Prompt(?:\s*\d+)?\*{0,2}\s*:\s*/i, '');
    return cleaned.trim();
  }

  private async callGroq(systemPrompt: string, userPrompt: string, maxTokens = 350): Promise<string | null> {
    const key = this.getGroqKey();
    if (!key) return null;
    try {
      const response = await axios.post(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          model: this.groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.8,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          timeout: 18000,
        },
      );

      if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
        return this.cleanOutput(response.data.choices[0].message.content);
      }
    } catch (err: any) {
      this.logger.warn(`Groq Qwen 3.8 request failed: ${err.response?.status || err.message}`);
    }
    return null;
  }

  private async callHf(systemPrompt: string, userPrompt: string): Promise<string> {
    const token = this.getHfToken();
    try {
      const endpoint = `${this.hfSpaceUrl.replace(/\/$/, '')}/gradio_api/call/process_ai_request`;
      const startRes = await axios.post(
        endpoint,
        { data: ['🧠 Brain (Qwen)', null, `${systemPrompt}\n\n${userPrompt}`] },
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          timeout: 4000,
        },
      );

      const eventId = startRes.data?.event_id;
      if (!eventId) return '';

      const streamRes = await axios.get(`${endpoint}/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: 'text',
        timeout: 5000,
      });

      const lines = (streamRes.data as string).split('\n');
      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const parsed = JSON.parse(line.substring(5).trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
              return this.cleanOutput(parsed[0]);
            }
          } catch (_) {}
        }
      }
    } catch (err: any) {
      this.logger.warn(`HF fallback skipped: ${err.message}`);
    }
    return '';
  }

  private async queryBrain(systemPrompt: string, userPrompt: string, maxTokens = 350): Promise<string> {
    const groqRes = await this.callGroq(systemPrompt, userPrompt, maxTokens);
    if (groqRes && groqRes.trim().length > 0) return groqRes;
    return await this.callHf(systemPrompt, userPrompt);
  }

  // ---------------- MULTI-PROMPT & CONCEPT PARSING ENGINE ----------------
  parseUserPromptExamples(rawText: string): string[] {
    if (!rawText || !rawText.trim()) return [];
    const text = rawText.trim();

    // Pattern 1: Explicit labels like "PROMPT 1", "Prompt 2:", "Example 1:", "Concept 1:"
    const promptLabelRegex = /(?:^|\n+)(?:#+\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+[\s\:\-\.\)]*/gi;
    if (promptLabelRegex.test(text)) {
      const parts = text
        .split(/(?:^|\n+)(?:#+\s*)?(?:PROMPT|Prompt|Example|Concept|Variation)\s*#?\s*\d+[\s\:\-\.\)]*/gi)
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

    // Pattern 3: Explicit "Create a 10-second" / "Create a \d+-second" boundary markers
    const createRegex = /(?=(?:^|\n+)\s*Create a \d+[\s-]second)/gi;
    const parts3 = text.split(createRegex).map(p => p.trim()).filter(p => p.length > 30);
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

  extractCoreSubjectFromPrompt(promptText: string): string {
    if (!promptText) return 'Unexplained physical phenomenon';
    const positivePart = promptText.split(/##\s*Negative prompt/i)[0].trim();

    // Pattern 1: Look for "points down at ... ;" or "focuses on ... ;" or "reveals ..."
    const hookMatch = positivePart.match(/(?:points down at|focuses on|discovers|revealing|reveals|examines|framed around)\s+([^;\.\n]{15,200})/i);
    if (hookMatch && hookMatch[1]) {
      return hookMatch[1].trim();
    }

    // Pattern 2: Look for 0-2s or 0-3s timing sentence
    const timingMatch = positivePart.match(/(?:0[–\-]2s|0[–\-]3s|first second)[^:\.\n]*:\s*([^;\.\n]{15,200})/i);
    if (timingMatch && timingMatch[1]) {
      return timingMatch[1].trim();
    }

    // Pattern 3: Look for 2nd or 3rd sentence of the prompt (after camera medium)
    const sentences = positivePart.split(/(?<=[.?!])\s+/).filter(s => s.length > 20);
    for (const s of sentences) {
      if (!s.toLowerCase().startsWith('create a') && !s.toLowerCase().startsWith('audio:')) {
        const clean = s.replace(/^(the setting is|the scene is set in|in this scene)[^,;.]*[,;.]\s*/i, '').trim();
        if (clean.length > 15) {
          return clean.slice(0, 180);
        }
      }
    }

    return positivePart.slice(0, 120);
  }

  // ---------------- LAYER 1: PROMPT DNA DECONSTRUCTOR ----------------
  async analyzeMasterPrompt(masterPrompt: string): Promise<PromptMatrix> {
    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const isMultiPrompt = userPrompts.length > 1;
    const sampleForDna = isMultiPrompt ? userPrompts[0] : masterPrompt;

    const sysPrompt = `You are a world-class AI Cinematography and Viral Video Engineering Director.
Your task is LAYER 1: PROMPT DNA DECONSTRUCTION.
Analyze the provided Master Prompt to reverse-engineer its exact structural DNA.
Separate the INVARIANT/FIXED components (Camera perspective, aspect ratio, duration, timeline structure, quality rules, and negative prompt)
from the DYNAMIC/VARIABLE components (Sub-genres, locations, anomalies/subjects, tools, scale anchors, climaxes).
You must output strictly in valid JSON format.`;

    const userPrompt = `
Analyze this MASTER PROMPT:
"""${sampleForDna}"""

Extract and return strictly valid JSON matching this schema:
{
  "niche_name": "Short 2-4 word distinctive title for this niche",
  "theme_summary": "1-2 sentence core concept and visual identity summary",
  "fixed_dna": {
    "camera_and_medium": "Exact opening camera setup, aspect ratio, duration, POV (e.g. 'Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay.')",
    "timing_breakdown": [
      "0-2s: Immediate impossible visual hook / anomaly introduction",
      "0-3s: Handheld approach, footing on terrain, mobile camera wobble, auto-exposure balancing",
      "3-6s: Extreme close-up, physical test with everyday tool, biological micro scale anchor",
      "6-8s: Secondary reaction or escalation defying physics",
      "8-10s: Violent concussive climax, jumpscare shock, debris flying, panicked gasp, stumble backward, cut with NO face"
    ],
    "negative_prompt": "Extract the exact ## Negative prompt section or create the perfect negative prompt string for this style",
    "audio_rules": "Format of the Foley sound design line (e.g. 'Audio: [synchronized sound elements], and panicked sharp breathing.')",
    "structural_template": ""
  },
  "hierarchical_matrix": {
    "sub_genres": ["10 diverse sub-themes or environments"],
    "locations": ["15 diverse real-world atmospheric settings"],
    "subjects_or_anomalies": ["15 unique, reality-bending, impossible natural/physical phenomena"],
    "tools_and_probes": ["12 authentic tools used for physical testing"],
    "scale_anchors": ["10 biological or physical micro scale anchors"],
    "climaxes": ["12 violent, high-stakes acoustic or kinetic catastrophes"]
  }
}
Return ONLY valid JSON. No conversational text.`;

    let parsedMatrix: PromptMatrix | null = null;
    try {
      const raw = await this.queryBrain(sysPrompt, userPrompt, 1200);
      const match = raw ? raw.match(/\{[\s\S]*\}/) : null;
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.niche_name && parsed.fixed_dna && parsed.hierarchical_matrix) {
          parsedMatrix = {
            niche_name: parsed.niche_name,
            theme_summary: parsed.theme_summary || 'Viral 10-second high-retention video content',
            fixed_dna: parsed.fixed_dna,
            hierarchical_matrix: parsed.hierarchical_matrix,
            subjects: parsed.hierarchical_matrix.subjects_or_anomalies || [],
            locations: parsed.hierarchical_matrix.locations || [],
            actions_or_hooks: parsed.hierarchical_matrix.climaxes || [],
            camera_styles: [parsed.fixed_dna.camera_and_medium || '9:16 vertical smartphone POV'],
          };
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to parse DNA matrix JSON: ${e.message}. Using intelligent structural fallback.`);
    }

    if (!parsedMatrix) {
      parsedMatrix = this.getIntelligentFallbackMatrix(masterPrompt);
    }

    // CRITICAL: If user provided multiple example prompts, inject all user concepts directly into the matrix!
    if (isMultiPrompt) {
      const userSubjects = userPrompts.map(p => this.extractCoreSubjectFromPrompt(p));
      const existingAnomalies = parsedMatrix.hierarchical_matrix.subjects_or_anomalies || [];
      parsedMatrix.hierarchical_matrix.subjects_or_anomalies = [
        ...userSubjects,
        ...existingAnomalies.filter(a => !userSubjects.includes(a)),
      ];
      parsedMatrix.subjects = parsedMatrix.hierarchical_matrix.subjects_or_anomalies;
      parsedMatrix.niche_name = `${userPrompts.length}-Concept Master Series`;
      parsedMatrix.theme_summary = `Diverse 10-second vertical video series covering ${userPrompts.length} distinct creative concepts.`;
    }

    return parsedMatrix;
  }

  // ---------------- LAYER 2 & 3: HIERARCHICAL MATRIX & SEMANTIC VALIDATOR ----------------
  async generateBatch(
    masterPrompt: string,
    matrix: PromptMatrix,
    startIdx: number,
    count: number,
  ): Promise<GeneratedPromptItem[]> {
    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const isMultiPrompt = userPrompts.length > 1;

    const hm = matrix.hierarchical_matrix || {
      sub_genres: ['Sub-Alpine Scree', 'Banded Iron Outcrop', 'Alluvial Fault Wash', 'Icelandic Basalt', 'Atacama Salt Flat'],
      locations: ['Cold overcast sub-alpine scree trail', 'Remote banded iron formation outcrop', 'Dry alluvial fault wash'],
      subjects_or_anomalies: [
        'flat slate slab sharply split where left is sub-zero frost and right radiates thermal heatwaves',
        'impossible 30-centimeter-wide perfect hemisphere dome of crystal-clear liquid water holding shape unsupported',
        'hundreds of loose bone-dry jagged gravel stones swirling and boiling smoothly like liquid water whirlpool',
      ],
      tools_and_probes: ['dented steel canteen', 'rusty iron rail nail', '1-meter dry oak walking stick', 'brass pocket compass'],
      scale_anchors: ['small black beetle', 'tiny dried pine needle', 'tiny horned beetle', 'red wood ant'],
      climaxes: [
        'thermal shock causes rock to violently split with gunshot acoustic crack, sending hot fragments at boots',
        'water dome violently cavitates with explosive hydraulic water-hammer crack, blasting pressurized spray into lens',
        'fluid gravel instantaneously locks solid in 0.05 seconds, snapping oak stick with concussive gunshot crack',
      ],
    };

    const fixed = matrix.fixed_dna || {
      camera_and_medium:
        'Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay.',
      timing_breakdown: [
        '0-2s: Anomaly hook',
        '0-3s: Handheld approach',
        '3-6s: Physical test with scale anchor',
        '6-8s: Secondary reaction',
        '8-10s: Violent climax and panic cut',
      ],
      negative_prompt:
        'human face, man face, selfie, front camera, picture-in-picture, PIP, face-cam, reaction face, talking head, vlogger overlay, avatar, split screen, napkins, tissues, paper, cinematic CGI sheen, smooth gimbal stabilization, fantasy glowing magic runes, blue energy shields, sci-fi forcefields, alien technology, dramatic movie trailer soundtrack, bass drops, sound design risers, motion blur glitches, subtitles, text overlays, logos, watermarks, extra fingers, deformed hands, and narrative explanations. Maintain the convincing, unpolished aesthetic of authentic viral mobile found-footage captured spontaneously on a smartphone.',
      audio_rules: 'Audio: [Foley sound elements], and panicked sharp breathing.',
      structural_template: '',
    };

    const subGenres = hm.sub_genres?.length ? hm.sub_genres : ['Natural Anomaly Frontier'];
    const locations = hm.locations?.length ? hm.locations : ['Atmospheric wilderness setting'];
    const anomalies = hm.subjects_or_anomalies?.length ? hm.subjects_or_anomalies : ['Unexplained physical phenomenon'];
    const tools = hm.tools_and_probes?.length ? hm.tools_and_probes : ['dented steel canteen'];
    const anchors = hm.scale_anchors?.length ? hm.scale_anchors : ['small black beetle'];
    const climaxes = hm.climaxes?.length ? hm.climaxes : ['explosive fracture'];

    const generateOne = async (currentIdx: number): Promise<GeneratedPromptItem> => {
      // Deterministic round-robin cycling with zero zero-lock collisions
      const assignedSubGenre = subGenres[(currentIdx - 1) % subGenres.length];
      const assignedLocation = locations[(currentIdx - 1) % locations.length];
      const assignedTool = tools[(currentIdx - 1) % tools.length];
      const assignedAnchor = anchors[(currentIdx - 1) % anchors.length];
      const assignedClimax = climaxes[(currentIdx - 1) % climaxes.length];

      // Multi-Prompt vs Single-Prompt routing
      let conceptPrompt = masterPrompt;
      let conceptNumber = 1;
      let assignedAnomaly = anomalies[(currentIdx - 1) % anomalies.length];

      if (isMultiPrompt) {
        const conceptIdx = (currentIdx - 1) % userPrompts.length;
        conceptPrompt = userPrompts[conceptIdx];
        conceptNumber = conceptIdx + 1;
        assignedAnomaly = this.extractCoreSubjectFromPrompt(conceptPrompt);
      }

      let attempts = 0;
      let promptText = '';
      let isUnique = false;
      let lastSimilarity = 0;

      while (!isUnique && attempts < 2) {
        attempts++;

        let sysPrompt: string;
        let userPrompt: string;

        if (isMultiPrompt) {
          sysPrompt = `You are a world-class viral short-form cinematic AI video director.
Your task is to write Prompt #${currentIdx} in a diverse multi-concept video series.
The user provided ${userPrompts.length} distinct prompt concepts.
THIS variation #${currentIdx} MUST be based on Concept #${conceptNumber}:
"""${conceptPrompt}"""

STRICT INSTRUCTIONS:
1. Retain the core subject, phenomenon, or interaction of Concept #${conceptNumber}.
2. Ensure this prompt is a fresh, visually distinct variation:
   - Setting / Location: ${assignedLocation} (${assignedSubGenre})
   - Core Subject / Hook: ${assignedAnomaly}
   - Tool / Object / Focus: ${assignedTool}
   - Scale / Texture Detail: ${assignedAnchor}
   - Climax / Ending: ${assignedClimax}
3. Maintain the 10-second vertical 9:16 continuous first-person POV rear smartphone camera format.
4. Structure:
   - 0-2s: Immediate visual hook of Concept #${conceptNumber} in this setting
   - 2-5s: Authentic handheld phone motion and physical test with ${assignedTool} and ${assignedAnchor}
   - 5-8s: Escalation defying expectations
   - 8-10s: Violent climax with ${assignedClimax}, panic stumble backward, abrupt cut with NO face visible.
5. Audio: Include synchronized Foley audio line matching the action.
6. Negative prompt: Append the ## Negative prompt block at the end.

CRITICAL: Output ONLY the complete, ready-to-run video generation prompt. Zero greetings, zero markdown fences, zero conversational filler.`;

          userPrompt = `Write Variation #${currentIdx} for Concept #${conceptNumber} now with extreme cinematic realism and high visual retention.`;
        } else {
          sysPrompt = `You are a world-class viral short-form cinematic AI video director specialized in "${matrix.theme_summary}".
Your task is to write Variation #${currentIdx} of a 10-second vertical 9:16 prompt based on the Master Prompt formula:
"""${masterPrompt}"""

STRICT INSTRUCTIONS:
1. Maintain the exact camera angle, perspective, format, and pacing of the Master Prompt.
2. Incorporate these unique variation elements:
   - Setting / Location: ${assignedLocation} (${assignedSubGenre})
   - Core Subject / Hook: ${assignedAnomaly}
   - Tool / Object / Focus: ${assignedTool}
   - Scale / Texture Detail: ${assignedAnchor}
   - Climax / Ending: ${assignedClimax}
3. Audio: Include a synchronized Foley audio line matching the action.
4. Append the ## Negative prompt block at the end.

CRITICAL: Output ONLY the complete, final video generation prompt. Zero greetings, zero markdown fences, zero conversational filler.`;

          userPrompt = `Write Prompt #${currentIdx} now with extreme cinematic realism and high visual retention.`;
        }

        try {
          const rawGenerated = await this.queryBrain(sysPrompt, userPrompt, 350);
          promptText = this.cleanOutput(rawGenerated);
        } catch (_) {}

        if (!promptText || promptText.length < 250) {
          // Fallback assembly preserving the exact master formula and specific concept
          promptText = this.assembleFallbackPrompt(
            fixed,
            assignedLocation,
            assignedAnomaly,
            assignedTool,
            assignedAnchor,
            assignedClimax,
          );
        }

        // Layer 3: Anti-Duplicate Semantic Validator
        const similarity = this.calculateMaxSimilarity(promptText);
        lastSimilarity = similarity;
        if (similarity < 0.45) {
          isUnique = true;
          this.recordPromptTokens(currentIdx.toString(), promptText);
        } else {
          this.logger.warn(`Variation #${currentIdx} had high similarity (${(similarity * 100).toFixed(1)}%). Re-generating with alternate seed.`);
        }
      }

      return {
        index: currentIdx,
        sub_genre: isMultiPrompt ? `Concept #${conceptNumber} (${assignedSubGenre})` : assignedSubGenre,
        location: assignedLocation,
        subject: assignedAnomaly,
        text: promptText,
        similarity_score: Number((lastSimilarity * 100).toFixed(1)),
      };
    };

    const indices = Array.from({ length: count }, (_, i) => startIdx + i);
    const results = await Promise.all(indices.map(idx => generateOne(idx)));
    return results;
  }

  // ---------------- LAYER 3: ANTI-DUPLICATE SEMANTIC VALIDATOR ----------------
  private extractTokens(text: string): Set<string> {
    const stopWords = new Set([
      'create', 'second', 'vertical', 'smartphone', 'video', 'shot', 'strictly',
      'camera', 'pure', 'continuous', 'first', 'person', 'selfie', 'face', 'picture',
      'overlay', 'setting', 'seconds', 'from', 'show', 'with', 'hand', 'bare', 'operator',
      'audio', 'negative', 'prompt', 'human', 'cinematic', 'realistic', 'phone', 'down'
    ]);
    const words = text
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
    // Check against last 30 recorded prompts
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
    // Keep sliding window of 200 items in memory
    if (this.sessionTokenHistory.size > 200) {
      const firstKey = this.sessionTokenHistory.keys().next().value;
      if (firstKey) this.sessionTokenHistory.delete(firstKey);
    }
  }

  private assembleFallbackPrompt(
    fixed: FixedDNA,
    location: string,
    subject: string,
    toolOrDetail: string,
    anchorOrTexture: string,
    climaxOrEnding: string,
  ): string {
    const camera = fixed.camera_and_medium || 'Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay.';
    const audio = fixed.audio_rules || 'Audio: Natural environmental Foley sound design and panicked sharp breathing.';
    const negative = fixed.negative_prompt || 'human face, man face, selfie, front camera, PIP, cinematic CGI sheen, smooth gimbal stabilization, cartoon effects, watermarks, text overlays';

    return (
      `${camera} ` +
      `The scene is set in ${location}. ` +
      `In the opening 0–2 seconds, the camera focuses on an undeniable visual hook: ${subject}. ` +
      `From 2–5 seconds, continuous camera movement and authentic handheld framing reveal ${toolOrDetail}, framed alongside ${anchorOrTexture} to anchor realistic scale and texture. ` +
      `From 5–8 seconds, the scene escalates with dynamic physical motion and high tension. ` +
      `From 8–10 seconds, ${climaxOrEnding}. ` +
      `${audio}\n\n` +
      `## Negative prompt\n${negative}`
    );
  }

  private getIntelligentFallbackMatrix(masterPrompt: string): PromptMatrix {
    const userPrompts = this.parseUserPromptExamples(masterPrompt);
    const isMultiPrompt = userPrompts.length > 1;

    let extractedSubjects: string[] = [];
    if (isMultiPrompt) {
      extractedSubjects = userPrompts.map((p, i) => this.extractCoreSubjectFromPrompt(p) || `Concept #${i + 1}`);
    } else {
      const singleSub = this.extractCoreSubjectFromPrompt(masterPrompt);
      if (singleSub && singleSub.length > 15) {
        extractedSubjects.push(singleSub);
      }
    }

    const defaultAnomalies = [
      'a flat 1-meter natural slate slab sharply split down a center seam where the left half is crusted in sub-zero frost while the right half radiates hot thermal heatwaves',
      'an impossible 30-centimeter-wide, 15-centimeter-high perfect hemisphere dome of crystal-clear liquid water holding shape unsupported on dry rock like heavy glass',
      'inside a natural 50-centimeter depression, hundreds of loose bone-dry jagged gravel stones are rapidly boiling and swirling smoothly like liquid water whirlpool',
      'an unnatural pool of mirror-black viscous fluid slowly crawling vertically uphill across dry rock like living dark mercury with zero wet residue',
      'a perfectly circular 2-foot patch of dark magnetic magnetite sand humming with a low 60Hz acoustic vibration making dust motes float 1 inch in mid-air',
      'a 40-centimeter rock basin filled with glowing amber-tinted groundwater that instantly flash-petrifies dipped organic matter into brittle crystal stone',
      'a narrow 5-centimeter vertical rock fracture pulling a continuous, freezing negative-pressure vacuum draft sucking ambient dust like a miniature turbine',
      'a porous basalt slab emitting rhythmic phosphorescent green pulses every 2 seconds with an audible electrical hum',
      'a natural quartz boulder levitating exactly 2 inches above the bedrock, rotating at a slow, constant 5 RPM',
      'a patch of desert sand that instantly solidifies into mirror-smooth dark obsidian glass upon the lightest footstep contact',
    ];

    const finalSubjects = extractedSubjects.length > 0
      ? [...extractedSubjects, ...defaultAnomalies.filter(a => !extractedSubjects.includes(a))]
      : defaultAnomalies;

    const isAnomaly = masterPrompt.toLowerCase().includes('smartphone') || masterPrompt.toLowerCase().includes('anomaly');
    const nicheName = isMultiPrompt ? `${userPrompts.length}-Concept Master Series` : (isAnomaly ? 'Viral Anomaly Found Footage' : 'High-Retention Video Series');

    return {
      niche_name: nicheName,
      theme_summary: isMultiPrompt
        ? `Diverse 10-second vertical video series covering ${userPrompts.length} distinct creative concepts.`
        : '10-second vertical 9:16 raw smartphone found-footage discovering anomalous natural phenomena.',
      fixed_dna: {
        camera_and_medium:
          'Create a 10-second vertical 9:16 raw smartphone video shot strictly from the rear camera in pure continuous first-person POV, with absolutely no selfie camera, no face-cam, and no picture-in-picture overlay.',
        timing_breakdown: [
          '0-2s: Undeniable reality-bending visual hook',
          '0-3s: Tentative steps, natural mobile phone wobble, auto-exposure balancing',
          '3-6s: Crouch within 6 inches, physical test with everyday tool, biological scale anchor',
          '6-8s: Secondary reaction or escalation defying expectations',
          '8-10s: Violent concussive shock climax, debris at boots, panic gasp, stumble backward, cut out with NO face visible',
        ],
        negative_prompt:
          'human face, man face, selfie, front camera, picture-in-picture, PIP, face-cam, reaction face, talking head, vlogger overlay, avatar, split screen, napkins, tissues, paper, glass bowl, acrylic prop, cinematic CGI sheen, smooth gimbal stabilization, fantasy glowing magic runes, blue energy shields, sci-fi forcefields, cartoon water effects, alien technology, dramatic movie trailer soundtrack, bass drops, sound design risers, motion blur glitches, subtitles, text overlays, logos, watermarks, extra fingers, deformed hands, and narrative explanations. Maintain the convincing, unpolished aesthetic of authentic viral mobile found-footage captured spontaneously on a smartphone.',
        audio_rules: 'Audio: [synchronized sound elements], and panicked sharp breathing.',
        structural_template: '',
      },
      hierarchical_matrix: {
        sub_genres: [
          'Banded Iron Formation',
          'Sub-Alpine Slate Trail',
          'Alluvial Fault Wash',
          'Icelandic Basalt Plateau',
          'Atacama Salt Flat',
          'Karst Limestone Sinkhole',
          'Siberian Permafrost Basin',
          'Utah Red Slickrock Plateau',
          'Scottish Peat Bog',
          'Geothermal Caldera Slope',
          'Deep Copper Mine Tailings',
          'Glacial Moraine Ridge',
          'Appalachian Hemlock Hollow',
          'Badlands Bentonite Wash',
          'Brittany Granite Tide-Pool',
        ],
        locations: [
          'a remote banded iron formation outcrop under harsh midday sun, with layered rust-red hematite slabs and metallic black magnetite gravel',
          'a cold, overcast sub-alpine scree trail covered in loose grey slate stones, dry yellow tussock grass, and cool mountain air',
          'a dry alluvial fault wash under harsh midday sun, filled with sun-baked grey river cobbles, fractured shale gravel, and dry desert thorn-scrub',
          'an isolated Icelandic black volcanic basalt plateau buffeted by freezing North Atlantic gales, with hexagonal basalt columns and wet black sand',
          'a blindingly white Atacama alkali salt flat under a scorched cloudless sky, with cracked geometric polygon salt crust and razor-sharp mineral ridges',
          'an ancient Karst limestone sinkhole entrance in a temperate river gorge, with jagged mossy boulders and cold groundwater seeps',
          'a desolate Siberian tundra permafrost thaw basin with exposed ancient black mud, frozen roots, and icy puddle ruts',
          'a barren Utah red sandstone slickrock plateau with wind-hollowed sandstone bowls and fine rust-colored quartz powder',
        ],
        subjects_or_anomalies: finalSubjects,
        tools_and_probes: [
          'a 10-centimeter rusty iron rail nail',
          'a dented military surplus steel canteen',
          'a 1-meter dry oak walking stick',
          'a vintage brass pocket compass',
          'a dry 8-inch weathered juniper branch',
          'a freshly plucked green mountain fern leaf',
          'a digital infrared laser thermometer',
          'a heavy 1-inch chrome steel ball-bearing',
        ],
        scale_anchors: [
          'with a small black ground beetle crawling on the dry rock edge to anchor realistic physical scale',
          'with a tiny dried pine needle resting on the rock rim to anchor realistic physical scale',
          'with a tiny horned beetle on the rock rim to anchor realistic physical scale',
          'with a red wood ant scrambling across the stone grain anchoring authentic physical scale',
          'with a tiny brittle dried lichen flake clinging to the rock seam anchoring authentic physical scale',
          'with a tiny dead honeybee carcass lying beside the anomaly anchoring believable real-world scale',
        ],
        climaxes: [
          'a high-frequency metallic resonance screeches from the bedrock; the anomaly violently cavitates with an explosive acoustic crack, blasting pressurized fragments straight into the lens',
          'extreme thermal shock causes the rock slab to violently split with an explosive gunshot-like crack, sending hot vapor and sharp rock fragments straight toward boots',
          'a terrifying subterranean infrasound vibration hums; fluid gravel instantaneously locks solid in 0.05 seconds, snapping the thick oak stick in half with concussive gunshot crack',
          'the liquid pool suddenly snaps backward like a high-tension rubber band and ruptures into a concussive shockwave of mist and stinging droplets',
          'the compass glass violently implodes with a loud electrical pop and sharp blue spark discharge, sending pressurized mineral dust blasting against camera lens',
        ],
      },
      subjects: finalSubjects,
      locations: ['Remote Geological Formation'],
      actions_or_hooks: ['Physical probe test and violent acoustic fracture'],
      camera_styles: ['Pure continuous 9:16 first-person POV rear smartphone camera'],
    };
  }

  // ---------------- LAYER 4: DOWNLOADABLE FILE & VPS 1-CLICK LINKING ----------------
  async pushToVps(filename: string, content: string, vpsUrl?: string): Promise<{ success: boolean; message: string; filePath?: string }> {
    // 1. Always store locally in uploads/prompts folder
    const exportDir = path.join(process.cwd(), 'uploads', 'prompts');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const localFilePath = path.join(exportDir, filename);
    fs.writeFileSync(localFilePath, content, 'utf-8');

    // 2. If a custom VPS webhook URL is provided, push via HTTP POST
    if (vpsUrl && vpsUrl.trim().startsWith('http')) {
      try {
        const res = await axios.post(
          vpsUrl.trim(),
          { filename, content },
          { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
        );
        return {
          success: true,
          message: `Successfully transferred to VPS endpoint (${res.status}): ${filename}`,
          filePath: localFilePath,
        };
      } catch (err: any) {
        this.logger.warn(`Push to custom VPS URL failed: ${err.message}. File saved locally.`);
      }
    }

    return {
      success: true,
      message: `Prompt file '${filename}' successfully saved on server! Ready for 1-click download or automated VPS rendering.`,
      filePath: localFilePath,
    };
  }

  // ---------------- 🎬 NATIVE VIDEO REVERSE-ENGINEERING (GEMINI 3.8 FLASH) ----------------
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

    // 1. If it's a TikTok URL, attempt TikWM direct fast extraction first
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

    // 2. yt-dlp extraction for YouTube, Reels, TikTok, Twitter, Facebook, etc.
    if (isSocial) {
      try {
        const tmpFile = path.join(os.tmpdir(), `rv_${Date.now()}_${Math.floor(Math.random() * 10000)}.mp4`);
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

    // 3. Direct HTTP GET (works for direct mp4 links, CDN URLs, Cloudinary, etc.)
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

    // 4. If all automated URL downloads fail
    if (isFacebook) {
      throw new Error(
        'Facebook security wall ne is Reel ka automated download block kar diya hai. Baraye meherbani video apne mobile ya PC se download karein aur "Upload .mp4" tab ke zariye direct upload karein!',
      );
    }

    throw new Error(
      'Is video link se stream download nahi ho saki. Baraye meherbani direct .mp4 video link dein ya "Upload .mp4" tab ke zariye direct file upload karein!',
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

    const anchorCount = Math.min(Math.max(sampleCount, 1), 5);

    const promptText = `You are a world-class AI Cinematographer and Viral Short-Form Video Producer.
Your task is NATIVE VIDEO REVERSE-ENGINEERING of this short video clip.

CRITICAL INSTRUCTION:
Base your entire analysis 100% strictly on what is ACTUALLY visible and audible in this specific video clip. Do NOT assume the video is about rocks, tools, or biomes unless you actually observe them in the footage. Adapt completely to whatever genre or style is shown.

Perform these critical tasks:

TASK 1: DECONSTRUCT ORIGINAL VIDEO (Watch full video motion, subject, camera, and Foley audio):
- actual_subject_and_action: Factual description of what is actually happening in this video.
- visual_hook_0_to_2s: The exact opening visual hook that grabs attention in the first 2 seconds.
- camera_perspective: Framing, POV, camera movement, autofocus, handheld natural motion/wobble, lighting.
- interaction_or_action: Main subject interaction, action, or escalation between 2-8 seconds.
- climax_or_ending: The climax, final reaction, dramatic turn, or ending hook between 8-10 seconds.
- audio_foley: Granular sound design and Foley breakdown (ambient sounds, physical impacts, voice/breathing).
- viral_retention_formula: Why this video works psychologically (curiosity gap, tension curve, satisfying visuals).

TASK 2: RE-SKIN INTO A 100% BRAND NEW CONCEPT (Same Viral Formula, Fresh Original Content):
- Retain the EXACT viral retention curve, tension, and camera pacing, but create a 100% brand-new, copyright-free creative concept in the same style/genre.
- title: Short distinctive concept title.
- niche: Specific content niche.
- core_hook: The new, 100% original hook that replaces the original video's subject.
- new_biome: New creative environment or setting.
- new_tool: New item, tool, or focal interaction element.
- new_scale_anchor: New visual detail or texture element.
- new_climax: New dramatic ending or reaction.

TASK 3: COMPILE THE MASTER PROMPT:
- Full, ready-to-run 10-second prompt for this new re-skinned concept with full camera POV, setting, 0-2s hook, 2-5s action, 5-8s escalation, 8-10s climax, synchronized Audio: Foley line, and ## Negative prompt block.

TASK 4: HIERARCHICAL MATRIX & ${anchorCount} INITIAL TEST PROMPTS:
- Create a focused, high-density matrix tailored to THIS concept:
  * sub_genres: 10 distinct themes/sub-genres
  * locations: 10 distinct locations
  * subjects_or_anomalies: 10 distinct subjects/hooks
  * tools_and_probes: 10 tools/objects/interaction details
  * scale_anchors: 8 scale anchors/fine details
  * climaxes: 10 climaxes/endings
- test_prompts: Generate exactly ${anchorCount} complete, ready-to-run 10-second variation prompts directly exploring this concept across different settings. Each prompt must include ## Negative prompt.

Return strictly valid JSON with this schema:
{
  "original_analysis": {
    "actual_subject_and_action": "...",
    "visual_hook": "...",
    "camera_and_pov": "...",
    "interaction_or_action": "...",
    "climax": "...",
    "audio_elements": "...",
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
      "timing_breakdown": ["0-2s...", "2-5s...", "5-8s...", "8-10s..."],
      "negative_prompt": "...",
      "audio_rules": "..."
    },
    "hierarchical_matrix": {
      "sub_genres": ["..."],
      "locations": ["..."],
      "subjects_or_anomalies": ["..."],
      "tools_and_probes": ["..."],
      "scale_anchors": ["..."],
      "climaxes": ["..."]
    }
  },
  "test_prompts": [
    {
      "index": 1,
      "sub_genre": "...",
      "location": "...",
      "subject": "...",
      "text": "Complete 10-second prompt #1 with ## Negative prompt"
    }
  ]
}`;

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
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 4096,
        responseMimeType: 'application/json',
      },
    };

    // Fast, resilient cascading models to eliminate timeouts & demand spikes
    const candidateModels = [
      'gemini-3.5-flash',
      'gemini-3.6-flash',
      'gemini-3.8-flash',
    ];

    let candidate: string | null = null;
    let lastError: any = null;

    for (const model of candidateModels) {
      try {
        this.logger.log(`Calling Gemini Video Vision with model: ${model}`);
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
        const res = await axios.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 30000,
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
      throw new Error(`Google Gemini Video Vision servers par high demand hai: ${errDetail}. Kuch lamhay baad dobara try karein.`);
    }

    let cleanCandidate = candidate.trim();
    if (cleanCandidate.startsWith('```json')) {
      cleanCandidate = cleanCandidate.replace(/^```json\s*/, '').replace(/\s*```[\s\S]*$/, '');
    } else if (cleanCandidate.startsWith('```')) {
      cleanCandidate = cleanCandidate.replace(/^```\s*/, '').replace(/\s*```[\s\S]*$/, '');
    }

    const firstBrace = cleanCandidate.indexOf('{');
    const lastBrace = cleanCandidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      cleanCandidate = cleanCandidate.substring(firstBrace, lastBrace + 1);
    }

    let parsed: any;
    try {
      parsed = JSON.parse(cleanCandidate);
    } catch (parseErr: any) {
      this.logger.warn(`Initial JSON parse failed: ${parseErr.message}. Attempting structural repair...`);
      let repaired = false;
      const lastObjClose = cleanCandidate.lastIndexOf('},');
      if (lastObjClose !== -1) {
        try {
          const testCandidate = cleanCandidate.substring(0, lastObjClose + 1) + ']}';
          parsed = JSON.parse(testCandidate);
          repaired = true;
          this.logger.log('Successfully recovered truncated JSON payload with intact prompts!');
        } catch (_) {}
      }
      if (!repaired) {
        const lastBraceClose = cleanCandidate.lastIndexOf('}');
        if (lastBraceClose !== -1) {
          try {
            const testCandidate = cleanCandidate.substring(0, lastBraceClose + 1) + '}';
            parsed = JSON.parse(testCandidate);
            repaired = true;
            this.logger.log('Successfully recovered JSON payload via root closure!');
          } catch (_) {}
        }
      }
      if (!repaired) {
        throw new Error('Gemini Video Vision output format error. Please try analyzing again.');
      }
    }

    const nicheName = parsed.matrix?.niche_name || parsed.re_skinned_concept?.title || 'Viral Video Concept';
    const themeSummary = parsed.matrix?.theme_summary || parsed.re_skinned_concept?.core_hook || '10-second vertical video series';

    const matrix: PromptMatrix = {
      niche_name: nicheName,
      theme_summary: themeSummary,
      fixed_dna: parsed.matrix?.fixed_dna || {
        camera_and_medium: 'Create a 10-second vertical 9:16 video in continuous POV.',
        timing_breakdown: ['0-2s: Hook', '2-5s: Development', '5-8s: Escalation', '8-10s: Climax'],
        negative_prompt: 'human face, selfie, watermark, CGI sheen, low quality',
        audio_rules: 'Audio: Natural environmental Foley sound design.',
        structural_template: '',
      },
      hierarchical_matrix: parsed.matrix?.hierarchical_matrix || {
        sub_genres: [parsed.re_skinned_concept?.niche || 'Signature Concept'],
        locations: [parsed.re_skinned_concept?.new_biome || 'Signature Setting'],
        subjects_or_anomalies: [parsed.re_skinned_concept?.core_hook || 'Core Visual Hook'],
        tools_and_probes: [parsed.re_skinned_concept?.new_tool || 'Focal Interaction'],
        scale_anchors: [parsed.re_skinned_concept?.new_scale_anchor || 'Texture Detail'],
        climaxes: [parsed.re_skinned_concept?.new_climax || 'Dramatic Climax'],
      },
      subjects: parsed.matrix?.hierarchical_matrix?.subjects_or_anomalies || [parsed.re_skinned_concept?.core_hook || 'Core Hook'],
      locations: parsed.matrix?.hierarchical_matrix?.locations || [parsed.re_skinned_concept?.new_biome || 'Setting'],
      actions_or_hooks: parsed.matrix?.hierarchical_matrix?.climaxes || [parsed.re_skinned_concept?.new_climax || 'Climax'],
      camera_styles: ['Continuous vertical 9:16 POV'],
    };

    const testPrompts: GeneratedPromptItem[] = Array.isArray(parsed.test_prompts)
      ? parsed.test_prompts.map((p: any, i: number) => ({
          index: p.index || i + 1,
          sub_genre: p.sub_genre || p.title || `Variation ${i + 1}`,
          location: p.location || '',
          subject: p.subject || '',
          text: p.text || (typeof p === 'string' ? p : ''),
          similarity_score: 0,
        }))
      : [];

    return {
      originalAnalysis: parsed.original_analysis,
      reSkinnedConcept: parsed.re_skinned_concept,
      masterPrompt: parsed.master_prompt,
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
    // Request up to 5 core anchor prompts from Gemini Video Vision (prevents token truncation)
    const visionAnchorCount = Math.min(safeCount, 5);
    const result = await this.reverseEngineerVideo(videoBuffer, visionAnchorCount, mimeType);

    let testPrompts = result.testPrompts || [];

    // If user requested more than vision anchor prompts (e.g. 10, 15, or 20 prompts),
    // dynamically generate the remaining prompts using Qwen 3.8 / Groq from this EXACT concept's Master Prompt & Matrix!
    if (testPrompts.length < safeCount) {
      const needed = safeCount - testPrompts.length;
      this.logger.log(`Supplementing ${needed} test prompts from this video's Master Prompt and Matrix using Groq...`);
      const additional = await this.generateBatch(
        result.masterPrompt,
        result.matrix,
        testPrompts.length + 1,
        needed,
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
