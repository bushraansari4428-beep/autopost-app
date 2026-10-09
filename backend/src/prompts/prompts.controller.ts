import { Controller, Post, Get, Body, UseGuards } from '@nestjs/common';
import { PromptsService, PromptMatrix } from './prompts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get('status')
  getStatus() {
    return {
      status: 'ONLINE',
      engine: 'Qwen 3.8 (Groq Neural Acceleration) + HF ZeroGPU Fallback',
      speed: '1.5s - 2.0s per prompt',
    };
  }

  @Post('analyze')
  async analyze(@Body() body: { masterPrompt: string }) {
    if (!body.masterPrompt || !body.masterPrompt.trim()) {
      return { error: 'Master prompt is required' };
    }
    const matrix = await this.promptsService.analyzeMasterPrompt(body.masterPrompt);
    return { success: true, matrix };
  }

  @Post('generate-batch')
  async generateBatch(
    @Body()
    body: {
      masterPrompt: string;
      matrix: PromptMatrix;
      startIdx: number;
      count: number;
    },
  ) {
    const { masterPrompt, matrix, startIdx = 1, count = 5 } = body;
    const safeCount = Math.min(Math.max(count, 1), 20); // Limit batch to 20 for responsive HTTP
    const prompts = await this.promptsService.generateBatch(masterPrompt, matrix, startIdx, safeCount);
    return { success: true, prompts };
  }

  @Post('push-to-vps')
  async pushToVps(
    @Body()
    body: {
      filename: string;
      content: string;
      vpsUrl?: string;
    },
  ) {
    const { filename, content, vpsUrl } = body;
    return await this.promptsService.pushToVps(filename, content, vpsUrl);
  }
}
