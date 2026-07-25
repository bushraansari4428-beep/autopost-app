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
    const expectedSecret = process.env.WEBHOOK_SECRET || 'Pakistan@92';
    if (!secret || secret !== expectedSecret) {
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
        this.logsService.log('INFO', `Instagram Reel ${payload.shortcode} already processed (found in DB).`);
        return { success: true, message: 'Already processed' };
      }

      let directMp4Url = await this.extractInstagramMp4(payload.shortcode);
      if (!directMp4Url) {
         this.logsService.log('ERROR', `Could not extract direct MP4 URL via mirrors/worker for ${payload.shortcode}`);
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
  private async extractInstagramMp4(shortcode: string): Promise<string | null> {
    try {
      this.logsService.log('INFO', `Extracting MP4 via kkinstagram mirror for shortcode: ${shortcode}`);
      const res = await fetch(`https://kkinstagram.com/reel/${shortcode}/`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
        redirect: 'follow',
      });
      if (res.ok && (res.headers.get('content-type')?.includes('video/') || res.url.includes('.mp4') || res.url.includes('cdninstagram.com'))) {
        this.logsService.log('INFO', `Successfully resolved Instagram MP4 stream via kkinstagram.`);
        return res.url;
      }
    } catch (e: any) {
      this.logger.warn(`kkinstagram extraction failed for ${shortcode}: ${e.message}`);
    }

    const igWorkerUrl = process.env.IG_WORKER_URL;
    if (igWorkerUrl) {
      try {
        let baseUrl = igWorkerUrl.trim().replace(/\/$/, '');
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
        this.logsService.log('INFO', `Trying IG Worker fallback for MP4 extraction: ${shortcode}`);
        const res = await fetch(`${baseUrl}?shortcode=${shortcode}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.mp4_url) {
            this.logsService.log('INFO', `Extracted MP4 via IG Worker fallback.`);
            return data.mp4_url;
          }
        }
      } catch (e: any) {
        this.logger.error(`IG Worker MP4 fallback failed: ${e.message}`);
      }
    }

    return null;
  }
}
