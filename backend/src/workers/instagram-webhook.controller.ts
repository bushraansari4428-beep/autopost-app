import { Controller, Post, Body, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { LogsService } from '../logs/logs.service';

@Controller('api/webhooks')
export class InstagramWebhookController {
  private readonly logger = new Logger(InstagramWebhookController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly logsService: LogsService,
  ) {}

  @Post('instagram-reel')
  async handleIncomingReel(
    @Headers('x-webhook-secret') secret: string,
    @Body() payload: { username: string; shortcode: string; reelUrl: string; caption: string },
  ) {
    if (!secret || secret !== process.env.WEBHOOK_SECRET) {
      throw new UnauthorizedException('Invalid Secret Key');
    }

    this.logsService.log('INFO', `Webhook received Instagram Reel: ${payload.shortcode} from ${payload.username}`);

    try {
      const sourceUrlStr = `instagram.com/${payload.username}`;
      const source = await this.prisma.source.findFirst({
        where: {
          platform: 'INSTAGRAM',
          url: { contains: sourceUrlStr }
        },
        include: { mappings: true }
      });

      if (!source) {
        this.logger.warn(`No source found for ${payload.username}`);
        return { success: false, message: 'Source not found' };
      }

      const existing = await this.prisma.video.findFirst({
        where: {
          sourceId: source.id,
          originalId: payload.shortcode
        }
      });

      if (existing) {
        this.logger.log(`Video ${payload.shortcode} already processed.`);
        return { success: true, message: 'Already processed' };
      }

      let directMp4Url = await this.getDirectMp4FromCobalt(payload.reelUrl);
      if (!directMp4Url) {
         this.logsService.log('ERROR', `Could not extract direct MP4 URL via Cobalt for ${payload.shortcode}`);
         return { success: false, message: 'Failed to extract MP4' };
      }

      this.logsService.log('INFO', `Successfully extracted MP4 for ${payload.shortcode}`);

      const newVideo = await this.prisma.video.create({
        data: {
          title: payload.caption?.substring(0, 200) || `Instagram Reel ${payload.shortcode}`,
          description: payload.caption || '',
          originalId: payload.shortcode,
          publishedAt: new Date(),
          url: payload.reelUrl,
          sourceId: source.id,
        }
      });
      
      for (const mapping of source.mappings) {
        const fbPage = await this.prisma.facebookPage.findUnique({
          where: { id: mapping.facebookPageId }
        });

        if (!fbPage) continue;

        const uploadHist = await this.prisma.uploadHistory.create({
          data: {
            videoId: newVideo.id,
            facebookPageId: fbPage.id,
            status: 'PROCESSING'
          }
        });

        try {
          this.logsService.log('INFO', `Uploading ${payload.shortcode} to Facebook...`);
          const fbRes = await fetch(`https://graph-video.facebook.com/v19.0/${fbPage.pageId}/videos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              access_token: fbPage.accessToken,
              file_url: directMp4Url,
              description: newVideo.title
            })
          });
          
          const fbData = await fbRes.json();
          if (!fbRes.ok || fbData.error) {
            throw new Error(`Facebook API Error: ${JSON.stringify(fbData.error || fbData)}`);
          }
          
          await this.prisma.uploadHistory.update({
            where: { id: uploadHist.id },
            data: { status: 'COMPLETED', facebookPostId: fbData.id }
          });
          this.logsService.log('INFO', `Success! Facebook Post ID: ${fbData.id}`);

        } catch (err: any) {
          this.logsService.log('ERROR', `Upload failed: ${err.message}`);
          await this.prisma.uploadHistory.update({
            where: { id: uploadHist.id },
            data: { status: 'FAILED', errorMessage: err.message }
          });
        }
      }

      return { success: true, shortcode: payload.shortcode };
    } catch (e: any) {
      this.logger.error(`Webhook error: ${e.message}`);
      return { success: false, error: e.message };
    }
  }

  private async getDirectMp4FromCobalt(reelUrl: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.cobalt.tools/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: reelUrl })
      });
      const data = await response.json();
      if (data && data.url) {
        return data.url;
      }
      return null;
    } catch (error: any) {
      this.logger.error(`Cobalt API failed: ${error.message}`);
      return null;
    }
  }
}
