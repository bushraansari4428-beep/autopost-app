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
import { getLatestTikTokVideos, downloadTikTokVideo } from './tiktok.scraper';
import { extractXiaohongshuVideos, downloadXiaohongshuVideo } from './xiaohongshu.scraper';
import { MegaService } from './mega.service';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isProcessing = false;
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

  private getYtDlpCmd(): string {
    if (process.platform === 'win32') {
      const winPath = path.join(process.cwd(), 'yt-dlp.exe');
      if (fs.existsSync(winPath)) return `"${winPath}"`;
      const winBackendPath = path.join(process.cwd(), 'backend', 'yt-dlp.exe');
      if (fs.existsSync(winBackendPath)) return `"${winBackendPath}"`;
      return 'yt-dlp.exe';
    }
    const linuxPath = path.join(process.cwd(), 'yt-dlp');
    if (fs.existsSync(linuxPath)) {
      try { fs.chmodSync(linuxPath, '755'); } catch (_) {}
      return `"${linuxPath}"`;
    }
    const linuxBackendPath = path.join(process.cwd(), 'backend', 'yt-dlp');
    if (fs.existsSync(linuxBackendPath)) {
      try { fs.chmodSync(linuxBackendPath, '755'); } catch (_) {}
      return `"${linuxBackendPath}"`;
    }
    return 'yt-dlp';
  }

  public formatFacebookCaption(rawCaption?: string, platform?: string, url?: string): string {
    const plat = (platform || '').toUpperCase();
    const cleanUrl = (url || '').toLowerCase();

    // Check if source is Chinese/Asian platform (Kuaishou or Xiaohongshu / RedNote)
    const isChinesePlatform = 
      plat === 'KUAISHOU' || 
      plat === 'XIAOHONGSHU' || 
      cleanUrl.includes('kuaishou') || 
      cleanUrl.includes('xiaohongshu') || 
      cleanUrl.includes('xhslink') || 
      cleanUrl.includes('rednote');

    // Rule 1: For KUAISHOU or XIAOHONGSHU (RedNote), ALWAYS delete entire original caption and output ONLY #FBReels #Reels
    if (isChinesePlatform) {
      return '#FBReels #Reels';
    }

    // Rule 2 & 3: For TikTok, YouTube Shorts, Instagram
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
        // Output clean first line + #FBReels #Reels
        return `${cleanText} #FBReels #Reels`;
      }
    }

    // Rule 3: If no text caption (only hashtags or empty)
    return '#FBReels #Reels';
  }

  async testMapping(mappingId: string) {
    const mapping = await this.prisma.mapping.findUnique({
      where: { id: mappingId },
      include: { source: true }
    });
    if (!mapping) return { success: false, message: 'Mapping not found' };

    this.logsService.log('INFO', `Starting test extraction for the selected page...`);
    this.logsService.log('INFO', 'Test request initiated successfully.');
    
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
       this.logsService.log('ERROR', 'GITHUB_TOKEN is missing in environment variables.');
       return { success: false, message: 'Server configuration error: GITHUB_TOKEN missing. Cannot trigger test.' };
    }

    try {
      const response = await fetch('https://api.github.com/repos/bushraansari4428-beep/autopost-app/actions/workflows/auto-scraper.yml/dispatches', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${githubToken}`,
          'User-Agent': 'AutoPost-App'
        },
        body: JSON.stringify({
          ref: 'main',
          inputs: { mappingId: mappingId }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logsService.log('ERROR', `GitHub API error: ${response.status} - ${errorText}`);
        return { success: false, message: `Failed to trigger test in background: ${response.statusText}` };
      }
      // this.logsService.log('INFO', 'GitHub Action triggered successfully.');
      return { 
        success: true, 
        message: 'Test successfully started in the background! Please check your Facebook page in 2-3 minutes.' 
      };

    } catch (e: any) {
      this.logsService.log('ERROR', `Failed to initiate test request: ${e.message}`);
      return { success: false, message: 'Failed to contact background worker.' };
    }
  }

  async executeTestMapping(mappingId: string) {
    const mapping = await this.prisma.mapping.findUnique({
      where: { id: mappingId },
      include: { source: true }
    });
    if (!mapping) return { success: false, message: 'Mapping not found' };

    await this.logsService.log('INFO', `Starting TEST for mapping: ${mapping.id}`);

    if (mapping.source.platform === 'LOCAL_FOLDER') {
      await this.logsService.log('INFO', `Test skipped: LOCAL_FOLDER mappings are managed by your Desktop App.`);
      return { success: true, message: 'Local PC Folders are connected properly. Please use the Desktop app to upload videos.' };
    }

    if (mapping.source.platform === 'MEGA_CLOUD') {
      await this.logsService.log('INFO', `Cloud Upload mapping detected. Verifying queue...`);
      const queuedCount = await this.prisma.video.count({
        where: {
          sourceId: mapping.sourceId,
          uploads: { none: { facebookPageId: mapping.facebookPageId, status: 'COMPLETED' } }
        }
      });
      
      if (queuedCount > 0) {
        await this.logsService.log('INFO', `Test passed! There are ${queuedCount} video(s) in the cloud queue ready to be posted at the scheduled time.`);
        return { success: true, message: `Cloud connection verified. ${queuedCount} videos pending.` };
      } else {
         await this.logsService.log('ERROR', `Test failed: No videos found in the cloud queue for this page. Please upload videos first.`);
         
         // Create dummy failed record so it shows up in UI
         try {
           const dummyVideoId = 'test_fail_' + Date.now().toString();
           const dummyVideo = await this.prisma.video.upsert({
             where: { sourceId_originalId: { sourceId: mapping.sourceId, originalId: dummyVideoId } },
             update: {},
             create: {
               sourceId: mapping.sourceId,
               originalId: dummyVideoId,
               title: 'Cloud Queue Empty',
               publishedAt: new Date(),
               url: mapping.source.url,
             }
           });
           await this.prisma.uploadHistory.create({
             data: {
               videoId: dummyVideo.id,
               facebookPageId: mapping.facebookPageId,
               status: 'FAILED',
               errorMessage: 'Test extraction failed: No videos found in cloud queue'
             }
           });
         } catch (e) {}

         return { success: false, message: 'No videos found in cloud queue' };
      }
    }

    let urlsToScan = [mapping.source.url];
    if (mapping.source.platform === 'YOUTUBE' && !mapping.source.url.includes('/shorts') && !mapping.source.url.includes('/videos') && mapping.source.url.includes('@')) {
      urlsToScan = [
        mapping.source.url.replace(/\/$/, '') + '/videos',
        mapping.source.url.replace(/\/$/, '') + '/shorts'
      ];
    }

    try {
      let latestVideo = null;
      
      const workerUrl = process.env.CLOUDFLARE_WORKER_URL || '';
      
      // Try RSS feed first if it's a channel URL
      if (mapping.source.url.includes('/channel/UC') || mapping.source.url.startsWith('UC')) {
        const channelId = mapping.source.url.startsWith('UC') ? mapping.source.url.trim() : mapping.source.url.split('/channel/')[1].split('/')[0].split('?')[0];
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        this.logger.log(`Trying RSS feed for channel: ${channelId}`);
        await this.logsService.log('INFO', `Trying RSS feed for channel: ${channelId}`);
        try {
          const rssRes = await fetch(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
          });
          if (rssRes.ok) {
            const xml = await rssRes.text();
            await this.logsService.log('INFO', `RSS feed fetched successfully. Length: ${xml.length}`);
            const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = xml.match(/<title>(.*?)<\/title>/g); // Second match is usually the first video
            if (videoIdMatch && videoIdMatch[1]) {
              latestVideo = {
                id: videoIdMatch[1],
                title: titleMatch && titleMatch.length > 1 ? titleMatch[1].replace(/<[^>]+>/g, '') : 'New Video',
                url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
                timestamp: Math.floor(Date.now() / 1000)
              };
              await this.logsService.log('INFO', `Extracted video ID: ${videoIdMatch[1]}`);
            } else {
              await this.logsService.log('ERROR', `RSS feed XML did not contain <yt:videoId>. Sample: ${xml.substring(0, 100)}`);
            }
          } else {
            await this.logsService.log('ERROR', `RSS feed HTTP error: ${rssRes.status} ${rssRes.statusText}`);
          }
        } catch(e) {
          this.logger.warn(`RSS feed failed: ${e.message}`);
          await this.logsService.log('ERROR', `RSS feed fetch failed: ${e.message}`);
        }
      }

      if (!latestVideo) {
        if (mapping.source.platform === 'INSTAGRAM') {
          try {
            const username = mapping.source.url.split('instagram.com/')[1]?.split('/')[0] || 'moromorotv';
            const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;

            if (braveApiKey) {
              this.logsService.log('INFO', `Searching Brave API for latest Reel by ${username}...`);
              const query = `site:instagram.com "${username}"`;
              const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
              
              const res = await fetch(searchUrl, {
                headers: {
                  'Accept': 'application/json',
                  'X-Subscription-Token': braveApiKey
                }
              });
              
              if (res.ok) {
                const data = await res.json();
                const results = data.web?.results || [];
                for (const result of results) {
                  if (result.url && result.url.includes('instagram.com/')) {
                    const shortcodeMatch = result.url.match(/(reel|p)\/([^\/]+)/);
                    if (shortcodeMatch) {
                      latestVideo = {
                        id: shortcodeMatch[2],
                        url: result.url,
                        title: `Instagram Post`,
                        timestamp: Math.floor(Date.now() / 1000)
                      };
                      this.logsService.log('INFO', `Found post from Brave Search: ${result.url}`);
                      break;
                    }
                  }
                }
              }
            }
            
            if (!latestVideo) {
              latestVideo = await this.pollInstagramProfile(username);
            }
          } catch (e) {
            this.logsService.log('ERROR', `Instagram polling failed: ${e.message}`);
          }

        } else if (mapping.source.platform === 'XIAOHONGSHU') {
          await this.logsService.log('INFO', `Executing RedNote/Xiaohongshu multi-layer extraction for ${mapping.source.url}...`);
          const xhsVideos = await extractXiaohongshuVideos(mapping.source.url, 1);
          if (xhsVideos.length > 0) {
            latestVideo = xhsVideos[0];
            await this.logsService.log('INFO', `Successfully found Xiaohongshu Video: ${latestVideo.title?.substring(0, 80)}...`);
          }
        } else if (mapping.source.platform === 'KUAISHOU') {
          // Extract user ID from URL
          const urlParts = mapping.source.url.split('/').filter(Boolean);
          const userId = urlParts[urlParts.length - 1]; // e.g. /profile/userId or /user/userId
          
          this.logsService.log('INFO', `Scraping SSR HTML for latest ${mapping.source.platform} video for user ${userId}...`);
          const ssrUrl = await this.scrapeLatestFromSSR(mapping.source.platform, mapping.source.url, userId);
          
          if (!ssrUrl) {
             this.logsService.log('ERROR', `Could not find any video for ${mapping.source.platform} user ${userId} via SSR`);
          } else {
             this.logsService.log('INFO', `Found latest video via SSR: ${ssrUrl}`);
             latestVideo = {
               id: 'ssr_' + Date.now(),
               url: ssrUrl,
               title: `${mapping.source.platform} Video`,
               timestamp: Math.floor(Date.now() / 1000)
             };
          }
        } else if (mapping.source.platform === 'TIKTOK') {
          await this.logsService.log('INFO', `Executing high-res TikTok extraction with original caption preservation for ${mapping.source.url}...`);
          const tkVideos = await this.extractTikTokVideos(mapping.source.url, 1);
          if (tkVideos.length > 0) {
            latestVideo = tkVideos[0];
            await this.logsService.log('INFO', `Successfully found TikTok Video: ${latestVideo.title?.substring(0, 80)}...`);
          }
        }
        
        // Universal fallback for anything that failed (except Xiaohongshu which strictly uses Playwright)
        if (!latestVideo && mapping.source.platform !== 'XIAOHONGSHU') {
          await this.logsService.log('INFO', `Attempting universal yt-dlp fallback extraction for ${mapping.source.url}...`);
          for (const url of urlsToScan) {
            const ytDlpCmd = this.getYtDlpCmd();
            const cmd = `${ytDlpCmd} --cookies cookies.txt --dump-json --playlist-end 1 "${url}"`;
            try {
              const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
              if (stdout && stdout.trim()) {
                const parsed = JSON.parse(stdout);
                const extractedUrl = parsed.url || (parsed.requested_downloads && parsed.requested_downloads[0] ? parsed.requested_downloads[0].url : null);
                latestVideo = {
                   id: parsed.id,
                   title: parsed.title || parsed.description || 'New Video',
                   url: parsed.webpage_url || url,
                   mp4Url: extractedUrl,
                   timestamp: parsed.timestamp || Math.floor(Date.now() / 1000)
                };
                await this.logsService.log('INFO', `Successfully extracted via yt-dlp: ${latestVideo.title?.substring(0, 80)}...`);
                break;
              }
            } catch (e: any) {
              await this.logsService.log('ERROR', `yt-dlp error: ${e.message.substring(0, 200)}...`);
            }
          }
        }
      }

      if (!latestVideo) {
        await this.logsService.log('ERROR', `Test failed: No videos found at source ${mapping.source.url}`);
        
        try {
          const dummyVideoId = 'test_fail_' + Date.now().toString();
          const dummyVideo = await this.prisma.video.upsert({
            where: { sourceId_originalId: { sourceId: mapping.sourceId, originalId: dummyVideoId } },
            update: {},
            create: {
              sourceId: mapping.sourceId,
              originalId: dummyVideoId,
              title: 'Extraction Failed',
              publishedAt: new Date(),
              url: mapping.source.url,
            }
          });

          await this.prisma.uploadHistory.create({
            data: {
              videoId: dummyVideo.id,
              facebookPageId: mapping.facebookPageId,
              status: 'FAILED',
              errorMessage: 'Test extraction failed: No videos found at source'
            }
          });
        } catch (e) {
          // ignore creation errors for dummy stats
        }

        return { success: false, message: 'No videos found' };
      }

      await this.logsService.log('INFO', `Test: Found video ${latestVideo.title}. Queuing for upload.`);
      
      const publishedAt = latestVideo.timestamp ? new Date(latestVideo.timestamp * 1000) : new Date();
      
      const formattedCaption = this.formatFacebookCaption(latestVideo.description || latestVideo.title, mapping.source.platform, mapping.source.url);
      const newVideo = await this.prisma.video.create({
        data: {
          title: formattedCaption,
          description: formattedCaption,
          originalId: 'test_' + latestVideo.id + '_' + Date.now(),
          publishedAt: publishedAt,
          url: latestVideo.webpage_url || latestVideo.url || '',
          sourceId: mapping.source.id,
        }
      });

      await this.prisma.uploadHistory.create({
        data: {
          videoId: newVideo.id,
          facebookPageId: mapping.facebookPageId,
          status: 'PENDING'
        }
      });

      // Run uploads async and wait for them to finish before returning so the CLI doesn't exit!
      try {
        await this.processPendingUploads();
      } catch (e) {
        console.error("Upload error during test:", e);
      }

      return { success: true, message: 'Test video found and queued for processing. Check Logs for progress.' };

    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  async monitorSource(sourceId: string, dueMappingIds?: string[]) {
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
        // Find the oldest videos from this source that haven't been successfully uploaded or queued yet
        const unuploadedVideos = await this.prisma.video.findMany({
          where: {
            sourceId: source.id,
            uploads: { none: { facebookPageId: mapping.facebookPageId, status: { in: ['COMPLETED', 'PENDING'] } } }
          },
          orderBy: { createdAt: 'asc' },
          take: mapping.videosPerDay || 1
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
          
          if (mapping.scheduledTime) {
            await this.prisma.mapping.update({
              where: { id: mapping.id },
              data: { lastScheduledRun: new Date() }
            });
          }
        } else {
           this.logsService.log('INFO', `Cloud Auto-Poster: No pending videos found in Mega.nz for this page.`);
        }
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
      const workerUrl = process.env.CLOUDFLARE_WORKER_URL || '';

      if (source.url.includes('/channel/UC') || source.url.startsWith('UC')) {
        const channelId = source.url.startsWith('UC') ? source.url.trim() : source.url.split('/channel/')[1].split('/')[0].split('?')[0];
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        this.logger.log(`Cron: Trying RSS feed for channel: ${channelId}`);
        try {
          const rssRes = await fetch(rssUrl);
          if (rssRes.ok) {
            const xml = await rssRes.text();
            const videoIdMatch = xml.match(/<yt:videoId>(.*?)<\/yt:videoId>/);
            const titleMatch = xml.match(/<title>(.*?)<\/title>/g); // Second match is usually the first video
            if (videoIdMatch && videoIdMatch[1]) {
              latestVideos.push({
                id: videoIdMatch[1],
                title: titleMatch && titleMatch.length > 1 ? titleMatch[1].replace(/<[^>]+>/g, '') : 'New Video',
                url: `https://www.youtube.com/watch?v=${videoIdMatch[1]}`,
                timestamp: Math.floor(Date.now() / 1000)
              });
            }
          }
        } catch(e) {
          this.logger.warn(`Cron RSS feed failed: ${e.message}`);
        }
      }

      if (latestVideos.length === 0) {
        if (source.platform === 'INSTAGRAM') {
          try {
            const username = source.url.split('instagram.com/')[1]?.split('/')[0] || 'moromorotv';
            const braveApiKey = process.env.BRAVE_SEARCH_API_KEY;
            
            let foundVideo = null;

            if (braveApiKey) {
              this.logger.log(`Searching Brave API for latest Reel by ${username}...`);
              const query = `site:instagram.com "${username}"`;
              const searchUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5`;
              
              const res = await fetch(searchUrl, {
                headers: {
                  'Accept': 'application/json',
                  'X-Subscription-Token': braveApiKey
                }
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
                      this.logger.log(`Found post from Brave Search: ${result.url}`);
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
          } catch (e) {
            this.logsService.log('ERROR', `Instagram polling failed: ${e.message}`);
          }

        } else if (source.platform === 'XIAOHONGSHU') {
          this.logger.log(`Executing RedNote/Xiaohongshu multi-layer extraction for ${source.url}...`);
          const xhsVideos = await extractXiaohongshuVideos(source.url, 5);
          if (xhsVideos.length > 0) {
             latestVideos.push(...xhsVideos);
          }
        } else if (source.platform === 'KUAISHOU') {
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

        } else if (source.platform === 'YOUTUBE' && workerUrl) {
          this.logger.log(`Using Cloudflare Worker for YouTube metadata extraction: ${source.url}`);
          const infoUrl = `${workerUrl}?url=${encodeURIComponent(source.url)}&action=info`;
          const res = await fetch(infoUrl);
          if (res.ok) {
            const data = await res.json();
            latestVideos.push({
              id: data.id,
              title: data.title,
              url: `https://www.youtube.com/watch?v=${data.id}`,
              timestamp: Math.floor(Date.now() / 1000)
            });
          }
        }
      }
      
      if (latestVideos.length === 0 && source.platform !== 'INSTAGRAM' && source.platform !== 'XIAOHONGSHU' && source.platform !== 'KUAISHOU') {
        if (source.platform === 'TIKTOK') {
          this.logger.log(`Scanning TikTok source & extracting original captions for: ${source.url}`);
          const tkVideos = await this.extractTikTokVideos(source.url, 5);
          if (tkVideos.length > 0) {
            latestVideos.push(...tkVideos);
            this.logger.log(`Found TikTok video(s). Count: ${tkVideos.length}`);
          }
        } else {
          for (const url of urlsToScan) {
            const ytDlpCmd = this.getYtDlpCmd();
            const cmd = `${ytDlpCmd} --cookies cookies.txt --dump-json --playlist-end 5 "${url}"`;
            try {
              this.logger.log(`Scanning URL: ${url}`);
              const { stdout, stderr } = await execPromise(cmd, {
                maxBuffer: 1024 * 1024 * 50,
              });

              if (stdout && stdout.trim()) {
                const lines = stdout.trim().split('\n');
                for (const line of lines) {
                  if (line.trim()) {
                    try { latestVideos.push(JSON.parse(line)); } catch(e) {}
                  }
                }
                if (latestVideos.length > 0) {
                  this.logger.log(`Found YouTube video(s). Count: ${latestVideos.length}`);
                  break;
                }
              } else if (stderr) {
                this.logger.warn(`yt-dlp stderr for ${url}: ${stderr}`);
              }
            } catch (error) {
              this.logger.warn(`Failed to scan ${url}: ${error.message}`);
            }
          }
        }
      }
      
      for (const videoData of latestVideos) {
        try {
          const platformVideoId = videoData.id;
          
          let videoRecord = await this.prisma.video.findFirst({
            where: {
              sourceId: source.id,
              originalId: platformVideoId
            },
            include: { uploads: true }
          });

          if (!videoRecord) {
            this.logsService.log('INFO', `Found new video: ${videoData.title}`);
            const publishedAt = videoData.timestamp ? new Date(videoData.timestamp * 1000) : new Date();
            const formattedCaption = this.formatFacebookCaption(videoData.description || videoData.title, source.platform, source.url);
            videoRecord = await this.prisma.video.create({
              data: {
                title: formattedCaption,
                description: formattedCaption,
                originalId: platformVideoId,
                publishedAt: publishedAt,
                url: videoData.webpage_url || videoData.url || '',
                sourceId: source.id,
              },
              include: { uploads: true }
            });
          }

          const targetMappings = dueMappingIds 
            ? source.mappings.filter(m => dueMappingIds.includes(m.id))
            : source.mappings;

          for (const mapping of targetMappings) {
            const alreadyQueued = videoRecord.uploads?.some(u => u.facebookPageId === mapping.facebookPageId);
            if (!alreadyQueued) {
              await this.prisma.uploadHistory.create({
                data: {
                  videoId: videoRecord.id,
                  facebookPageId: mapping.facebookPageId,
                  status: 'PENDING'
                }
              });

              if (mapping.scheduledTime) {
                await this.prisma.mapping.update({
                  where: { id: mapping.id },
                  data: { lastScheduledRun: new Date() }
                });
              }
            }
          }
        } catch (e) {
          this.logger.error(`Error parsing video data: ${e.message}`);
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
            '-s', '-X', 'POST',
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
        where: { platform: 'MEGA_CLOUD', url: `cloud://${page.id}` }
      });
      
      if (!cloudSource) {
        cloudSource = await this.prisma.source.create({
          data: {
            platform: 'MEGA_CLOUD',
            name: `Cloud Uploads (${page.name})`,
            url: `cloud://${page.id}`,
            userId: page.userId,
          }
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

      this.logsService.log('INFO', `Successfully saved cloud video ${videoTitle} to Mega. It will be posted at the scheduled time!`);
      return { success: true, message: 'Video uploaded to Cloud and scheduled successfully!' };
    } catch (e: any) {
      this.logger.error(`Error in processCloudUpload: ${e.message}`, e.stack);
      this.logsService.log('ERROR', `Cloud upload failed: ${e.message}`);
      throw e;
    }
  }


  async processPendingUploads() {
    if (this.isProcessing) {
      this.logger.log('Already processing uploads, skipping this cycle.');
      return;
    }
    
    this.isProcessing = true;
    try {
      const pendingUpload = await this.prisma.uploadHistory.findFirst({
        where: { status: 'PENDING' },
        include: { video: true, facebookPage: true },
        orderBy: { createdAt: 'asc' }
      });

      if (!pendingUpload) {
        return;
      }

      this.logger.log(`Processing upload: ${pendingUpload.id} for video: ${pendingUpload.video.title}`);
      
      await this.prisma.uploadHistory.update({
        where: { id: pendingUpload.id },
        data: { status: 'PROCESSING' }
      });

      try {
        await this.downloadAndUpload(pendingUpload);
      } catch (err) {
        this.logsService.log('ERROR', `Upload failed for ${pendingUpload.video.title}: ${err.message}`);
        await this.prisma.uploadHistory.update({
          where: { id: pendingUpload.id },
          data: { status: 'FAILED', errorMessage: err.message }
        });
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

    if (targetUrl.includes('tiktok.com')) {
      this.logger.log(`Extracting fresh TikTok MP4 stream for upload: ${targetUrl}`);
      
      try {
        const tkVideos = await this.extractTikTokVideos(targetUrl, 1);
        const tkVideo = tkVideos.length > 0 ? tkVideos[0] : null;
        if (tkVideo && tkVideo.mp4Url) {
          videoUrl = tkVideo.mp4Url;
          this.logsService.log('INFO', `Successfully acquired fresh TikTok video stream via TikWM/extractTikTokVideo.`);
        }
      } catch (err: any) {
        this.logger.warn(`Fresh stream extraction failed for TikTok: ${err.message}`);
      }
      
      // Fallback to the one saved in the database during sync
      if (!videoUrl && video.mp4Url) {
        this.logger.log(`Using database fallback MP4 stream for TikTok.`);
        videoUrl = video.mp4Url;
      }
      
      // Fallback to yt-dlp for extraction
      if (!videoUrl && targetUrl) {
         this.logsService.log('INFO', 'Attempting to extract TikTok MP4 stream using universal yt-dlp fallback...');
         try {
            const ytDlpCmd = this.getYtDlpCmd();
            const cmd = `${ytDlpCmd} --cookies cookies.txt --dump-json "${targetUrl}"`;
            const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
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
    } else if (targetUrl.includes('xiaohongshu.com') || targetUrl.includes('xhslink') || targetUrl.includes('rednote') || targetUrl.includes('xhs')) {
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
    } else if (targetUrl.includes('mega.nz')) {
       this.logger.log(`Downloading video from Mega.nz: ${targetUrl}`);
       const downloadedPath = await this.megaService.downloadFile(targetUrl);
       if (downloadedPath && fs.existsSync(downloadedPath)) {
          this.logsService.log('INFO', `Successfully downloaded video from Mega.nz to ${downloadedPath}`);
          videoUrl = 'local://' + downloadedPath; // signal that it's already a local file
       } else {
          throw new Error(`Failed to download video from Mega.nz: ${targetUrl}`);
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
    const isXhsOrRedNote = targetUrl.includes('xiaohongshu.com') || targetUrl.includes('xhslink') || targetUrl.includes('rednote') || videoUrl.includes('xhs') || videoUrl.includes('sns-video') || videoUrl.includes('xiaohongshu');

    const sourcePlatform = uploadHistory.video?.source?.platform;
    const finalDescription = this.formatFacebookCaption(video.description || video.title, sourcePlatform, targetUrl || videoUrl);

    if (isMegaLocal) {
      const localFilePath = videoUrl.replace('local://', '');
      this.logsService.log('INFO', `Uploading physical video from Mega directly to Facebook...`);
      fbData = await new Promise((resolve, reject) => {
         const { spawn } = require('child_process');
         const curl = spawn('curl', [
            '-s', '-X', 'POST',
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
               const ytDlpCmd = this.getYtDlpCmd();
               const cmd = `${ytDlpCmd} --cookies cookies.txt -o "${tempPath}" "${targetUrl}"`;
               await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
            } else {
               throw err;
            }
          }
        }
        this.logsService.log('INFO', `Downloaded MP4 file to ${tempPath}. Uploading physical video directly to Facebook using highly reliable cURL stream...`);

        fbData = await new Promise((resolve, reject) => {
           const { spawn } = require('child_process');
           const curl = spawn('curl', [
              '-s',
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
        const res = await fetch(mirror.url, { headers, redirect: 'follow' });
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
        const res = await fetch(`${baseUrl}?username=${username}`);
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
           } 
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

  private async extractTikTokVideos(rawUrl: string, limit = 5): Promise<any[]> {
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
