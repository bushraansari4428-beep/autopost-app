import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { LogsService } from '../logs/logs.service';
import { execPromise } from '../utils/exec.util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import Parser from 'rss-parser';
import { InstagramRelayClient } from './instagram-relay.client';
import { getLatestTikTokVideos, downloadTikTokVideo, getYtDlpBinaryPath } from './tiktok.scraper';
import { extractXiaohongshuVideos, downloadXiaohongshuVideo } from './xiaohongshu.scraper';
import { MegaService } from './mega.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isProcessing = false;
  private activeTestMappings = new Set<string>();
  private parser = new Parser({
    customFields: {
      item: ['media:content', 'media:thumbnail']
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'application/rss+xml, application/xml, text/xml'
    }
  });
  private rssHubInstances = [
    'https://rsshub.app',
    'https://rsshub.199898.xyz',
    'https://rss.peal.cc',
    'https://rss.qikaile.tk',
    'https://rss.shab.fun',
    'https://rss.wuding.me',
    'https://rss.nolebase.com',
    'https://rsshub.rss.ink'
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly logsService: LogsService,
    private readonly igRelayClient: InstagramRelayClient,
    private readonly megaService: MegaService,
  ) {}

  private async getYtDlpCmd(): Promise<string> {
    return await getYtDlpBinaryPath();
  }

  public formatFacebookCaption(rawCaption?: string, platform?: string, url?: string, customHashtags?: string): string {
    const plat = (platform || '').toUpperCase();
    const cleanUrl = (url || '').toLowerCase();

    // Suffix hashtags: if customHashtags are provided, use them; otherwise fallback to #FBReels #Reels
    let tags = (customHashtags || '').trim();
    if (!tags) {
      tags = '#FBReels #Reels';
    }

    // Check if source is Chinese/Asian platform (Kuaishou or Xiaohongshu / RedNote)
    const isChinesePlatform = 
      plat === 'KUAISHOU' || 
      plat === 'XIAOHONGSHU' || 
      cleanUrl.includes('kuaishou') || 
      cleanUrl.includes('xiaohongshu') || 
      cleanUrl.includes('xhslink') || 
      cleanUrl.includes('rednote');

    // Rule 1: For KUAISHOU or XIAOHONGSHU (RedNote), ALWAYS delete entire original caption and output tags
    if (isChinesePlatform) {
      return tags;
    }

    // Rule 2 & 3: For TikTok, YouTube Shorts, Instagram, Mega Cloud, Local
    let caption = (rawCaption || '').trim();

    // If caption is generic fallback (e.g. "TikTok Video 123456" or "Video 12345"), treat as empty
    if (/^(TikTok|Instagram|Kuaishou|Xiaohongshu|YouTube)?\s*Video\s*\d+$/i.test(caption)) {
      caption = '';
    }

    if (caption) {
      // Extract first line if multiple lines
      let firstLine = caption.split('\n')[0].trim();

      // Extract text before pipe '|' or dash if followed by hashtags
      if (firstLine.includes('|')) {
        const parts = firstLine.split('|');
        if (parts[0].replace(/#\S+/g, '').trim()) {
          firstLine = parts[0].trim();
        }
      }

      // Remove ALL hashtags from the first line text
      const cleanText = firstLine.replace(/#\S+/g, '').replace(/\s+/g, ' ').trim();

      if (cleanText) {
        // Output clean first line + custom hashtags
        return `${cleanText} ${tags}`;
      }
    }

    // Rule 3: If no text caption (only hashtags or empty)
    return tags;
  }

  /**
   * Cleans and normalizes a title/caption string for cross-platform comparison
   */
  public cleanTitleForComparison(text?: string | null): string {
    if (!text) return '';
    return text
      .toLowerCase()
      .replace(/#[\w\u0590-\u05ff]+/g, '') // remove hashtags (#FBReels, #reels, #fyp, etc.)
      .replace(/https?:\/\/\S+/g, '')      // remove URLs
      .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu, '') // remove emojis
      .replace(/[^\w\s\u4e00-\u9fa5]/g, '') // remove punctuation
      .replace(/\s+/g, ' ')               // collapse whitespace
      .trim();
  }

  /**
   * Checks if two titles are cross-platform duplicates
   */
  public isDuplicateTitle(titleA?: string | null, titleB?: string | null): boolean {
    const cleanA = this.cleanTitleForComparison(titleA);
    const cleanB = this.cleanTitleForComparison(titleB);
    if (!cleanA || !cleanB) return false;

    // 1. Exact clean match
    if (cleanA === cleanB) return true;

    // 2. Substring containment for titles with meaningful length (>= 12 characters)
    if (cleanA.length >= 12 && cleanB.length >= 12) {
      if (cleanA.includes(cleanB) || cleanB.includes(cleanA)) return true;
    }

    // 3. High word overlap (Dice coefficient on words)
    const wordsA = new Set(cleanA.split(' ').filter(w => w.length > 2));
    const wordsB = new Set(cleanB.split(' ').filter(w => w.length > 2));
    if (wordsA.size >= 2 && wordsB.size >= 2) {
      let intersection = 0;
      for (const w of wordsA) {
        if (wordsB.has(w)) intersection++;
      }
      const overlap = (2 * intersection) / (wordsA.size + wordsB.size);
      if (overlap >= 0.75) return true;
    }

    return false;
  }

  async testMapping(mappingId: string) {
    const mapping = await this.prisma.mapping.findUnique({
      where: { id: mappingId },
      include: { source: true }
    });
    if (!mapping) return { success: false, message: 'Mapping not found' };

    // Single-Instance Lock: Prevent duplicate concurrent test executions
    if (this.activeTestMappings.has(mappingId)) {
      return { 
        success: true, 
        message: 'A test is already currently in progress for this mapping. Please wait a moment for it to complete.' 
      };
    }

    this.activeTestMappings.add(mappingId);
    await this.logsService.log('INFO', `Starting test extraction for the selected page...`);
    await this.logsService.log('INFO', 'Test request initiated successfully.');
    
    // Execute strictly single background run on server
    this.executeTestMapping(mappingId)
      .catch(err => {
        this.logger.error(`Error in executeTestMapping: ${err.message}`);
      })
      .finally(() => {
        this.activeTestMappings.delete(mappingId);
      });

    let successMessage = 'Test successfully started in the background! 1 video is being uploaded to your Facebook page.';
    if (mapping.source.platform === 'MEGA_CLOUD') {
      successMessage = '1 video from Mega Cloud is being uploaded to your Facebook page...';
    }

    return { 
      success: true, 
      message: successMessage 
    };
  }

  async executeTestMapping(mappingId: string) {
    const mapping = await this.prisma.mapping.findUnique({
      where: { id: mappingId },
      include: { source: true, facebookPage: true }
    });
    if (!mapping) return { success: false, message: 'Mapping not found' };

    const pageName = mapping.facebookPage?.name || 'Facebook Page';
    await this.logsService.log('INFO', `Starting TEST for mapping: ${mapping.source.name} (${mapping.source.platform}) -> ${pageName}`);

    if (mapping.source.platform === 'LOCAL_FOLDER') {
      await this.logsService.log('INFO', `Test skipped: LOCAL_FOLDER mappings are managed by your Desktop App.`);
      return { success: true, message: 'Local PC Folders are connected properly. Please use the Desktop app to upload videos.' };
    }

    try {
      // 1. Run monitorSource with isTest = true to discover and queue the oldest unposted video
      await this.monitorSource(mapping.source.id, [mapping.id], true);

      // 2. Process pending uploads immediately
      try {
        await this.processPendingUploads();
      } catch (e) {
        console.error("Upload error during test:", e);
      }

      return { success: true, message: 'Test execution finished! The oldest available video was queued and processed. Check Logs for status.' };
    } catch (e: any) {
      await this.logsService.log('ERROR', `Test failed: ${e.message}`);
      return { success: false, message: e.message };
    }
  }

  async monitorSource(sourceId: string, dueMappingIds?: string[], isTest = false) {
    this.logger.log(`Processing monitoring job for source: ${sourceId}`);
    
    const source = await this.prisma.source.findUnique({ 
      where: { id: sourceId },
      include: { mappings: true }
    });
    if (!source) {
      this.logger.error(`Source not found: ${sourceId}`);
      return;
    }

    if (source.platform === 'LOCAL_FOLDER') {
      this.logger.log(`Skipping backend monitor for LOCAL_FOLDER source ${sourceId}. Managed by desktop script.`);
      return;
    }

    if (source.platform === 'MEGA_CLOUD') {
      this.logger.log(`Processing Cloud Upload queue for source: ${sourceId}`);
      const targetMappings = dueMappingIds ? source.mappings.filter((m: any) => dueMappingIds.includes(m.id)) : source.mappings;
      
      for (const mapping of targetMappings) {
        // Calculate the exact start of the scheduled slot in PKT today
        const now = new Date();
        const pktTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
        
        let startOfSlotUTC = new Date(pktTime.getTime() - (5 * 60 * 60 * 1000));
        
        if (mapping.scheduledTime) {
          const timeSlots = mapping.scheduledTime.split(',').map((t: string) => t.trim()).filter(Boolean);
          const currentTotalMins = pktTime.getUTCHours() * 60 + pktTime.getUTCMinutes();
          let activeSlot = timeSlots[0]; // fallback
          
          for (const timeStr of timeSlots) {
            const [schedH, schedM] = timeStr.split(':').map(Number);
            const schedTotalMins = schedH * 60 + schedM;
            if (currentTotalMins >= schedTotalMins && currentTotalMins <= schedTotalMins + 30) {
              activeSlot = timeStr;
              break;
            }
          }
          
          const [schedH, schedM] = activeSlot.split(':').map(Number);
          const slotStartPkt = new Date(pktTime);
          slotStartPkt.setUTCHours(schedH, schedM, 0, 0);
          startOfSlotUTC = new Date(slotStartPkt.getTime() - (5 * 60 * 60 * 1000));
        } else {
          // Fallback if no schedule (should not happen for MEGA_CLOUD)
          pktTime.setUTCHours(0, 0, 0, 0);
          startOfSlotUTC = new Date(pktTime.getTime() - (5 * 60 * 60 * 1000));
        }
        
        const uploadsThisSlot = await this.prisma.uploadHistory.count({
           where: {
             facebookPageId: mapping.facebookPageId,
             createdAt: { gte: startOfSlotUTC },
             video: { sourceId: source.id },
             status: { not: 'FAILED' },
             OR: [
                { facebookPostId: null },
                { facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } }
             ]
           }
        });
        
        if (!isTest) {
          const allowedToQueue = (mapping.videosPerDay || 1) - uploadsThisSlot;
          
          if (allowedToQueue <= 0) {
             this.logger.log(`Slot quota reached for mapping ${mapping.id}. Uploads this slot: ${uploadsThisSlot}`);
             // Mark as completed for today so the schedule doesn't keep hitting
             if (mapping.scheduledTime) {
               await this.prisma.mapping.update({
                 where: { id: mapping.id },
                 data: { lastScheduledRun: new Date() }
               });
             }
             continue;
          }

          // To ensure a 2-3 minute gap, we check the most recent upload attempt for this mapping
          const lastUpload = await this.prisma.uploadHistory.findFirst({
             where: { 
               facebookPageId: mapping.facebookPageId, 
               video: { sourceId: source.id },
               createdAt: { gte: startOfSlotUTC },
               OR: [
                  { facebookPostId: null },
                  { facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } }
               ]
             },
             orderBy: { createdAt: 'desc' }
          });

          if (lastUpload) {
             const minsSinceLastUpload = (Date.now() - lastUpload.createdAt.getTime()) / 60000;
             if (minsSinceLastUpload < 2) {
                 this.logger.log(`Waiting for gap. ${minsSinceLastUpload.toFixed(1)} mins elapsed out of 2 mins for mapping ${mapping.id}.`);
                 continue; // skip this cron run, wait for the next minute tick
             }
          }
        }

        // Queue exactly ONE video per cron run to respect the gap
        const unuploadedVideos = await this.prisma.video.findMany({
          where: {
            sourceId: source.id,
            uploads: { 
              none: { 
                facebookPageId: mapping.facebookPageId, 
                OR: [
                  { status: 'PENDING' },
                  { status: 'PROCESSING' },
                  { status: 'COMPLETED', facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } }
                ]
              } 
            }
          },
          orderBy: { createdAt: 'asc' },
          take: 1
        });

        if (unuploadedVideos && unuploadedVideos.length > 0) {
          for (const video of unuploadedVideos) {
            await this.prisma.uploadHistory.create({
              data: {
                videoId: video.id,
                facebookPageId: mapping.facebookPageId,
                status: 'PENDING'
              }
            });
            this.logsService.log('INFO', `Cloud Auto-Poster: Queued video '${video.title}' to post!`);
          }
        }
        // Removed premature lastScheduledRun update
      }
      return;
    }

    try {
      let urlsToScan = [source.url];
      if (source.platform === 'YOUTUBE' && !source.url.includes('/shorts') && !source.url.includes('/videos') && source.url.includes('@')) {
        // Automatically check both videos and shorts tabs for YouTube channels
        urlsToScan = [
          source.url.replace(/\/$/, '') + '/videos',
          source.url.replace(/\/$/, '') + '/shorts'
        ];
      }

      let latestVideos: any[] = [];
      const cleanUrl = (source.url || '').toLowerCase();
      const isYouTubeUrl = cleanUrl.includes('youtube.com') || cleanUrl.includes('youtu.be') || cleanUrl.includes('/channel/uc') || cleanUrl.startsWith('uc');
      const isTikTokUrl = cleanUrl.includes('tiktok.com');
      const isInstagramUrl = cleanUrl.includes('instagram.com');
      const isXhsUrl = cleanUrl.includes('xiaohongshu.com') || cleanUrl.includes('xhslink') || cleanUrl.includes('rednote');
      const isKuaishouUrl = cleanUrl.includes('kuaishou.com');

      // 1. YouTube Platform Extraction (All RSS entries + Full Channel metadata)
      if (isYouTubeUrl || source.platform === 'YOUTUBE') {
        let channelId = '';
        if (source.url.startsWith('UC')) {
          channelId = source.url.trim();
        } else if (source.url.includes('/channel/')) {
          channelId = source.url.split('/channel/')[1].split('/')[0].split('?')[0];
        }

        if (!channelId && source.url.includes('/@')) {
          try {
            const handle = source.url.split('/@')[1].split('/')[0].split('?')[0];
            const handleRes = await fetch(`https://www.youtube.com/@${handle}`);
            if (handleRes.ok) {
              const html = await handleRes.text();
              const m = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/) || html.match(/itemprop="channelId" content="(UC[a-zA-Z0-9_-]+)"/);
              if (m && m[1]) channelId = m[1];
            }
          } catch (_) {}
        }

        if (channelId) {
          const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
          this.logger.log(`Cron: Fetching complete RSS feed for YouTube channel: ${channelId}`);
          try {
            const rssRes = await fetch(rssUrl);
            if (rssRes.ok) {
              const xml = await rssRes.text();
              const entries = xml.split('<entry>').slice(1);
              for (const entry of entries) {
                const videoIdMatch = entry.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
                const titleMatch = entry.match(/<title>(.*?)<\/title>/);
                const pubMatch = entry.match(/<published>(.*?)<\/published>/);
                if (videoIdMatch && videoIdMatch[1]) {
                  const pubDate = pubMatch && pubMatch[1] ? new Date(pubMatch[1]) : new Date();
                  latestVideos.push({
                    id: videoIdMatch[1],
                    title: titleMatch && titleMatch[1] ? titleMatch[1].replace(/<[^>]+>/g, '') : 'YouTube Video',
                    url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
                    publishedAt: pubDate,
                    timestamp: Math.floor(pubDate.getTime() / 1000)
                  });
                }
              }
              this.logger.log(`Extracted ${latestVideos.length} videos from YouTube channel RSS with exact published dates.`);
            }
          } catch (e: any) {
            this.logger.warn(`Cron RSS feed failed: ${e.message}`);
          }
        }
      }

      // 2. Instagram Extraction
      if (latestVideos.length === 0 && (isInstagramUrl || source.platform === 'INSTAGRAM')) {
        try {
          const username = source.url.split('instagram.com/')[1]?.split('/')[0] || 'moromorotv';
          const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
          let foundVideo = null;

          if (braveApiKey) {
            this.logger.log(`Searching Brave API for latest Reel by ${username}...`);
            const query = `site:instagram.com "${username}"`;
            const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
            const res = await fetch(searchUrl, {
              headers: { 'Accept': 'application/json', 'X-Subscription-Token': braveApiKey }
            });
            if (res.ok) {
              const data = await res.json();
              const results = data.web?.results || [];
              for (const result of results) {
                if (result.url && result.url.includes('instagram.com/')) {
                  const shortcodeMatch = result.url.match(/(reel|p)\/([^\/]+)/);
                  if (shortcodeMatch) {
                    foundVideo = {
                      id: shortcodeMatch[2],
                      url: result.url,
                      title: `Instagram Post`,
                      timestamp: Math.floor(Date.now() / 1000)
                    };
                    break;
                  }
                }
              }
            }
          }

          if (!foundVideo) {
            foundVideo = await this.pollInstagramProfile(username);
          }
          if (foundVideo) {
            latestVideos.push(foundVideo);
          }
        } catch (e: any) {
          this.logsService.log('ERROR', `Instagram polling failed: ${e.message}`);
        }
      }

      // 3. Xiaohongshu / RedNote Extraction
      if (latestVideos.length === 0 && (isXhsUrl || source.platform === 'XIAOHONGSHU')) {
        this.logger.log(`Executing RedNote/Xiaohongshu multi-layer extraction for ${source.url}...`);
        const xhsVideos = await extractXiaohongshuVideos(source.url, 30);
        if (xhsVideos.length > 0) {
          latestVideos.push(...xhsVideos);
        }
      }

      // 4. Kuaishou Extraction
      if (latestVideos.length === 0 && (isKuaishouUrl || source.platform === 'KUAISHOU')) {
        const urlParts = source.url.split('/').filter(Boolean);
        const userId = urlParts[urlParts.length - 1];
        this.logger.log(`Scraping SSR HTML for latest ${source.platform} video for user ${userId}...`);
        const ssrUrl = await this.scrapeLatestFromSSR(source.platform, source.url, userId);
        if (ssrUrl) {
          latestVideos.push({
            id: 'ssr_' + Date.now(),
            url: ssrUrl,
            title: `${source.platform} Video`,
            timestamp: Math.floor(Date.now() / 1000)
          });
        }
      }

      // 5. TikTok Native Extraction
      if (latestVideos.length === 0 && (isTikTokUrl || source.platform === 'TIKTOK')) {
        this.logger.log(`Scanning TikTok source & extracting original captions for: ${source.url}`);
        await this.logsService.log('INFO', `Scanning TikTok source: ${source.url}`);
        const tkVideos = await this.extractTikTokVideos(source.url, 100);
        if (tkVideos.length > 0) {
          latestVideos.push(...tkVideos);
          this.logger.log(`Found TikTok video(s) via native scraper. Count: ${tkVideos.length}`);
          await this.logsService.log('INFO', `Found ${tkVideos.length} TikTok video(s) from creator profile.`);
        }
      }

      await this.logsService.log('INFO', `Discovered ${latestVideos.length} video(s) from source ${source.name}. Processing oldest unposted videos...`);
      
      // 1. Save all newly discovered videos into the Database with 100% exact publication timestamps
      for (const videoData of latestVideos) {
        try {
          const platformVideoId = String(videoData.id || '');
          if (!platformVideoId) continue;
          
          let videoRecord = await this.prisma.video.findFirst({
            where: {
              sourceId: source.id,
              originalId: platformVideoId
            }
          });

          // Calculate genuine, exact publishedAt date
          let publishedAt: Date | null = null;
          if (source.platform === 'TIKTOK' && /^\d{15,22}$/.test(platformVideoId)) {
            try {
              const tsFromId = Number(BigInt(platformVideoId) >> 32n);
              if (tsFromId > 1500000000 && tsFromId < 2000000000) {
                publishedAt = new Date(tsFromId * 1000);
              }
            } catch (_) {}
          }
          
          if (!publishedAt) {
            let ts = videoData.timestamp || videoData.createTime;
            if (!ts && videoData.upload_date && typeof videoData.upload_date === 'string' && videoData.upload_date.length === 8) {
              const y = parseInt(videoData.upload_date.substring(0, 4), 10);
              const m = parseInt(videoData.upload_date.substring(4, 6), 10) - 1;
              const d = parseInt(videoData.upload_date.substring(6, 8), 10);
              publishedAt = new Date(y, m, d);
            } else if (ts) {
              publishedAt = new Date(ts * 1000);
            } else {
              publishedAt = new Date();
            }
          }

          if (!videoRecord) {
            const formattedCaption = this.formatFacebookCaption(videoData.description || videoData.title || videoData.caption, source.platform, source.url);
            videoRecord = await this.prisma.video.create({
              data: {
                title: formattedCaption,
                description: formattedCaption,
                originalId: platformVideoId,
                publishedAt: publishedAt,
                url: videoData.webpage_url || videoData.url || '',
                sourceId: source.id,
              }
            });
            this.logsService.log('INFO', `Discovered video: ${videoData.title || videoData.caption} (Published: ${publishedAt.toISOString().split('T')[0]})`);
          } else if (publishedAt) {
            // Update existing video timestamp if it was previously inaccurate
            if (Math.abs(videoRecord.publishedAt.getTime() - publishedAt.getTime()) > 86400000) {
              await this.prisma.video.update({
                where: { id: videoRecord.id },
                data: { publishedAt: publishedAt }
              });
            }
          }
        } catch (e: any) {
          this.logger.error(`Error saving discovered video: ${e.message}`);
        }
      }

      // 2. Process Target Mappings in Oldest-to-Newest Sequence with Slot Limits
      const targetMappings = dueMappingIds 
        ? source.mappings.filter((m: any) => dueMappingIds.includes(m.id))
        : source.mappings;

      for (const mapping of targetMappings) {
        // Calculate PKT slot start time
        const now = new Date();
        const pktTime = new Date(now.getTime() + (5 * 60 * 60 * 1000));
        let startOfSlotUTC = new Date(pktTime.getTime() - (5 * 60 * 60 * 1000));
        
        if (mapping.scheduledTime && mapping.scheduledTime !== '00:00') {
          const timeSlots = mapping.scheduledTime.split(',').map((t: string) => t.trim()).filter(Boolean);
          const currentTotalMins = pktTime.getUTCHours() * 60 + pktTime.getUTCMinutes();
          let activeSlot = timeSlots[0]; // fallback
          
          for (const timeStr of timeSlots) {
            const [schedH, schedM] = timeStr.split(':').map(Number);
            const schedTotalMins = schedH * 60 + schedM;
            if (currentTotalMins >= schedTotalMins && currentTotalMins <= schedTotalMins + 30) {
              activeSlot = timeStr;
              break;
            }
          }
          
          const [schedH, schedM] = activeSlot.split(':').map(Number);
          const slotStartPkt = new Date(pktTime);
          slotStartPkt.setUTCHours(schedH, schedM, 0, 0);
          startOfSlotUTC = new Date(slotStartPkt.getTime() - (5 * 60 * 60 * 1000));
        } else {
          // If no schedule (or 00:00), calculate start of PKT day
          const slotStartPkt = new Date(pktTime);
          slotStartPkt.setUTCHours(0, 0, 0, 0);
          startOfSlotUTC = new Date(slotStartPkt.getTime() - (5 * 60 * 60 * 1000));
        }

        const uploadsThisSlot = await this.prisma.uploadHistory.count({
          where: {
            facebookPageId: mapping.facebookPageId,
            createdAt: { gte: startOfSlotUTC },
            video: { sourceId: source.id },
            status: { not: 'FAILED' }
          }
        });

        if (!isTest) {
          const allowedToQueue = (mapping.videosPerDay || 1) - uploadsThisSlot;
          
          if (allowedToQueue <= 0) {
            this.logger.log(`Slot quota reached for mapping ${mapping.id}. Uploads this slot: ${uploadsThisSlot} / Limit: ${mapping.videosPerDay || 1}`);
            continue;
          }

          // Check 2-minute gap between uploads
          const lastUpload = await this.prisma.uploadHistory.findFirst({
            where: {
              facebookPageId: mapping.facebookPageId,
              video: { sourceId: source.id },
              createdAt: { gte: startOfSlotUTC }
            },
            orderBy: { createdAt: 'desc' }
          });

          if (lastUpload) {
            const minsSinceLastUpload = (Date.now() - lastUpload.createdAt.getTime()) / 60000;
            if (minsSinceLastUpload < 2) {
              this.logger.log(`Waiting for 2-min gap. ${minsSinceLastUpload.toFixed(1)} mins elapsed for mapping ${mapping.id}.`);
              continue;
            }
          }
        }

        // 1. Fetch all past uploads to this Facebook Page across ALL sources to prevent cross-platform duplicates
        const pastUploads = await this.prisma.uploadHistory.findMany({
          where: {
            facebookPageId: mapping.facebookPageId,
            status: { in: ['COMPLETED', 'PROCESSING', 'PENDING'] }
          },
          select: {
            video: {
              select: { id: true, title: true, description: true }
            }
          }
        });

        // 2. Fetch candidate unposted videos for this mapping from this source, ordered OLDEST to NEWEST
        const candidateVideos = await this.prisma.video.findMany({
          where: {
            sourceId: source.id,
            uploads: {
              none: {
                facebookPageId: mapping.facebookPageId,
                OR: [
                  { status: 'PENDING' },
                  { status: 'PROCESSING' },
                  { status: 'COMPLETED' }
                ]
              }
            }
          },
          orderBy: [
            { publishedAt: 'asc' },
            { createdAt: 'asc' }
          ],
          take: 100
        });

        let oldestUnpostedVideo: any = null;

        for (const candidate of candidateVideos) {
          // Check if candidate video matches ANY previously posted video on this Facebook Page
          const duplicateMatch = pastUploads.find(u => 
            u.video && (
              this.isDuplicateTitle(candidate.title, u.video.title) ||
              this.isDuplicateTitle(candidate.description, u.video.title) ||
              this.isDuplicateTitle(candidate.title, u.video.description)
            )
          );

          if (duplicateMatch && duplicateMatch.video) {
            // Auto-mark duplicate candidate as COMPLETED so it is permanently skipped and never repeated!
            this.logger.log(`Cross-Platform Deduplication: Skipping duplicate video '${candidate.title}' (already posted as '${duplicateMatch.video.title}')`);
            await this.logsService.log('INFO', `Deduplication: Skipped duplicate video '${candidate.title}' (already posted on this page).`);
            
            await this.prisma.uploadHistory.create({
              data: {
                videoId: candidate.id,
                facebookPageId: mapping.facebookPageId,
                status: 'COMPLETED',
                errorMessage: `Cross-platform duplicate of '${duplicateMatch.video.title}'`
              }
            });
            continue; // Continue to next candidate
          }

          // Found a genuinely unique unposted video!
          oldestUnpostedVideo = candidate;
          break;
        }

        if (oldestUnpostedVideo) {
          await this.prisma.uploadHistory.create({
            data: {
              videoId: oldestUnpostedVideo.id,
              facebookPageId: mapping.facebookPageId,
              status: 'PENDING'
            }
          });
          this.logsService.log('INFO', `Auto-Poster: Queued oldest unposted video '${oldestUnpostedVideo.title}' (Published: ${oldestUnpostedVideo.publishedAt ? oldestUnpostedVideo.publishedAt.toISOString().split('T')[0] : 'Unknown'}) to Facebook Page!`);
        } else {
          this.logger.log(`All discovered videos for source ${source.name} have already been uploaded (or deduplicated) to page ${mapping.facebookPageId}.`);
          await this.logsService.log('INFO', `All discovered videos for source ${source.name} have already been posted to your Facebook Page.`);
        }
      }

      await this.prisma.source.update({
        where: { id: source.id },
        data: { lastChecked: new Date() }
      });
      
    } catch (error) {
      this.logger.error(`Failed to monitor source ${source.id}: ${error.message}`);
    }
  }

  async fixStuckUploads() {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const updated = await this.prisma.uploadHistory.updateMany({
        where: { 
          status: 'PROCESSING',
          createdAt: { lt: oneHourAgo }
        },
        data: { 
          status: 'FAILED', 
          errorMessage: 'System self-healing: Reset stuck processing record' 
        }
      });
      if (updated.count > 0) {
        this.logger.warn(`Self-healing: Reset ${updated.count} stuck records to FAILED.`);
      }

      // Repair existing TikTok videos in the DB that had placeholder publishedAt
      const tiktokVideos = await this.prisma.video.findMany({
        where: {
          source: { platform: 'TIKTOK' }
        },
        select: { id: true, originalId: true, publishedAt: true }
      });

      for (const tv of tiktokVideos) {
        if (tv.originalId && /^\d{15,22}$/.test(tv.originalId)) {
          try {
            const tsFromId = Number(BigInt(tv.originalId) >> 32n);
            if (tsFromId > 1500000000 && tsFromId < 2000000000) {
              const realDate = new Date(tsFromId * 1000);
              if (Math.abs(tv.publishedAt.getTime() - realDate.getTime()) > 86400000) {
                await this.prisma.video.update({
                  where: { id: tv.id },
                  data: { publishedAt: realDate }
                });
              }
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      this.logger.error(`Error in self-healing routine: ${e.message}`);
    }
  }

  async processLocalVideo(facebookPageId: string, filePath: string, videoTitle: string) {
    try {
      const page = await this.prisma.facebookPage.findUnique({
        where: { id: facebookPageId }
      });

      if (!page || page.status !== 'ACTIVE') {
        throw new Error('Active Facebook Page not found with that Facebook Page ID');
      }

      this.logsService.log('INFO', `Starting Local Upload for page ${page.name}`);
      
      const finalDescription = this.formatFacebookCaption(videoTitle, 'LOCAL', '');
      
      const fbData: any = await new Promise((resolve, reject) => {
         const { spawn } = require('child_process');
         const curl = spawn('curl', [
            '-s', '-m', '300', '-X', 'POST',
            `https://graph-video.facebook.com/v19.0/${page.pageId}/videos`,
            '-F', `access_token=${page.accessToken}`,
            '-F', `description=${finalDescription}`,
            '-F', `source=@${filePath}`
         ]);
         
         let out = '';
         let errOut = '';
         curl.stdout.on('data', (d: any) => out += d);
         curl.stderr.on('data', (d: any) => errOut += d);
         curl.on('close', (code: number) => {
            if (code === 0) {
               try { 
                  const parsed = JSON.parse(out);
                  if (parsed.error) reject(new Error(parsed.error.message));
                  else resolve(parsed); 
               } catch(e) { reject(new Error('Failed to parse response')); }
            } else reject(new Error(`cURL failed. ${errOut}`));
         });
      });

      // Link to the user's dynamic LOCAL_FOLDER source if mapped
      let localSource: any = await this.prisma.mapping.findFirst({
        where: { 
          facebookPageId: page.id, 
          source: { platform: 'LOCAL_FOLDER' } 
        },
        include: { source: true }
      }).then(res => res?.source);

      if (!localSource) {
        localSource = await this.prisma.source.findFirst({
          where: { platform: 'LOCAL_FOLDER', url: 'local://uploader' }
        });
        
        if (!localSource) {
          localSource = await this.prisma.source.create({
            data: {
              platform: 'LOCAL_FOLDER',
              name: 'Local Desktop Uploader',
              url: 'local://uploader',
              userId: page.userId,
            }
          });
        }
      }

      const video = await this.prisma.video.create({
        data: {
          sourceId: localSource.id,
          originalId: `local_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          title: videoTitle,
          description: finalDescription,
          url: `local://${videoTitle}`,
          publishedAt: new Date(),
        }
      });

      await this.prisma.uploadHistory.create({
        data: {
          videoId: video.id,
          facebookPageId: page.id,
          status: 'COMPLETED',
          facebookPostId: fbData.id
        }
      });

      this.logsService.log('INFO', `Successfully uploaded local video ${videoTitle} to page ${page.name}`);
      return { success: true, postId: fbData.id };
    } catch (e: any) {
      this.logger.error(`Error in processLocalVideo: ${e.message}`, e.stack);
      this.logsService.log('ERROR', `Local upload failed: ${e.message}`);
      throw e;
    }
  }

  async processCloudUpload(facebookPageId: string, videoTitle: string, buffer: Buffer) {
    try {
      const page = await this.prisma.facebookPage.findUnique({
        where: { id: facebookPageId }
      });

      if (!page || page.status !== 'ACTIVE') {
        throw new Error('Active Facebook Page not found with that Facebook Page ID');
      }

      this.logsService.log('INFO', `Starting Cloud Upload for page ${page.name}`);
      
      let cloudSource: any = await this.prisma.source.findFirst({
        where: { platform: 'MEGA_CLOUD', url: `cloud://${page.pageId}` }
      });
      
      if (!cloudSource) {
        cloudSource = await this.prisma.source.create({
          data: {
            platform: 'MEGA_CLOUD',
            name: `Cloud Upload (${page.name})`,
            url: `cloud://${page.pageId}`,
            userId: page.userId,
          }
        });
      } else if (cloudSource.name === 'Cloud Upload') {
        cloudSource = await this.prisma.source.update({
          where: { id: cloudSource.id },
          data: { name: `Cloud Upload (${page.name})` }
        });
      }

      // Ensure a mapping exists so the user can set a schedule for it
      let mapping = await this.prisma.mapping.findFirst({
        where: { sourceId: cloudSource.id, facebookPageId: page.id }
      });

      if (!mapping) {
        await this.prisma.mapping.create({
          data: {
            sourceId: cloudSource.id,
            facebookPageId: page.id,
            scheduledTime: '12:00' // Default schedule
          }
        });
      }

      const ext = '.mp4';
      const filename = `cloud_${Date.now()}_${Math.random().toString(36).substring(7)}${ext}`;
      
      let megaEmail, megaPassword;
      if (page.userId) {
        const pageUser = await this.prisma.user.findUnique({ where: { id: page.userId } });
        if (pageUser) {
          if (pageUser.role !== 'ADMIN' && (!pageUser.megaEmail || !pageUser.megaPassword)) {
            throw new Error('Mega Cloud credentials are not configured. Please update your profile.');
          }
          megaEmail = pageUser.megaEmail;
          megaPassword = pageUser.megaPassword;
        }
      }

      // Upload buffer to Mega
      const megaLink = await this.megaService.uploadFile(filename, buffer, megaEmail || undefined, megaPassword || undefined);

      const finalDescription = this.formatFacebookCaption(videoTitle, 'MEGA_CLOUD', '');

      const video = await this.prisma.video.create({
        data: {
          sourceId: cloudSource.id,
          originalId: filename,
          title: videoTitle,
          description: finalDescription,
          url: megaLink,
          publishedAt: new Date(),
        }
      });

      await this.prisma.uploadHistory.create({
        data: {
          videoId: video.id,
          facebookPageId: page.id,
          status: 'COMPLETED',
          facebookPostId: 'MEGA_CLOUD_UPLOAD'
        }
      });

      this.logsService.log('INFO', `Successfully saved cloud video ${videoTitle} to Mega. It will be posted at the scheduled time!`);
      return { success: true, message: 'Video uploaded to Cloud and scheduled successfully!' };
    } catch (e: any) {
      this.logger.error(`Error in processCloudUpload: ${e.message}`, e.stack);
      this.logsService.log('ERROR', `Cloud upload failed: ${e.message}`);
      throw e;
    }
  }

  async deleteCloudQueue(facebookPageId: string) {
    try {
      const page = await this.prisma.facebookPage.findUnique({
        where: { id: facebookPageId }
      });

      if (!page) {
        throw new Error('Facebook page not found');
      }

      let megaEmail, megaPassword;
      if (page.userId) {
        const pageUser = await this.prisma.user.findUnique({ where: { id: page.userId } });
        if (pageUser) {
          if (pageUser.role !== 'ADMIN' && (!pageUser.megaEmail || !pageUser.megaPassword)) {
            throw new Error('Mega Cloud credentials are not configured.');
          }
          megaEmail = pageUser.megaEmail;
          megaPassword = pageUser.megaPassword;
        }
      }

      // Find videos in cloud queue
      const videos = await this.prisma.video.findMany({
        where: {
          source: { platform: 'MEGA_CLOUD', url: `cloud://${page.pageId}` },
          uploads: {
            none: {
              facebookPageId: page.id,
              status: 'COMPLETED',
              facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' }
            }
          }
        }
      });

      if (videos.length === 0) {
        return { success: true, message: 'No pending videos found to delete.' };
      }

      let deleteCount = 0;
      for (const video of videos) {
        try {
          if (video.url) {
            await this.megaService.deleteFile(video.url, megaEmail || undefined, megaPassword || undefined);
          }
          await this.prisma.uploadHistory.deleteMany({ where: { videoId: video.id } });
          await this.prisma.video.delete({ where: { id: video.id } });
          deleteCount++;
        } catch (err: any) {
          this.logger.error(`Failed to delete video ${video.title}: ${err.message}`);
        }
      }

      this.logsService.log('INFO', `Successfully deleted ${deleteCount} queued video(s) from Mega Cloud for page ${page.name}`);
      return { success: true, message: `Successfully deleted ${deleteCount} video(s) from cloud queue.` };
    } catch (e: any) {
      this.logger.error(`Error in deleteCloudQueue: ${e.message}`, e.stack);
      this.logsService.log('ERROR', `Failed to delete cloud queue videos: ${e.message}`);
      throw e;
    }
  }



  async processPendingUploads() {
    if (this.isProcessing) {
      this.logsService.log('WARN', 'Already processing uploads, skipping this cycle. Waiting for current upload to finish.');
      return;
    }
    
    this.isProcessing = true;
    try {
      while (true) {
        const pendingUpload = await this.prisma.uploadHistory.findFirst({
          where: { status: 'PENDING' },
          include: { video: true, facebookPage: true },
          orderBy: { createdAt: 'asc' }
        });

        if (!pendingUpload) {
          break; // Queue is empty, exit loop
        }

        this.logger.log(`Processing upload: ${pendingUpload.id} for video: ${pendingUpload.video.title}`);
        
        await this.prisma.uploadHistory.update({
          where: { id: pendingUpload.id },
          data: { status: 'PROCESSING' }
        });

        try {
          await this.downloadAndUpload(pendingUpload);
        } catch (err: any) {
          this.logsService.log('ERROR', `Upload failed for ${pendingUpload.video.title}: ${err.message}`);
          await this.prisma.uploadHistory.update({
            where: { id: pendingUpload.id },
            data: { status: 'FAILED', errorMessage: err.message }
          });
        }
      }

    } finally {
      this.isProcessing = false;
    }
  }

  private async delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async nativeDownloadAndUpload(uploadHistory: any) {
    const video = uploadHistory.video;
    const pageId = uploadHistory.facebookPage.pageId;
    const accessToken = uploadHistory.facebookPage.accessToken;
    
    this.logsService.log('INFO', `Preparing to upload video: ${video.title}...`);
    
    const ytId = video.originalId.replace('test_', '').split('_')[0];
    const targetUrl = video.url ? video.url : `https://www.youtube.com/watch?v=${ytId}`;
    const encodedUrl = encodeURIComponent(targetUrl);
    
    let videoUrl = null;

    if (targetUrl.includes('mega.nz') || targetUrl.includes('mega.io') || uploadHistory.video?.source?.platform === 'MEGA_CLOUD') {
       this.logger.log(`Downloading video from Mega.nz: ${targetUrl}`);
       const downloadedPath = await this.megaService.downloadFile(targetUrl);
       if (downloadedPath && fs.existsSync(downloadedPath)) {
          this.logsService.log('INFO', `Successfully downloaded video from Mega.nz to ${downloadedPath}`);
          videoUrl = 'local://' + downloadedPath; // signal that it's already a local file
       } else {
          throw new Error(`Failed to download video from Mega.nz: ${targetUrl}`);
       }
    } else if (targetUrl.includes('tiktok.com')) {
      this.logger.log(`Extracting HD TikTok MP4 stream for upload: ${targetUrl}`);
      
      // Always use yt-dlp for HD TikTok downloads (unwatermarked)
      if (!videoUrl && targetUrl) {
         this.logsService.log('INFO', 'Attempting to extract HD TikTok MP4 stream using yt-dlp...');
         try {
            const ytDlpCmd = await this.getYtDlpCmd();
            const cookieArg = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';
            const cmd = `${ytDlpCmd} ${cookieArg} --dump-json "${targetUrl}"`;
            const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: 2 * 60 * 1000 });
            if (stdout && stdout.trim()) {
               const parsed = JSON.parse(stdout);
               const extractedUrl = parsed.url || (parsed.requested_downloads && parsed.requested_downloads[0] ? parsed.requested_downloads[0].url : null);
               if (extractedUrl) {
                  videoUrl = extractedUrl;
                  this.logsService.log('INFO', 'Successfully obtained TikTok video stream via yt-dlp fallback.');
               } else {
                  this.logsService.log('ERROR', 'yt-dlp succeeded but no video stream URL was found in the output.');
               }
            }
         } catch (e: any) {
            this.logsService.log('ERROR', `yt-dlp stream extraction failed: ${e.message.substring(0, 200)}...`);
         }
      }

      // TikWM direct HTTP fallback for single video download URL if yt-dlp did not resolve
      if (!videoUrl && targetUrl) {
        try {
          this.logsService.log('INFO', 'Attempting to extract HD TikTok MP4 stream via TikWM HTTP API...');
          const axios = require('axios');
          const tikwmRes = await axios.get(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
            timeout: 10000
          });
          if (tikwmRes.data?.data?.hdplay || tikwmRes.data?.data?.play) {
            videoUrl = tikwmRes.data.data.hdplay || tikwmRes.data.data.play;
            this.logsService.log('INFO', 'Successfully obtained HD TikTok video stream via TikWM API!');
          }
        } catch (err: any) {
          this.logsService.log('ERROR', `TikWM API stream fallback failed: ${err.message}`);
        }
      }

      if (!videoUrl) {
        throw new Error(`Failed to extract TikTok video stream. Playwright/TikWM both failed and no fallback available.`);
      }
    } else if (targetUrl.includes('instagram.com')) {
      const match = targetUrl.match(/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
      const rawShortcode = match ? match[1] : targetUrl.split('/').filter(Boolean).pop();
      const shortcode = this.igRelayClient.validateShortcode(rawShortcode) || rawShortcode;

      this.logsService.log('INFO', `Resolving Instagram MP4 stream via Relay Client for shortcode: ${shortcode}...`);
      const relayResult = await this.igRelayClient.resolveMp4(shortcode);
      if (relayResult) {
        videoUrl = relayResult.mp4Url;
        this.logsService.log('INFO', `Successfully obtained direct MP4 stream via ${relayResult.source}!`);
      }

      if (!videoUrl) {
        throw new Error(`Failed to extract Instagram MP4 via Relay Client for shortcode: ${shortcode}`);
      }
    } else if (targetUrl.includes('kuaishou.com')) {
      this.logger.log(`Extracting Kuaishou MP4 from mobile endpoint for URL: ${targetUrl}`);
      const proxyUrl = process.env.CLOUDFLARE_PROXY_URL;
      
      const ksId = targetUrl.split('/').filter(Boolean).pop();
      const mobileKsUrl = `https://c.kuaishou.com/fw/photo/${ksId}`;
      const finalUrl = proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(mobileKsUrl)}` : mobileKsUrl;
      
      const res = await fetch(finalUrl, { 
           headers: { 
             'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
             'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
           } 
      });
      const html = await res.text();
      
      const mp4Match = html.match(/(https?:\/\/[^"]+\.mp4[^"]*)/);
      if (mp4Match && mp4Match[1]) {
        videoUrl = mp4Match[1];
        this.logsService.log('INFO', `Successfully got Kuaishou MP4 video URL via Cloudflare Mobile Proxy.`);
      } else {
        throw new Error(`Failed to extract MP4 URL from Kuaishou HTML.`);
      }
    } else if (targetUrl.includes('xiaohongshu.com') || targetUrl.includes('xhslink.com') || targetUrl.includes('rednote.com') || /(^|[^a-zA-Z0-9])xhslink/i.test(targetUrl)) {
       this.logger.log(`Xiaohongshu / RedNote video stream extraction for URL: ${targetUrl}`);
       const xhsVideos = await extractXiaohongshuVideos(targetUrl, 1);
       const xhsRes = xhsVideos.length > 0 ? xhsVideos[0] : null;
       if (xhsRes && xhsRes.mp4Url) {
           videoUrl = xhsRes.mp4Url;
           if (!video.title || video.title === 'Xiaohongshu Video') {
               video.title = xhsRes.title;
           }
           this.logsService.log('INFO', `Successfully extracted Xiaohongshu / RedNote MP4 video URL.`);
       } else {
           throw new Error(`Failed to extract MP4 video stream from RedNote / Xiaohongshu URL: ${targetUrl}`);
       }
    } else {
      this.logger.log(`Requesting loader.to for YouTube video: ${ytId}`);
      const loaderRes = await fetch(`https://loader.to/ajax/download.php?format=720&url=${encodedUrl}`);
      const loaderData = await loaderRes.json();
      
      if (!loaderData || !loaderData.id) {
        throw new Error(`Failed to initialize loader.to download. Response: ${JSON.stringify(loaderData)}`);
      }
      
      const downloadId = loaderData.id;
      this.logsService.log('INFO', `Processing video format, please wait...`);
      
      // Poll for up to 60 seconds
      for (let i = 0; i < 30; i++) {
        await this.delay(2000);
        const progRes = await fetch(`https://lto2.affadaffa.com/api/progress?id=${downloadId}`);
        try {
          const progData = await progRes.json();
          this.logger.log(`Loader status: ${progData.text}`);
          if (progData.success === 1 || progData.success === '1') {
            videoUrl = progData.download_url;
            break;
          }
        } catch (e) {
          this.logger.error(`Error parsing progress: ${e.message}`);
        }
      }
    }
    
    if (!videoUrl) {
      throw new Error('Timed out waiting for video processing to complete.');
    }
    
    this.logsService.log('INFO', `Video processing complete. Uploading to Facebook...`);
    this.logger.log(`Direct URL: ${videoUrl}`);
    
    let fbRes: any;
    let fbData: any;

    const isMegaLocal = videoUrl.startsWith('local://');
    const isTiktokOrCdn = targetUrl.includes('tiktok.com') || videoUrl.includes('tiktok.com') || videoUrl.includes('akamai') || videoUrl.includes('byte') || videoUrl.includes('snssdk');
    const isXhsOrRedNote = (targetUrl.includes('xiaohongshu.com') || targetUrl.includes('xhslink.com') || targetUrl.includes('rednote.com') || videoUrl.includes('sns-video') || videoUrl.includes('xiaohongshu')) && !isMegaLocal;

    let customHashtags: string | undefined = undefined;
    if (uploadHistory.video?.sourceId && uploadHistory.facebookPageId) {
      const mapping = await this.prisma.mapping.findUnique({
        where: {
          sourceId_facebookPageId: {
            sourceId: uploadHistory.video.sourceId,
            facebookPageId: uploadHistory.facebookPageId
          }
        }
      });
      if (mapping?.customHashtags) {
        customHashtags = mapping.customHashtags;
      }
    }

    const sourcePlatform = uploadHistory.video?.source?.platform;
    const finalDescription = this.formatFacebookCaption(video.description || video.title, sourcePlatform, targetUrl || videoUrl, customHashtags);

    if (isMegaLocal) {
      const localFilePath = videoUrl.replace('local://', '');
      this.logsService.log('INFO', `Uploading physical video from Mega directly to Facebook...`);
      fbData = await new Promise((resolve, reject) => {
         const { spawn } = require('child_process');
         const curl = spawn('curl', [
            '-s', '-m', '300', '-X', 'POST',
            `https://graph-video.facebook.com/v19.0/${pageId}/videos`,
            '-F', `access_token=${accessToken}`,
            '-F', `description=${finalDescription}`,
            '-F', `source=@${localFilePath}`
         ]);
         
         let out = ''; let errOut = '';
         curl.stdout.on('data', (d: any) => out += d);
         curl.stderr.on('data', (d: any) => errOut += d);
         curl.on('close', (code: number) => {
            if (code === 0) {
               try { 
                  const parsed = JSON.parse(out);
                  if (parsed.error) reject(new Error(parsed.error.message));
                  else resolve(parsed); 
               } catch(e) { reject(new Error('Failed to parse Facebook response')); }
            } else reject(new Error(`cURL failed. ${errOut}`));
         });
      });
      // Cleanup local temp file
      if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
      
      // Auto-Delete from Mega.nz Cloud Storage
      this.logsService.log('INFO', `Auto-Cleaning: Deleting video from Mega.nz to free up space...`);
      
      let megaEmail, megaPassword;
      if (uploadHistory.facebookPage?.userId) {
        const pageUser = await this.prisma.user.findUnique({ where: { id: uploadHistory.facebookPage.userId } });
        if (pageUser) {
          if (pageUser.role !== 'ADMIN' && (!pageUser.megaEmail || !pageUser.megaPassword)) {
            this.logsService.log('ERROR', `Mega Cloud credentials missing for user ${pageUser.id}. Cannot auto-delete.`);
          } else {
            megaEmail = pageUser.megaEmail;
            megaPassword = pageUser.megaPassword;
          }
        }
      }
      
      await this.megaService.deleteFile(targetUrl, megaEmail || undefined, megaPassword || undefined);
    } else if (isTiktokOrCdn || isXhsOrRedNote) {
      this.logsService.log('INFO', `Downloading CDN MP4 stream locally with anti-403 headers before uploading to Facebook...`);
      const tempPath = path.join(os.tmpdir(), `upload_${Date.now()}_${Math.floor(Math.random()*10000)}.mp4`);
      try {
        if (isXhsOrRedNote) {
          await downloadXiaohongshuVideo(videoUrl, tempPath);
        } else {
          try {
            await downloadTikTokVideo(videoUrl, tempPath);
          } catch (err: any) {
            if (err.response?.status === 403 || err.message.includes('403') || err.message.includes('status code 403')) {
               this.logsService.log('WARN', 'TikTok CDN returned 403 Forbidden. Falling back to yt-dlp direct download...');
               const ytDlpCmd = await this.getYtDlpCmd();
               const cookieArg = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';
               const cmd = `${ytDlpCmd} ${cookieArg} -o "${tempPath}" "${targetUrl}"`;
               await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50, timeout: 5 * 60 * 1000 });
            } else {
               throw err;
            }
          }

          // Strip TikTok Metadata to avoid duplicate detection
          this.logsService.log('INFO', 'Stripping TikTok metadata using FFmpeg to avoid duplicate detection...');
          const strippedPath = tempPath.replace('.mp4', '_stripped.mp4');
          try {
             const ffmpegPath = require('ffmpeg-static');
             if (ffmpegPath) {
                const { exec } = require('child_process');
                await new Promise((resolve, reject) => {
                   exec(`"${ffmpegPath}" -loglevel error -i "${tempPath}" -map_metadata -1 -c:v copy -c:a copy "${strippedPath}"`, (error: any) => {
                      if (error) reject(error);
                      else resolve(true);
                   });
                });
                if (fs.existsSync(strippedPath)) {
                   fs.unlinkSync(tempPath);
                   fs.renameSync(strippedPath, tempPath);
                   this.logsService.log('INFO', 'Successfully stripped TikTok metadata and fixed hash.');
                }
             }
          } catch (e: any) {
             this.logger.warn(`Failed to strip TikTok metadata: ${e.message}`);
             this.logsService.log('WARN', 'Failed to strip metadata. Proceeding with original video.');
             // Proceed with original file if ffmpeg fails
             if (fs.existsSync(strippedPath)) {
                try { fs.unlinkSync(strippedPath); } catch (_) {}
             }
          }
        }
        this.logsService.log('INFO', `Downloaded MP4 file to ${tempPath}. Uploading physical video directly to Facebook using highly reliable cURL stream...`);

        fbData = await new Promise((resolve, reject) => {
           const { spawn } = require('child_process');
           const curl = spawn('curl', [
              '-s',
              '-m', '300',
              '-X', 'POST',
              `https://graph-video.facebook.com/v19.0/${pageId}/videos`,
              '-F', `access_token=${accessToken}`,
              '-F', `description=${finalDescription}`,
              '-F', `source=@${tempPath}`
           ]);
           
           let out = '';
           let errOut = '';
           curl.stdout.on('data', (d: any) => out += d);
           curl.stderr.on('data', (d: any) => errOut += d);
           curl.on('close', (code: number) => {
              if (code === 0) {
                 try { 
                    const parsed = JSON.parse(out);
                    if (parsed.error) {
                       reject(new Error(parsed.error.message || 'Facebook API Error'));
                    } else {
                       resolve(parsed); 
                    }
                 } catch(e) { 
                    reject(new Error('Failed to parse Facebook JSON response: ' + out)); 
                 }
              } else {
                 reject(new Error(`cURL upload failed with code ${code}. Stderr: ${errOut}`));
              }
           });
        });
      } finally {
        if (fs.existsSync(tempPath)) {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        }
      }
    } else {
      // For YouTube/Instagram or standard public URLs, try direct file_url to Facebook
      fbRes = await fetch(`https://graph-video.facebook.com/v19.0/${pageId}/videos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          file_url: videoUrl,
          description: finalDescription
        })
      });
      fbData = await fbRes.json();
    }
    if ((fbRes && !fbRes.ok) || (fbData && fbData.error)) {
      throw new Error(`Facebook API Error: ${JSON.stringify(fbData?.error || fbData)}`);
    }
    
    this.logsService.log('INFO', `Success! Facebook Post ID: ${fbData.id}`);
    
    // Update DB
    await this.prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: { 
        status: 'COMPLETED',
        facebookPostId: fbData.id,
        errorMessage: null
      }
    });
  }

  private async downloadAndUpload(uploadHistory: any) {
    await this.nativeDownloadAndUpload(uploadHistory);
  }

  private async pollInstagramProfile(username: string): Promise<any> {
    // 1. Try Residential Relay and verified Edge Worker rotation first
    const relayResult = await this.igRelayClient.getLatestShortcode(username);
    if (relayResult) {
      const { shortcode, source } = relayResult;
      const reelUrl = `https://www.instagram.com/reel/${shortcode}/`;
      this.logsService.log('INFO', `SUCCESS: Found latest Reel shortcode (${shortcode}) for @${username} via ${source}!`);
      return {
        id: shortcode,
        url: reelUrl,
        title: `Instagram Reel`,
        timestamp: Math.floor(Date.now() / 1000)
      };
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5'
    };

    const mirrors = [
      { name: 'Imginn', url: `https://imginn.com/${username}/` },
      { name: 'Picnob', url: `https://www.picnob.com/profile/${username}/` },
      { name: 'Dumpor', url: `https://dumpoir.com/v/${username}` },
      { name: 'Greatfon', url: `https://greatfon.com/v/${username}` },
      { name: 'Anonymously', url: `https://anonymously.io/profile/${username}/` }
    ];

    for (const mirror of mirrors) {
      try {
        this.logsService.log('INFO', `Polling ${mirror.name} mirror for user @${username}...`);
        const res = await fetch(mirror.url, { headers, redirect: 'follow', signal: AbortSignal.timeout(30000) });
        if (res.ok) {
          const html = await res.text();
          const regex = /(?:\/p\/|\/reel\/|\/post\/|shortcode["':\s]+)([A-Za-z0-9_-]{11})(?:[\/'"\s?#&]|$)/gi;
          let match;
          let validShortcode: string | null = null;
          while ((match = regex.exec(html)) !== null) {
            const code = match[1];
            // Genuine shortcode rules: exactly 11 chars, must not start with image prefix (pt_, vd_, th_), must have uppercase + lowercase + (digit or symbol) or high entropy
            if (
              code.length === 11 &&
              !/^[0-9]+$/.test(code) &&
              !/^(pt|vd|th|pb|im|px|sp)_/i.test(code) &&
              !/^(reels|posts|stories|profile|explore|tagged|highlights|Montserrat)$/i.test(code) &&
              (/[A-Z]/.test(code) && /[a-z]/.test(code)) &&
              (/[0-9]/.test(code) || /[A-Z].*[A-Z]/.test(code))
            ) {
              validShortcode = code;
              break;
            }
          }
          if (validShortcode) {
            const reelUrl = `https://www.instagram.com/reel/${validShortcode}/`;
            this.logsService.log('INFO', `SUCCESS: Found latest Reel shortcode (${validShortcode}) via ${mirror.name}!`);
            return {
              id: validShortcode,
              url: reelUrl,
              title: `Instagram Reel`,
              timestamp: Math.floor(Date.now() / 1000)
            };
          } else {
            this.logsService.log('WARN', `${mirror.name}: Connected but no valid alphanumeric shortcode found in HTML.`);
          }
        } else {
          this.logsService.log('WARN', `${mirror.name} returned HTTP ${res.status} (Cloud blocking)`);
        }
      } catch (e: any) {
        this.logger.warn(`Failed to poll ${mirror.name}: ${e.message}`);
      }
    }

    // Worker fallback
    const igWorkerUrl = process.env.IG_WORKER_URL;
    if (igWorkerUrl) {
      this.logsService.log('INFO', `Public mirrors blocked by cloud ASN. Falling back to IG Worker for @${username}...`);
      let baseUrl = igWorkerUrl.trim().replace(/\/$/, '');
      if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
      try {
        const res = await fetch(`${baseUrl}?username=${username}`, { signal: AbortSignal.timeout(60000) });
        if (res.ok) {
          const data = await res.json();
          if (data && data.shortcode) {
            const shortcode = data.shortcode;
            const reelUrl = data.url || `https://www.instagram.com/reel/${shortcode}/`;
            this.logsService.log('INFO', `Found Reel via IG Edge Worker Mirror (${data.source || 'edge'}): ${reelUrl}`);
            return {
              id: shortcode,
              url: reelUrl,
              title: `Instagram Reel`,
              timestamp: Math.floor(Date.now() / 1000)
            };
          }
          const user = data?.data?.user;
          const edges = user?.edge_owner_to_timeline_media?.edges;
          if (edges && edges.length > 0) {
            const latestMedia = edges.find((e: any) => e.node && e.node.is_video)?.node || edges[0]?.node;
            if (latestMedia) {
              const shortcode = latestMedia.shortcode;
              const reelUrl = `https://www.instagram.com/reel/${shortcode}/`;
              this.logsService.log('INFO', `Found Reel via IG Worker API: ${reelUrl}`);
              return {
                id: shortcode,
                url: reelUrl,
                title: `Instagram Reel`,
                timestamp: latestMedia.taken_at_timestamp || Math.floor(Date.now() / 1000)
              };
            }
          }
        } else {
          this.logsService.log('ERROR', `IG Worker fallback returned HTTP ${res.status}.`);
        }
      } catch (e: any) {
        this.logsService.log('ERROR', `IG Worker request failed: ${e.message}`);
      }
    }

    return null;
  }

  private async fetchLatestFromRssHub(route: string): Promise<any> {
    for (const instance of this.rssHubInstances) {
      try {
        const feedUrl = `${instance}${route}`;
        this.logger.log(`Trying RSSHub instance: ${feedUrl}`);
        const feed = await this.parser.parseURL(feedUrl);

        if (feed.items && feed.items.length > 0) {
          const item = feed.items[0];
          // Get ID from link
          let id = item.link;
          if (item.guid) {
            id = item.guid;
          }
          return {
            id: id,
            url: item.link,
            title: item.title || 'Social Video',
            timestamp: item.pubDate ? new Date(item.pubDate).getTime() / 1000 : Math.floor(Date.now() / 1000)
          };
        }
      } catch (error: any) {
        this.logger.warn(`RSSHub instance ${instance} failed for ${route}: ${error.message}`);
        continue;
      }
    }
    return null;
  }

  private async scrapeLatestFromSSR(platform: string, profileUrl: string, userId: string): Promise<string | null> {
    const proxyUrl = process.env.CLOUDFLARE_PROXY_URL; // e.g. https://autopost-proxy.yourname.workers.dev
    try {
      const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      };

      if (platform === 'XIAOHONGSHU') {
        const xhsVideos = await extractXiaohongshuVideos(profileUrl || `https://www.xiaohongshu.com/user/profile/${userId}`, 1);
        const xhsRes = xhsVideos.length > 0 ? xhsVideos[0] : null;
        return xhsRes ? (xhsRes.mp4Url || xhsRes.url) : null;
      } else if (platform === 'KUAISHOU') {
        const targetUrl = `https://c.kuaishou.com/fw/user/3x${userId.replace(/^3x/, '')}`;
        const finalUrl = proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}` : targetUrl;

        const response = await fetch(finalUrl, { 
           headers: { 
             'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
             'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
           },
           signal: AbortSignal.timeout(60000)
        });
        const html = await response.text();
        
        // Extract INIT_STATE
        const matchInit = html.match(/window\.INIT_STATE\s*=\s*(\{.*?\});/s);
        
        if (matchInit && matchInit[1]) {
          try {
             const jsonStr = matchInit[1].replace(/undefined/g, 'null');
             // The state JSON can be malformed, so we use regex to extract photoIds directly
             const photoIdMatch = jsonStr.match(/"photoId":"([0-9a-zA-Z]+)"/);
             if (photoIdMatch && photoIdMatch[1]) {
                const latestVideoId = photoIdMatch[1];
                return `https://www.kuaishou.com/short-video/${latestVideoId}`;
             } else {
                this.logger.warn(`No photoId found in Kuaishou INIT_STATE.`);
             }
          } catch(e) {
             this.logger.warn(`Failed to parse Kuaishou INIT_STATE: ${e}`);
          }
        } else {
           this.logger.warn(`Could not find INIT_STATE in Kuaishou HTML`);
        }
      }
    } catch (error: any) {
      this.logger.error(`SSR Scrape error: ${error.message}`);
    }
    return null;
  }

  private async extractTikTokVideos(rawUrl: string, limit = 50): Promise<any[]> {
    try {
      this.logger.log(`Calling native TikTok scraper for: ${rawUrl}`);
      const tkMetas = await getLatestTikTokVideos(rawUrl, limit);
      return tkMetas.map(tkMeta => ({
        id: tkMeta.id,
        title: tkMeta.caption,
        description: tkMeta.caption,
        url: tkMeta.url,
        mp4Url: tkMeta.playUrl || tkMeta.downloadUrl,
        timestamp: tkMeta.createTime
      }));
    } catch (e: any) {
      this.logger.warn(`Native TikTok extraction failed: ${e.message}`);
      return [];
    }
  }
}
