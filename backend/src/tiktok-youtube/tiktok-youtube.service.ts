import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { YoutubeService } from './youtube.service';
import { LogsService } from '../logs/logs.service';
import { MegaService } from '../workers/mega.service';
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
    private readonly megaService: MegaService,
  ) {}

  onModuleInit() {
    this.logger.log('==== TIKTOK TO YOUTUBE & CLOUD CRON WORKER INITIALIZED (Interval: 5 minutes) ====');
    if (process.env.GITHUB_ACTIONS !== 'true' && process.env.IS_WORKER !== 'true') {
      // Run every 5 minutes (300,000 ms)
      this.timer = setInterval(() => {
        this.syncAllActiveMappings();
        this.processScheduledCloudUploads();
      }, 5 * 60 * 1000);
      // Also run 20 seconds after app startup
      setTimeout(() => {
        this.syncAllActiveMappings();
        this.processScheduledCloudUploads();
      }, 20000);
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

  // ==========================================
  // YOUTUBE CLOUD QUEUE & SCHEDULED UPLOADS
  // ==========================================

  /**
   * Upload video to YouTube Channel's Cloud Folder on Mega
   * Automatically extracts title/caption from original filename
   */
  async uploadCloudVideo(channelId: string, originalFilename: string, buffer: Buffer, user?: any) {
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error('YouTube Channel not found');
    }

    if (user && user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
      if (channel.userId && channel.userId !== user.id) {
        throw new Error('Unauthorized to upload to this channel cloud');
      }
    }

    // Resolve user Mega credentials
    let megaEmail: string | undefined;
    let megaPassword: string | undefined;
    if (channel.userId) {
      const channelUser = await this.prisma.user.findUnique({ where: { id: channel.userId } });
      if (channelUser) {
        if (channelUser.role !== 'ADMIN' && (!channelUser.megaEmail || !channelUser.megaPassword)) {
          throw new Error('Mega Cloud credentials are not configured. Please update your profile.');
        }
        megaEmail = channelUser.megaEmail || undefined;
        megaPassword = channelUser.megaPassword || undefined;
      }
    }

    // Channel specific folder name: '[YouTube] ChannelName'
    const cleanChannelName = channel.name.replace(/[^\w\s-]/g, '').trim() || channel.channelId;
    const folderName = `[YouTube] ${cleanChannelName}`;

    const cleanTitle = path.parse(originalFilename).name.trim();
    const ext = path.extname(originalFilename) || '.mp4';
    const megaFilename = `yt_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;

    this.logger.log(`Uploading "${originalFilename}" to Mega folder "${folderName}" for channel "${channel.name}"...`);
    await this.logsService.log('INFO', `[YouTube Cloud] Uploading "${originalFilename}" to folder "${folderName}"...`);

    // Upload to Mega folder
    const megaLink = await this.megaService.uploadFile(megaFilename, buffer, megaEmail, megaPassword, folderName);

    // Update channel cloud folder name if not set
    if (!channel.cloudFolderName) {
      await this.prisma.youtubeChannel.update({
        where: { id: channel.id },
        data: { cloudFolderName: folderName },
      });
    }

    // Create YoutubeCloudVideo record in queue
    const cloudVideo = await this.prisma.youtubeCloudVideo.create({
      data: {
        youtubeChannelId: channel.id,
        filename: originalFilename,
        title: cleanTitle,
        description: `${cleanTitle}\n\n${channel.customHashtags || '#Shorts #viral #fyp'}`.trim(),
        url: megaLink,
        status: 'PENDING',
      },
    });

    await this.logsService.log('INFO', `[YouTube Cloud] Video "${cleanTitle}" queued for channel "${channel.name}"!`);
    return {
      success: true,
      message: `Video "${cleanTitle}" added to cloud queue successfully!`,
      video: cloudVideo,
    };
  }

  /**
   * Get YouTube Channel's Cloud Queue
   */
  async getCloudQueue(channelId: string, user?: any) {
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) {
      throw new Error('YouTube Channel not found');
    }

    const videos = await this.prisma.youtubeCloudVideo.findMany({
      where: { youtubeChannelId: channelId },
      orderBy: { createdAt: 'desc' },
    });

    const pendingCount = videos.filter(v => v.status === 'PENDING').length;
    const completedCount = videos.filter(v => v.status === 'COMPLETED').length;

    return {
      channel: {
        id: channel.id,
        name: channel.name,
        channelId: channel.channelId,
        thumbnailUrl: channel.thumbnailUrl,
        scheduledTime: channel.scheduledTime || '12:00',
        videosPerDay: channel.videosPerDay || 1,
        customHashtags: channel.customHashtags || '#Shorts #viral #fyp',
        privacyStatus: channel.privacyStatus || 'public',
        cloudFolderName: channel.cloudFolderName || `[YouTube] ${channel.name}`,
      },
      totalCount: videos.length,
      pendingCount,
      completedCount,
      videos,
    };
  }

  /**
   * Update Channel Cloud Schedule Settings
   */
  async updateChannelSchedule(channelId: string, dto: {
    scheduledTime?: string;
    videosPerDay?: number;
    customHashtags?: string;
    privacyStatus?: string;
  }, user?: any) {
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel) throw new Error('YouTube Channel not found');

    const updated = await this.prisma.youtubeChannel.update({
      where: { id: channelId },
      data: {
        scheduledTime: dto.scheduledTime,
        videosPerDay: dto.videosPerDay ? Number(dto.videosPerDay) : 1,
        customHashtags: dto.customHashtags,
        privacyStatus: dto.privacyStatus,
      },
    });

    await this.logsService.log('INFO', `Updated cloud schedule for channel "${channel.name}": Times [${dto.scheduledTime || 'OFF'}], Quantity [${dto.videosPerDay || 1}/day]`);
    return updated;
  }

  /**
   * Post Next Queued Cloud Video (Manual or Scheduled)
   */
  async postNextCloudVideo(channelId: string): Promise<{ success: boolean; message: string; video?: any }> {
    const channel = await this.prisma.youtubeChannel.findUnique({
      where: { id: channelId },
    });

    if (!channel || channel.status !== 'ACTIVE') {
      return { success: false, message: 'YouTube Channel not found or inactive.' };
    }

    // Find oldest pending video in queue
    const nextVideo = await this.prisma.youtubeCloudVideo.findFirst({
      where: {
        youtubeChannelId: channelId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (!nextVideo) {
      return { success: false, message: 'No pending videos in cloud queue.' };
    }

    await this.logsService.log('INFO', `[YouTube Cloud] Preparing to post queued video "${nextVideo.title}" to "${channel.name}"...`);
    
    await this.prisma.youtubeCloudVideo.update({
      where: { id: nextVideo.id },
      data: { status: 'PROCESSING' },
    });

    let downloadedPath: string | null = null;
    let strippedPath: string | null = null;

    try {
      // 1. Download file from Mega
      downloadedPath = await this.megaService.downloadFile(nextVideo.url);
      if (!downloadedPath || !fs.existsSync(downloadedPath)) {
        throw new Error(`Failed to download video from Mega: ${nextVideo.url}`);
      }

      // 2. Strip metadata via FFmpeg
      let uploadPath = downloadedPath;
      strippedPath = downloadedPath.replace('.mp4', '_stripped.mp4');
      try {
        const ffmpegPath = require('ffmpeg-static');
        if (ffmpegPath) {
          await execPromise(`"${ffmpegPath}" -loglevel error -i "${downloadedPath}" -map_metadata -1 -c:v copy -c:a copy "${strippedPath}"`);
          if (fs.existsSync(strippedPath) && fs.statSync(strippedPath).size > 1000) {
            uploadPath = strippedPath;
          }
        }
      } catch (e: any) {
        this.logger.warn(`FFmpeg strip skipped for cloud video: ${e.message}`);
      }

      // 3. Prepare Title and Description
      let title = nextVideo.title.trim();
      const customTags = (channel.customHashtags || '#Shorts #viral #fyp').trim();
      if (!title.toLowerCase().includes('#shorts')) {
        title = `${title} ${customTags}`.trim();
      }
      if (title.length > 100) {
        title = title.substring(0, 97).trim() + '...';
      }

      const description = `${nextVideo.title}\n\n${customTags}\n\nUploaded via AutoPost Cloud`.trim();
      const tagMatches = (description.match(/#([a-zA-Z0-9_]+)/g) || []).map(t => t.replace('#', ''));
      const tags = Array.from(new Set(['Shorts', 'YouTubeShorts', ...tagMatches])).slice(0, 15);

      // 4. Upload to YouTube
      const uploadRes = await this.youtubeService.uploadVideo({
        channelId: channel.id,
        filePath: uploadPath,
        title,
        description,
        tags,
        privacyStatus: (channel.privacyStatus as any) || 'public',
      });

      // 5. Update record to COMPLETED
      await this.prisma.youtubeCloudVideo.update({
        where: { id: nextVideo.id },
        data: {
          status: 'COMPLETED',
          youtubeVideoId: uploadRes.videoId,
          youtubeUrl: uploadRes.youtubeUrl,
          uploadedAt: new Date(),
          errorMessage: null,
        },
      });

      // 6. Update channel lastScheduledRun
      await this.prisma.youtubeChannel.update({
        where: { id: channel.id },
        data: { lastScheduledRun: new Date() },
      });

      const successMsg = `[YouTube Cloud] Successfully published "${nextVideo.title}" to "${channel.name}"! Link: ${uploadRes.youtubeUrl}`;
      this.logger.log(successMsg);
      await this.logsService.log('INFO', successMsg);

      return {
        success: true,
        message: successMsg,
        video: uploadRes,
      };
    } catch (err: any) {
      this.logger.error(`Failed to post cloud video "${nextVideo.title}": ${err.message}`);
      await this.prisma.youtubeCloudVideo.update({
        where: { id: nextVideo.id },
        data: {
          status: 'FAILED',
          errorMessage: err.message,
        },
      });
      await this.logsService.log('ERROR', `[YouTube Cloud] Upload failed for "${nextVideo.title}": ${err.message}`);
      return { success: false, message: err.message };
    } finally {
      if (downloadedPath && fs.existsSync(downloadedPath)) {
        try { fs.unlinkSync(downloadedPath); } catch (_) {}
      }
      if (strippedPath && fs.existsSync(strippedPath)) {
        try { fs.unlinkSync(strippedPath); } catch (_) {}
      }
    }
  }

  /**
   * Periodic scheduler: Check all active YouTube channels with scheduled times.
   */
  async processScheduledCloudUploads() {
    try {
      const channels = await this.prisma.youtubeChannel.findMany({
        where: {
          status: 'ACTIVE',
          scheduledTime: { not: null },
        },
      });

      if (channels.length === 0) return;

      // Calculate current PKT time (UTC+5)
      const nowUTC = new Date();
      const pktTime = new Date(nowUTC.getTime() + (5 * 60 * 60 * 1000));
      const pkHours = pktTime.getUTCHours();
      const pkMinutes = pktTime.getUTCMinutes();

      for (const channel of channels) {
        if (!channel.scheduledTime || channel.scheduledTime === '00:00') continue;

        const timeSlots = channel.scheduledTime.split(',').map(t => t.trim()).filter(Boolean);
        let isDue = false;

        for (const timeStr of timeSlots) {
          const [schedH, schedM] = timeStr.split(':').map(Number);
          const schedTotalMins = schedH * 60 + schedM;
          const currentTotalMins = pkHours * 60 + pkMinutes;

          if (currentTotalMins >= schedTotalMins && currentTotalMins <= schedTotalMins + 30) {
            isDue = true;
            break;
          }
        }

        if (!isDue) continue;

        // Check if already uploaded for this scheduled slot today
        const startOfDay = new Date(pktTime);
        startOfDay.setUTCHours(0, 0, 0, 0);
        const startOfDayUTC = new Date(startOfDay.getTime() - (5 * 60 * 60 * 1000));

        const uploadsToday = await this.prisma.youtubeCloudVideo.count({
          where: {
            youtubeChannelId: channel.id,
            status: 'COMPLETED',
            uploadedAt: { gte: startOfDayUTC },
          },
        });

        const maxPerDay = channel.videosPerDay || 1;
        if (uploadsToday >= maxPerDay) {
          continue;
        }

        // Avoid double posting within the same 25-minute window
        if (channel.lastScheduledRun) {
          const lastRunDiff = Date.now() - new Date(channel.lastScheduledRun).getTime();
          if (lastRunDiff < 25 * 60 * 1000) {
            continue;
          }
        }

        this.logger.log(`[YouTube Cloud Cron] Triggering scheduled post for Channel "${channel.name}"...`);
        await this.postNextCloudVideo(channel.id);
      }
    } catch (err: any) {
      this.logger.error(`Error in processScheduledCloudUploads: ${err.message}`);
    }
  }

  /**
   * Delete single video from cloud queue
   */
  async deleteCloudQueueVideo(channelId: string, videoId: string, user?: any) {
    const video = await this.prisma.youtubeCloudVideo.findFirst({
      where: { id: videoId, youtubeChannelId: channelId },
    });

    if (!video) throw new Error('Video not found in cloud queue');

    if (video.url) {
      try {
        await this.megaService.deleteFile(video.url);
      } catch (e: any) {
        this.logger.warn(`Failed to delete from Mega: ${e.message}`);
      }
    }

    await this.prisma.youtubeCloudVideo.delete({ where: { id: videoId } });
    await this.logsService.log('INFO', `Deleted video "${video.title}" from YouTube cloud queue.`);
    return { success: true };
  }

  /**
   * Clear all or selected videos from cloud queue
   */
  async clearCloudQueue(channelId: string, videoIds?: string[], user?: any) {
    const where: any = { youtubeChannelId: channelId };
    if (videoIds && videoIds.length > 0) {
      where.id = { in: videoIds };
    }

    const videos = await this.prisma.youtubeCloudVideo.findMany({ where });
    for (const v of videos) {
      if (v.url) {
        try {
          await this.megaService.deleteFile(v.url);
        } catch (_) {}
      }
    }

    await this.prisma.youtubeCloudVideo.deleteMany({ where });
    await this.logsService.log('INFO', `Cleared ${videos.length} videos from YouTube cloud queue.`);
    return { success: true, count: videos.length };
  }
}
