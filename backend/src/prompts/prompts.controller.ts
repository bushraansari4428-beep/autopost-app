import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { PromptsService, PromptMatrix } from './prompts.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('prompts')
export class PromptsController {
  constructor(private readonly promptsService: PromptsService) {}

  @Get('status')
  getStatus() {
    return {
      status: 'ONLINE',
      engine: 'Qwen 3.8 (Groq Neural Acceleration) + Gemini 3.8 Flash (Native Video Vision)',
      speed: '1.5s - 2.0s per prompt',
    };
  }

  @Post('reverse-engineer-video')
  @UseInterceptors(FileInterceptor('video', { limits: { fileSize: 50 * 1024 * 1024 } }))
  async reverseEngineerVideo(
    @UploadedFile() file?: Express.Multer.File,
    @Body() body?: { videoUrl?: string; sampleCount?: number | string },
  ) {
    let videoBuffer: Buffer | null = null;
    let mimeType = 'video/mp4';

    if (file && file.buffer) {
      videoBuffer = file.buffer;
      mimeType = file.mimetype || 'video/mp4';
    } else if (body?.videoUrl && body.videoUrl.trim()) {
      const downloaded = await this.promptsService.downloadVideoFromUrl(body.videoUrl.trim());
      videoBuffer = downloaded.buffer;
      mimeType = downloaded.mimeType || 'video/mp4';
    } else {
      throw new BadRequestException('Either a video file or a video URL must be provided');
    }

    const sampleCount = body?.sampleCount ? parseInt(String(body.sampleCount), 10) : 5;
    return await this.promptsService.reverseEngineerAndGenerateTestBatch(
      videoBuffer,
      isNaN(sampleCount) ? 5 : sampleCount,
      mimeType,
    );
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

