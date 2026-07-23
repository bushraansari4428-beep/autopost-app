import { Controller, Post, Body, Req, UnauthorizedException, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('github-action')
  async handleGitHubActionWebhook(@Body() payload: any, @Req() req: any) {
    const { uploadHistoryId, status, facebookPostId, errorMessage } = payload;
    
    if (!uploadHistoryId || !status) {
        throw new HttpException('Missing required fields', HttpStatus.BAD_REQUEST);
    }

    try {
      const upload = await this.prisma.uploadHistory.findUnique({
        where: { id: uploadHistoryId },
      });

      if (!upload) {
        throw new HttpException('Upload history not found', HttpStatus.NOT_FOUND);
      }

      await this.prisma.uploadHistory.update({
        where: { id: uploadHistoryId },
        data: {
          status: status,
          facebookPostId: facebookPostId || null,
          errorMessage: errorMessage || null,
        },
      });

      return { success: true };
    } catch (e) {
      throw new HttpException(e.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
