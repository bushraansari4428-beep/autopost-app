import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface PromptMatrix {
  niche_name: string;
  theme_summary: string;
  subjects: string[];
  locations: string[];
  actions_or_hooks: string[];
  camera_styles: string[];
}

export interface GeneratedPromptItem {
  index: number;
  location: string;
  subject: string;
  text: string;
}

@Injectable()
export class PromptsService {
  private readonly logger = new Logger(PromptsService.name);

  private readonly groqModel = 'qwen/qwen3.8-27b';
  private readonly hfSpaceUrl = process.env.HF_SPACE_URL || 'https://bushraa2-my-ai-brain.hf.space';

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
    return '';
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
    return '';
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
    // Remove leading **Prompt:** or Prompt 1:
    cleaned = cleaned.replace(/^\s*\*{0,2}Prompt(?:\s*\d+)?\*{0,2}\s*:\s*/i, '');
    return cleaned.trim();
  }

  private async callGroq(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string | null> {
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
          temperature: 0.75,
          max_tokens: maxTokens,
        },
        {
          headers: {
            Authorization: `Bearer ${key}`,
            'Content-Type': 'application/json',
          },
          timeout: 25000,
        },
      );

      if (response.status === 200 && response.data?.choices?.[0]?.message?.content) {
        return this.cleanOutput(response.data.choices[0].message.content);
      }
    } catch (err: any) {
      this.logger.warn(`Groq request failed: ${err.response?.status || err.message}`);
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
          timeout: 20000,
        },
      );

      const eventId = startRes.data?.event_id;
      if (!eventId) return '';

      const streamRes = await axios.get(`${endpoint}/${eventId}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        responseType: 'text',
        timeout: 45000,
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
      this.logger.error(`HF fallback failed: ${err.message}`);
    }
    return '';
  }

  private async queryBrain(systemPrompt: string, userPrompt: string, maxTokens = 600): Promise<string> {
    const groqRes = await this.callGroq(systemPrompt, userPrompt, maxTokens);
    if (groqRes) return groqRes;
    return await this.callHf(systemPrompt, userPrompt);
  }

  async analyzeMasterPrompt(masterPrompt: string): Promise<PromptMatrix> {
    const sysPrompt =
      'You are an expert viral AI video director. Analyze the provided Master Prompt to extract its exact theme, niche, cinematography style, and structural rules. Then produce a rich variation matrix in strict JSON format.';

    const userPrompt = `
MASTER PROMPT:
"""${masterPrompt}"""

Provide your output strictly in valid JSON with these keys:
{
  "niche_name": "Short 2-4 word name of niche",
  "theme_summary": "1 sentence core summary of the niche and mood",
  "subjects": ["List of 25 distinct subjects, characters, or focal items fitting this theme"],
  "locations": ["List of 30 distinct exotic, real-world, atmospheric environments/locations"],
  "actions_or_hooks": ["List of 25 unique micro-actions, emotional beats, or surprising twists"],
  "camera_styles": ["List of 10 cinematic camera movements, lighting, and framing rules"]
}
Return ONLY valid JSON.
`;

    const raw = await this.queryBrain(sysPrompt, userPrompt, 1500);
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        if (parsed.niche_name && parsed.locations) {
          return parsed as PromptMatrix;
        }
      }
    } catch (e: any) {
      this.logger.warn(`Failed to parse matrix JSON: ${e.message}`);
    }

    return {
      niche_name: 'Viral_Video_Content',
      theme_summary: 'High-retention viral 10-second video content',
      subjects: ['Subject A', 'Subject B', 'Subject C'],
      locations: ['Atmospheric outdoor vista', 'Moody misty rainforest', 'Golden desert dunes'],
      actions_or_hooks: ['Curious interaction', 'Unexpected bonding moment', 'Playful comedic twist'],
      camera_styles: ['Locked-off documentary 4K', 'Handheld organic tracking shot'],
    };
  }

  async generateBatch(
    masterPrompt: string,
    matrix: PromptMatrix,
    startIdx: number,
    count: number,
  ): Promise<GeneratedPromptItem[]> {
    const results: GeneratedPromptItem[] = [];
    const subjects = matrix.subjects?.length ? matrix.subjects : ['Focal Character'];
    const locations = matrix.locations?.length ? matrix.locations : ['Scenic Environment'];
    const actions = matrix.actions_or_hooks?.length ? matrix.actions_or_hooks : ['Novel interaction'];
    const cameras = matrix.camera_styles?.length ? matrix.camera_styles : ['Cinematic 4K wide-angle'];

    const sysPrompt = `You are an elite AI Video Director specialized in ${matrix.theme_summary || 'viral video creation'}.
Based on this Master Prompt DNA:
"""${masterPrompt}"""
Write ONE single highly detailed 10-second video scene prompt for AI video generators (Veo, Sora, Kling, Hailuo).
Strict Rule: Output ONLY the descriptive prompt text. Do NOT include greetings, intro, or labels like "Prompt:".`;

    for (let i = 0; i < count; i++) {
      const currentIdx = startIdx + i;
      const subj = subjects[Math.floor(Math.random() * subjects.length)];
      const loc = locations[Math.floor(Math.random() * locations.length)];
      const act = actions[Math.floor(Math.random() * actions.length)];
      const cam = cameras[Math.floor(Math.random() * cameras.length)];

      const userPrompt = `Generate Variation #${currentIdx}:
- Focal Subject: ${subj}
- Location: ${loc}
- Action / Hook: ${act}
- Camera & Lighting: ${cam}
Write the complete 10-second high-detail scene now.`;

      let promptText = await this.queryBrain(sysPrompt, userPrompt, 350);
      if (!promptText) {
        promptText = `Cinematic 10-second scene featuring ${subj} at ${loc}. ${act}. Captured with ${cam}, ultra-realistic 4K documentary style.`;
      }

      results.push({
        index: currentIdx,
        location: loc,
        subject: subj,
        text: promptText,
      });
    }

    return results;
  }

  async pushToVps(filename: string, content: string, vpsUrl?: string): Promise<{ success: boolean; message: string }> {
    // If a custom VPS webhook/agent URL is provided
    if (vpsUrl && vpsUrl.trim().startsWith('http')) {
      try {
        const res = await axios.post(
          vpsUrl.trim(),
          { filename, content },
          { timeout: 15000, headers: { 'Content-Type': 'application/json' } },
        );
        return {
          success: true,
          message: `Successfully uploaded to VPS (${res.status}): ${filename}`,
        };
      } catch (err: any) {
        this.logger.error(`Failed to push to VPS URL: ${err.message}`);
        return {
          success: false,
          message: `VPS Connection Error: ${err.message}. File is preserved locally.`,
        };
      }
    }

    // Default: Save to local exports folder on the server
    try {
      const exportDir = path.join(process.cwd(), 'uploads', 'prompts');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      const filePath = path.join(exportDir, filename);
      fs.writeFileSync(filePath, content, 'utf-8');

      return {
        success: true,
        message: `Prompt file '${filename}' successfully stored on server in uploads/prompts! Ready for VPS sync.`,
      };
    } catch (e: any) {
      return { success: false, message: `Storage Error: ${e.message}` };
    }
  }
}
