import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  private validateAndNormalizePlatformUrl(platform: string, url: string): string {
    if (!url) return url;
    const cleanUrl = url.trim();
    const lower = cleanUrl.toLowerCase();

    // 1. TikTok Validation
    if (platform === 'TIKTOK') {
      if (lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('instagram.com') || lower.includes('xiaohongshu.com') || lower.includes('kuaishou.com')) {
        throw new BadRequestException('Mismatched platform: You selected TikTok, but entered a link from another platform.');
      }
      if (!lower.includes('tiktok.com') && !lower.startsWith('@')) {
        throw new BadRequestException('Invalid TikTok URL. Please enter a valid TikTok profile URL (e.g. https://www.tiktok.com/@username).');
      }
      return cleanUrl;
    }

    // 2. YouTube Validation
    if (platform === 'YOUTUBE') {
      if (lower.includes('tiktok.com') || lower.includes('instagram.com') || lower.includes('xiaohongshu.com') || lower.includes('kuaishou.com')) {
        throw new BadRequestException('Mismatched platform: You selected YouTube, but entered a link from another platform.');
      }
      if (!lower.includes('youtube.com') && !lower.includes('youtu.be') && !cleanUrl.startsWith('UC')) {
        throw new BadRequestException('Invalid YouTube URL. Please enter a valid YouTube channel URL or ID.');
      }
      return cleanUrl;
    }

    // 3. Instagram Validation
    if (platform === 'INSTAGRAM') {
      if (lower.includes('tiktok.com') || lower.includes('youtube.com') || lower.includes('youtu.be') || lower.includes('xiaohongshu.com')) {
        throw new BadRequestException('Mismatched platform: You selected Instagram, but entered a link from another platform.');
      }
      if (!lower.includes('instagram.com')) {
        throw new BadRequestException('Invalid Instagram URL. Please enter a valid Instagram profile URL.');
      }
      return cleanUrl;
    }

    // 4. Xiaohongshu Validation
    if (platform === 'XIAOHONGSHU') {
      if (!lower.includes('xiaohongshu.com') && !lower.includes('xhslink.com') && !lower.includes('xhslink.cn')) {
        throw new BadRequestException('Invalid Xiaohongshu URL. Please enter a valid Xiaohongshu/RedNote profile URL.');
      }
      return cleanUrl;
    }

    // 5. Kuaishou Validation
    if (platform === 'KUAISHOU') {
      if (!lower.includes('kuaishou.com')) {
        throw new BadRequestException('Invalid Kuaishou URL. Please enter a valid Kuaishou profile URL.');
      }
      return cleanUrl;
    }

    return cleanUrl;
  }

  async create(createSourceDto: any) {
    if (createSourceDto.platform && createSourceDto.url) {
      createSourceDto.url = this.validateAndNormalizePlatformUrl(createSourceDto.platform, createSourceDto.url);
    }

    // ONLY resolve handles for YouTube channel URLs! NEVER for TikTok!
    if (createSourceDto.platform === 'YOUTUBE' && createSourceDto.url && createSourceDto.url.includes('youtube.com/@')) {
      try {
        const handle = createSourceDto.url.split('youtube.com/@')[1].split('/')[0].split('?')[0];
        const res = await fetch(`https://www.youtube.com/@${handle}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/<meta itemprop="identifier" content="(UC[^"]+)"/);
          if (match && match[1]) {
            createSourceDto.url = `https://www.youtube.com/channel/${match[1]}`;
          }
        }
      } catch (e) {
        console.error('Failed to resolve handle', e);
      }
    }
    return this.prisma.source.create({
      data: createSourceDto,
    });
  }

  findAll(user?: any) {
    if (!user) {
      return this.prisma.source.findMany();
    }
    if (user.role === 'ADMIN') {
      return this.prisma.source.findMany({
        where: {
          OR: [
            { userId: user.id },
            { userId: null }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return this.prisma.source.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });
  }

  findOne(id: string) {
    return this.prisma.source.findUnique({
      where: { id },
    });
  }

  async update(id: string, updateSourceDto: any) {
    const existing = await this.prisma.source.findUnique({ where: { id } });
    if (!existing) {
      throw new BadRequestException('Source not found');
    }

    const { name, platform, url, status } = updateSourceDto;
    const effectivePlatform = platform || existing.platform;
    const effectiveUrl = url !== undefined ? url : existing.url;

    const validatedUrl = this.validateAndNormalizePlatformUrl(effectivePlatform, effectiveUrl);

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (platform !== undefined) data.platform = platform;
    if (url !== undefined) data.url = validatedUrl;
    if (status !== undefined) data.status = status;

    // If the URL or Platform changed, reset lastChecked and clear unposted video cache
    if ((url !== undefined && validatedUrl !== existing.url) || (platform !== undefined && platform !== existing.platform)) {
      data.lastChecked = null;
      await this.prisma.video.deleteMany({
        where: {
          sourceId: id,
          uploads: {
            none: { status: 'COMPLETED' }
          }
        }
      });
    }

    return this.prisma.source.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    // 1. Find all videos associated with this source
    const videos = await this.prisma.video.findMany({
      where: { sourceId: id },
      select: { id: true },
    });
    const videoIds = videos.map(v => v.id);

    // 2. Delete any upload histories tied to those videos
    if (videoIds.length > 0) {
      await this.prisma.uploadHistory.deleteMany({
        where: { videoId: { in: videoIds } },
      });
    }

    // 3. Delete videos tied to this source
    await this.prisma.video.deleteMany({
      where: { sourceId: id },
    });

    // 4. Delete mappings tied to this source
    await this.prisma.mapping.deleteMany({
      where: { sourceId: id },
    });

    // 5. Finally delete the source cleanly without FK errors
    return this.prisma.source.delete({
      where: { id },
    });
  }
}
