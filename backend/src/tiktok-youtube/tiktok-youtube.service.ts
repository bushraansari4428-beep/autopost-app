import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YoutubeService } from './youtube.service';
import { LogsService } from '../logs/logs.service';
import { getLatestTikTokVideos, downloadTikTokVideo, getYtDlpBinaryPath } from '../workers/tiktok.scraper';
import { execPromise } from '../utils/exec.util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import axios from 'axios';

@Injectable()
export class TiktokYoutubeService implements OnModuleInit {
  private readonly logger = new Logger(TiktokYoutubeService.name);
  private isSyncing = false;
  private timer: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly youtubeService: YoutubeService,
    private readonly logsService: LogsService,
  ) {}

  onModuleInit() {
    this.logger.log('==== TIKTOK TO YOUTUBE CRON WORKER INITIALIZED (Interval: 5 minutes) ====');
    if (process.env.GITHUB_ACTIONS !== 'true' && process.env.IS_WORKER !== 'true') {
      // Run every 5 minutes (300,000 ms)
      this.timer = setInterval(() => this.syncAllActiveMappings(), 5 * 60 * 1000);
      // Also run 20 seconds after app startup
      setTimeout(() => this.syncAllActiveMappings(), 20000);
    }
  }

  // ==========================================
  // YOUTUBE CHANNELS
  // ==========================================

  async listChannels(userId?: string) {
    const where: any = {};
    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }
    return this.prisma.youtubeChannel.findMany({
      where,
      include: {
        _count: {
          select: { mappings: true, uploads: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async connectChannel(dto: {
    refreshToken: string;
    clientId?: string;
    clientSecret?: string;
    customName?: string;
  }, userId?: string) {
    const { refreshToken, clientId, clientSecret, customName } = dto;

    if (!refreshToken) {
      throw new Error('Refresh Token is required to connect a YouTube Channel.');
    }

    const cid = clientId || process.env.GOOGLE_CLIENT_ID;
    const csec = clientSecret || process.env.GOOGLE_CLIENT_SECRET;

    if (!cid || !csec) {
      throw new Error('Google Client ID and Client Secret must be configured.');
    }

    this.logger.log('Testing YouTube credentials & retrieving Channel profile...');
    // Verify refresh token by requesting access token
    let accessToken: string;
    let tokenExpiry: Date;
    try {
      const res = await axios.post(
        'https://oauth2.googleapis.com/token',
        new URLSearchParams({
          client_id: cid,
          client_secret: csec,
          refresh_token: refreshToken.trim(),
          grant_type: 'refresh_token',
        }).toString(),
        {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          timeout: 15000,
        },
      );
      accessToken = res.data.access_token;
      tokenExpiry = new Date(Date.now() + (res.data.expires_in || 3600) * 1000);
    } catch (err: any) {
      const errDetails = err.response?.data ? JSON.stringify(err.response.data) : err.message;
      throw new Error(`Google OAuth verification failed: ${errDetails}`);
    }

    // Fetch Channel info
    const channelInfo = await this.youtubeService.fetchChannelInfoWithToken(accessToken);

    // Upsert YouTube channel record
    const channel = await this.prisma.youtubeChannel.upsert({
      where: { channelId: channelInfo.channelId },
      create: {
        channelId: channelInfo.channelId,
        name: customName || channelInfo.name,
        thumbnailUrl: channelInfo.thumbnailUrl,
        refreshToken: refreshToken.trim(),
        accessToken,
        tokenExpiry,
        clientId: cid,
        clientSecret: csec,
        userId: userId || null,
        status: 'ACTIVE',
      },
      update: {
        name: customName || channelInfo.name,
        thumbnailUrl: channelInfo.thumbnailUrl,
        refreshToken: refreshToken.trim(),
        accessToken,
        tokenExpiry,
        clientId: cid,
        clientSecret: csec,
        status: 'ACTIVE',
      },
    });

    await this.logsService.log('INFO', `Successfully connected YouTube Channel: "${channel.name}" (${channel.channelId})`);
    return channel;
  }

  async disconnectChannel(id: string, userId?: string) {
    const channel = await this.prisma.youtubeChannel.findUnique({ where: { id } });
    if (!channel) throw new Error('Channel not found');

    if (userId && channel.userId && channel.userId !== userId) {
      throw new Error('Unauthorized');
    }

    await this.prisma.youtubeChannel.delete({ where: { id } });
    await this.logsService.log('INFO', `Disconnected YouTube Channel: "${channel.name}"`);
    return { success: true };
  }

  // ==========================================
  // TIKTOK ➔ YOUTUBE MAPPINGS
  // ==========================================

  async listMappings(userId?: string) {
    const where: any = {};
    if (userId) {
      where.OR = [{ userId }, { userId: null }];
    }
    return this.prisma.tiktokYoutubeMapping.findMany({
      where,
      include: {
        youtubeChannel: {
          select: { id: true, name: true, channelId: true, thumbnailUrl: true, status: true },
        },
        _count: {
          select: { uploads: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createMapping(dto: {
    tiktokUrl: string;
    youtubeChannelId: string;
    customHashtags?: string;
    privacyStatus?: string;
  }, userId?: string) {
    let cleanUrl = (dto.tiktokUrl || '').trim();
    if (!cleanUrl) {
      throw new Error('TikTok Creator URL or username is required.');
    }

    // Normalize handle or URL: "@username" -> "https://www.tiktok.com/@username"
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      const handle = cleanUrl.replace(/^@/, '');
      cleanUrl = `https://www.tiktok.com/@${handle}`;
    }

    // Extract handle
    const handleMatch = cleanUrl.match(/@([a-zA-Z0-9_.-]+)/);
    const username = handleMatch ? handleMatch[1] : cleanUrl.split('/').filter(Boolean).pop() || 'creator';

    // Verify channel exists
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { id: dto.youtubeChannelId },
    });
    if (!channel) {
      throw new Error('Selected YouTube Channel does not exist.');
    }

    // Upsert mapping
    const mapping = await this.prisma.tiktokYoutubeMapping.upsert({
      where: {
        tiktokUsername_youtubeChannelId: {
          tiktokUsername: username,
          youtubeChannelId: dto.youtubeChannelId,
        },
      },
      create: {
        tiktokUrl: cleanUrl,
        tiktokUsername: username,
        tiktokName: `@${username}`,
        youtubeChannelId: dto.youtubeChannelId,
        userId: userId || null,
        customHashtags: dto.customHashtags || '#Shorts #viral',
        privacyStatus: dto.privacyStatus || 'public',
        status: 'ACTIVE',
      },
      update: {
        tiktokUrl: cleanUrl,
        customHashtags: dto.customHashtags || '#Shorts #viral',
        privacyStatus: dto.privacyStatus || 'public',
        status: 'ACTIVE',
      },
      include: {
        youtubeChannel: true,
      },
    });

    await this.logsService.log('INFO', `Created TikTok ➔ YouTube Mapping: @${username} ➔ ${channel.name}`);
    return mapping;
  }

  async updateMapping(id: string, dto: {
    status?: 'ACTIVE' | 'PAUSED';
    customHashtags?: string;
    privacyStatus?: string;
  }, userId?: string) {
    const mapping = await this.prisma.tiktokYoutubeMapping.findUnique({ where: { id } });
    if (!mapping) throw new Error('Mapping not found');

    const updated = await this.prisma.tiktokYoutubeMapping.update({
      where: { id },
      data: dto as any,
      include: { youtubeChannel: true },
    });

    return updated;
  }

  async deleteMapping(id: string, userId?: string) {
    const mapping = await this.prisma.tiktokYoutubeMapping.findUnique({ where: { id } });
    if (!mapping) throw new Error('Mapping not found');

    await this.prisma.tiktokYoutubeMapping.delete({ where: { id } });
    await this.logsService.log('INFO', `Deleted TikTok ➔ YouTube mapping for creator: @${mapping.tiktokUsername}`);
    return { success: true };
  }

  // ==========================================
  // SYNC & AUTOMATION ENGINE
  // ==========================================

  /**
   * Sync a specific mapping: Scrapes creator's profile, detects new videos,
   * downloads in HD without watermark, strips metadata, and uploads to YouTube Shorts.
   */
  async syncMapping(mappingId: string, isManual = false): Promise<{ success: boolean; message: string; count?: number }> {
    const mapping = await this.prisma.tiktokYoutubeMapping.findUnique({
      where: { id: mappingId },
      include: { youtubeChannel: true },
    });

    if (!mapping) {
      return { success: false, message: 'Mapping not found' };
    }

    if (!isManual && mapping.status === 'PAUSED') {
      return { success: true, message: 'Mapping is paused. Auto-sync skipped.' };
    }

    if (!mapping.youtubeChannel || mapping.youtubeChannel.status !== 'ACTIVE') {
      return { success: false, message: 'Mapped YouTube Channel is inactive or disconnected.' };
    }

    this.logger.log(`[TikTok ➔ YouTube] Checking creator @${mapping.tiktokUsername} for new videos...`);
    await this.logsService.log('INFO', `[TikTok ➔ YouTube] Scanning creator @${mapping.tiktokUsername} for newest videos...`);

    let discoveredVideos: any[] = [];
    try {
      // Scrape up to 20 recent videos from TikTok creator
      discoveredVideos = await getLatestTikTokVideos(mapping.tiktokUrl, 20);
    } catch (err: any) {
      this.logger.warn(`Failed to scrape TikTok creator @${mapping.tiktokUsername}: ${err.message}`);
      await this.logsService.log('WARN', `[TikTok ➔ YouTube] Scraper notice for @${mapping.tiktokUsername}: ${err.message}`);
      return { success: false, message: `Could not fetch TikTok videos: ${err.message}` };
    }

    if (!discoveredVideos || discoveredVideos.length === 0) {
      await this.logsService.log('INFO', `[TikTok ➔ YouTube] No videos found for @${mapping.tiktokUsername}.`);
      return { success: true, message: 'No videos found on creator profile.', count: 0 };
    }

    this.logger.log(`Found ${discoveredVideos.length} video(s) for @${mapping.tiktokUsername}. Checking for new unposted videos...`);

    // Fetch existing uploads for this mapping to filter out already published ones
    const existingUploads = await this.prisma.tiktokYoutubeUpload.findMany({
      where: { mappingId: mapping.id },
      select: { tiktokVideoId: true, status: true },
    });
    const postedVideoIds = new Set(existingUploads.filter(u => u.status === 'COMPLETED' || u.status === 'PROCESSING').map(u => u.tiktokVideoId));

    // Filter unuploaded videos
    const newVideos = discoveredVideos.filter(v => !postedVideoIds.has(String(v.id)));

    if (newVideos.length === 0) {
      await this.prisma.tiktokYoutubeMapping.update({
        where: { id: mapping.id },
        data: { lastChecked: new Date() },
      });
      await this.logsService.log('INFO', `[TikTok ➔ YouTube] Creator @${mapping.tiktokUsername} is up-to-date. No new videos.`);
      return { success: true, message: 'All creator videos are already synced to YouTube!', count: 0 };
    }

    // Sort ascending by creation time so we upload oldest unposted first (chronological order)
    newVideos.sort((a, b) => (a.createTime || 0) - (b.createTime || 0));

    // Limit to 1 video on manual trigger or 1-2 per cron cycle to respect YouTube quota
    const videosToPost = isManual ? [newVideos[0]] : newVideos.slice(0, 2);
    let postedCount = 0;

    for (const video of videosToPost) {
      const vId = String(video.id);
      this.logger.log(`Processing new video [${vId}] from @${mapping.tiktokUsername}...`);
      await this.logsService.log('INFO', `[TikTok ➔ YouTube] Downloading & syncing new video: "${video.caption?.substring(0, 45)}..."`);

      // 1. Create or update upload record as PROCESSING
      const uploadRecord = await this.prisma.tiktokYoutubeUpload.upsert({
        where: {
          mappingId_tiktokVideoId: {
            mappingId: mapping.id,
            tiktokVideoId: vId,
          },
        },
        create: {
          mappingId: mapping.id,
          youtubeChannelId: mapping.youtubeChannelId,
          tiktokVideoId: vId,
          tiktokUrl: video.url || `https://www.tiktok.com/@${mapping.tiktokUsername}/video/${vId}`,
          title: video.caption || `TikTok Video ${vId}`,
          description: video.caption || '',
          status: 'PROCESSING',
          publishedAt: video.createTime ? new Date(video.createTime * 1000) : new Date(),
        },
        update: {
          status: 'PROCESSING',
          errorMessage: null,
        },
      });

      const tempMp4 = path.join(os.tmpdir(), `yt_post_${Date.now()}_${Math.floor(Math.random() * 10000)}.mp4`);
      const strippedMp4 = path.join(os.tmpdir(), `yt_post_${Date.now()}_stripped.mp4`);

      try {
        // 2. Obtain direct MP4 stream URL
        let streamUrl = video.downloadUrl || video.playUrl;
        if (!streamUrl) {
          // Fallback to TikWM single video API
          try {
            const twRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(video.url)}`, { timeout: 10000 });
            streamUrl = twRes.data?.data?.hdplay || twRes.data?.data?.play;
          } catch (_) {}
        }

        // 3. Download the physical MP4 locally
        if (streamUrl) {
          try {
            await downloadTikTokVideo(streamUrl, tempMp4);
          } catch (err: any) {
            // If direct stream returned 403, fallback to yt-dlp
            const ytDlpCmd = await getYtDlpBinaryPath();
            await execPromise(`${ytDlpCmd} -i -o "${tempMp4}" "${video.url}"`, { timeout: 3 * 60 * 1000 });
          }
        } else {
          const ytDlpCmd = await getYtDlpBinaryPath();
          await execPromise(`${ytDlpCmd} -i -o "${tempMp4}" "${video.url}"`, { timeout: 3 * 60 * 1000 });
        }

        if (!fs.existsSync(tempMp4) || fs.statSync(tempMp4).size < 1000) {
          throw new Error('Downloaded video file is empty or missing.');
        }

        // 4. Strip TikTok metadata via FFmpeg (prevents duplicate hash detection)
        let finalUploadPath = tempMp4;
        try {
          const ffmpegPath = require('ffmpeg-static');
          if (ffmpegPath) {
            await execPromise(`"${ffmpegPath}" -loglevel error -i "${tempMp4}" -map_metadata -1 -c:v copy -c:a copy "${strippedMp4}"`);
            if (fs.existsSync(strippedMp4) && fs.statSync(strippedMp4).size > 1000) {
              finalUploadPath = strippedMp4;
            }
          }
        } catch (e: any) {
          this.logger.warn(`FFmpeg strip skipped: ${e.message}`);
        }

        // 5. Build YouTube Title, Description & Tags
        // Title: Original caption (or first line), with custom hashtags (max 100 chars)
        let rawTitle = (video.caption || '').trim();
        if (/^TikTok\s*Video\s*\d+$/i.test(rawTitle)) {
          rawTitle = '';
        }

        const customTags = (mapping.customHashtags || '#Shorts #viral').trim();
        let formattedTitle = rawTitle;
        if (!formattedTitle) {
          formattedTitle = `Viral Reel ${customTags}`;
        } else if (!formattedTitle.includes('#Shorts') && !formattedTitle.includes('#shorts')) {
          formattedTitle = `${formattedTitle} ${customTags}`;
        }

        if (formattedTitle.length > 100) {
          formattedTitle = formattedTitle.substring(0, 97).trim() + '...';
        }

        // Description: Original full caption + custom tags
        const fullDescription = `${video.caption || ''}\n\n${customTags}\n\nOriginal Creator: @${mapping.tiktokUsername}\nAuto-Synced via AutoPost App`.trim();

        // Extract hashtag words as YouTube tags
        const tagMatches = (fullDescription.match(/#([a-zA-Z0-9_]+)/g) || []).map(t => t.replace('#', ''));
        const tags = Array.from(new Set(['Shorts', 'TikTok', ...tagMatches])).slice(0, 15);

        // 6. Upload to YouTube Channel
        const uploadResult = await this.youtubeService.uploadVideo({
          channelId: mapping.youtubeChannelId,
          filePath: finalUploadPath,
          title: formattedTitle,
          description: fullDescription,
          tags,
          privacyStatus: (mapping.privacyStatus as any) || 'public',
        });

        // 7. Update database record to COMPLETED
        await this.prisma.tiktokYoutubeUpload.update({
          where: { id: uploadRecord.id },
          data: {
            status: 'COMPLETED',
            youtubeVideoId: uploadResult.videoId,
            youtubeUrl: uploadResult.youtubeUrl,
            uploadedAt: new Date(),
          },
        });

        // 8. Update mapping record
        await this.prisma.tiktokYoutubeMapping.update({
          where: { id: mapping.id },
          data: {
            lastChecked: new Date(),
            lastSyncedVideoId: vId,
          },
        });

        postedCount++;
        const successMsg = `[TikTok ➔ YouTube] Posted video to YouTube Channel "${mapping.youtubeChannel.name}"! Link: ${uploadResult.youtubeUrl}`;
        this.logger.log(successMsg);
        await this.logsService.log('INFO', successMsg);
      } catch (postErr: any) {
        this.logger.error(`Failed to post video ${vId} to YouTube: ${postErr.message}`);
        await this.prisma.tiktokYoutubeUpload.update({
          where: { id: uploadRecord.id },
          data: {
            status: 'FAILED',
            errorMessage: postErr.message,
          },
        });
        await this.logsService.log('ERROR', `[TikTok ➔ YouTube] Upload failed for video ${vId}: ${postErr.message}`);
      } finally {
        // Clean up temporary files
        if (fs.existsSync(tempMp4)) {
          try { fs.unlinkSync(tempMp4); } catch (_) {}
        }
        if (fs.existsSync(strippedMp4)) {
          try { fs.unlinkSync(strippedMp4); } catch (_) {}
        }
      }
    }

    return {
      success: true,
      message: `Successfully synced ${postedCount} new video(s) to YouTube!`,
      count: postedCount,
    };
  }

  /**
   * Periodic scheduler: Sync all active TikTok ➔ YouTube mappings.
   * Invoked by CronService every 5-10 minutes.
   */
  async syncAllActiveMappings() {
    if (this.isSyncing) {
      this.logger.log('TikTok ➔ YouTube sync already in progress. Skipping duplicate run.');
      return;
    }

    this.isSyncing = true;
    try {
      const activeMappings = await this.prisma.tiktokYoutubeMapping.findMany({
        where: {
          status: 'ACTIVE',
          youtubeChannel: { status: 'ACTIVE' },
        },
        include: { youtubeChannel: true },
      });

      if (activeMappings.length === 0) return;

      this.logger.log(`[TikTok ➔ YouTube Cron] Found ${activeMappings.length} active mapping(s) to monitor.`);

      for (const mapping of activeMappings) {
        try {
          await this.syncMapping(mapping.id, false);
        } catch (mErr: any) {
          this.logger.error(`Error monitoring mapping ${mapping.id}: ${mErr.message}`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Error in syncAllActiveMappings: ${err.message}`);
    } finally {
      this.isSyncing = false;
    }
  }

  // ==========================================
  // HISTORY & STATS
  // ==========================================

  async getHistory(userId?: string, limit = 50, offset = 0) {
    const where: any = {};
    if (userId) {
      where.mapping = {
        OR: [{ userId }, { userId: null }],
      };
    }

    const [total, items] = await Promise.all([
      this.prisma.tiktokYoutubeUpload.count({ where }),
      this.prisma.tiktokYoutubeUpload.findMany({
        where,
        include: {
          mapping: {
            select: { tiktokUsername: true, tiktokUrl: true },
          },
          youtubeChannel: {
            select: { name: true, channelId: true, thumbnailUrl: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
    ]);

    return { total, items };
  }

  async getStats(userId?: string) {
    const whereUser: any = userId ? { OR: [{ userId }, { userId: null }] } : {};

    const [totalChannels, activeMappings, totalUploaded, recentUploads] = await Promise.all([
      this.prisma.youtubeChannel.count({ where: whereUser }),
      this.prisma.tiktokYoutubeMapping.count({ where: { ...whereUser, status: 'ACTIVE' } }),
      this.prisma.tiktokYoutubeUpload.count({ where: { status: 'COMPLETED' } }),
      this.prisma.tiktokYoutubeUpload.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          status: true,
          youtubeUrl: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      totalChannels,
      activeMappings,
      totalUploaded,
      recentUploads,
      monitoringIntervalMinutes: 5,
    };
  }
}
