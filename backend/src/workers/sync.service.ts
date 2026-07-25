import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { LogsService } from '../logs/logs.service';
import { execPromise } from '../utils/exec.util';
import * as fs from 'fs';
import * as path from 'path';
import Parser from 'rss-parser';
import { InstagramRelayClient } from './instagram-relay.client';

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
  ) {}

  async testMapping(mappingId: string) {
    const mapping = await this.prisma.mapping.findUnique({
      where: { id: mappingId },
      include: { source: true }
    });
    if (!mapping) return { success: false, message: 'Mapping not found' };

    this.logsService.log('INFO', `Starting TEST for mapping: ${mapping.id}`);
    
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
      if (mapping.source.url.includes('/channel/UC')) {
        const channelId = mapping.source.url.split('/channel/')[1].split('/')[0].split('?')[0];
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

        } else if (mapping.source.platform === 'XIAOHONGSHU' || mapping.source.platform === 'KUAISHOU') {
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
        } else {
          for (const url of urlsToScan) {
            let cmd: string;
            if (mapping.source.platform === 'TIKTOK') {
              cmd = `./yt-dlp --flat-playlist --playlist-end 1 --print id "${url}"`;
            } else {
              cmd = `./yt-dlp --cookies cookies.txt --dump-json --playlist-end 1 "${url}"`;
            }

            try {
              const { stdout, stderr } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
              
              if (stdout && stdout.trim()) {
                if (mapping.source.platform === 'TIKTOK') {
                  const videoId = stdout.trim().split('\n')[0].trim();
                  if (videoId) {
                    latestVideo = {
                      id: videoId,
                      url: `${url}/video/${videoId}`,
                      title: `TikTok Video ${videoId}`,
                      timestamp: Math.floor(Date.now() / 1000)
                    };
                    break;
                  }
                } else {
                  latestVideo = JSON.parse(stdout);
                  break;
                }
              }
            } catch (e: any) {
              this.logsService.log('ERROR', `yt-dlp error: ${e.message.substring(0, 200)}...`);
            }
          }
        }
      }

      if (!latestVideo) {
        this.logsService.log('ERROR', `Test failed: No videos found at source ${mapping.source.url}`);
        return { success: false, message: 'No videos found' };
      }

      this.logsService.log('INFO', `Test: Found video ${latestVideo.title}. Queuing for upload.`);
      
      const publishedAt = latestVideo.timestamp ? new Date(latestVideo.timestamp * 1000) : new Date();
      
      // Use random ID for test to avoid unique constraint
      const newVideo = await this.prisma.video.create({
        data: {
          title: '[TEST] ' + latestVideo.title,
          description: latestVideo.description || '',
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

      // Run uploads async
      this.processPendingUploads().catch(e => console.error(e));

      return { success: true, message: 'Test video found and queued for processing. Check Logs for progress.' };

    } catch (e) {
      return { success: false, message: e.message };
    }
  }

  async monitorSource(sourceId: string) {
    this.logger.log(`Processing monitoring job for source: ${sourceId}`);
    
    const source = await this.prisma.source.findUnique({ 
      where: { id: sourceId },
      include: { mappings: true }
    });
    if (!source) {
      this.logger.error(`Source not found: ${sourceId}`);
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

      if (source.url.includes('/channel/UC')) {
        const channelId = source.url.split('/channel/')[1].split('/')[0].split('?')[0];
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

        } else if (source.platform === 'XIAOHONGSHU' || source.platform === 'KUAISHOU') {
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
      
      if (latestVideos.length === 0 && source.platform !== 'INSTAGRAM') {
        for (const url of urlsToScan) {
          let cmd: string;
          if (source.platform === 'TIKTOK') {
            cmd = `./yt-dlp --flat-playlist --playlist-end 1 --print id "${url}"`;
          } else {
            cmd = `./yt-dlp --cookies cookies.txt --dump-json --playlist-end 1 "${url}"`;
          }

          try {
            this.logger.log(`Scanning URL: ${url}`);
            const { stdout, stderr } = await execPromise(cmd, {
              maxBuffer: 1024 * 1024 * 50,
            });

            if (stdout && stdout.trim()) {
              if (source.platform === 'TIKTOK') {
                const videoId = stdout.trim().split('\n')[0].trim();
                if (videoId) {
                  latestVideos.push({
                    id: videoId,
                    url: `${url}/video/${videoId}`,
                    title: `TikTok Video ${videoId}`,
                    timestamp: Math.floor(Date.now() / 1000)
                  });
                  this.logger.log(`Found TikTok video: ${videoId}`);
                  break;
                }
              } else {
                latestVideos.push(JSON.parse(stdout));
                this.logger.log(`Found YouTube video: ${latestVideos[0].title}`);
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
      
      for (const videoData of latestVideos) {
        try {
          const platformVideoId = videoData.id;
          
          const existing = await this.prisma.video.findFirst({
            where: {
              sourceId: source.id,
              originalId: platformVideoId
            }
          });

          if (!existing) {
            this.logsService.log('INFO', `Found new video: ${videoData.title}`);
            const publishedAt = videoData.timestamp ? new Date(videoData.timestamp * 1000) : new Date();
            const newVideo = await this.prisma.video.create({
              data: {
                title: videoData.title,
                description: videoData.description || '',
                originalId: platformVideoId,
                publishedAt: publishedAt,
                url: videoData.webpage_url || videoData.url || '',
                sourceId: source.id,
              }
            });

            for (const mapping of source.mappings) {
              await this.prisma.uploadHistory.create({
                data: {
                  videoId: newVideo.id,
                  facebookPageId: mapping.facebookPageId,
                  status: 'PENDING'
                }
              });
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
    
    this.logsService.log('INFO', `Starting native direct upload for ${video.title}...`);
    
    const ytId = video.originalId.replace('test_', '').split('_')[0];
    const targetUrl = video.url ? video.url : `https://www.youtube.com/watch?v=${ytId}`;
    const encodedUrl = encodeURIComponent(targetUrl);
    
    let videoUrl = null;

    if (targetUrl.includes('tiktok.com')) {
      this.logger.log(`Requesting tikwm for TikTok video: ${targetUrl}`);
      const tikwmRes = await fetch(`https://www.tikwm.com/api/?url=${encodedUrl}`);
      const tikwmData = await tikwmRes.json();
      
      if (tikwmData && tikwmData.code === 0 && tikwmData.data && tikwmData.data.play) {
        videoUrl = tikwmData.data.play;
        this.logsService.log('INFO', `Successfully got TikTok video URL from tikwm.`);
      } else {
        throw new Error(`Failed to get TikTok video URL from tikwm. Response: ${JSON.stringify(tikwmData)}`);
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
    } else if (targetUrl.includes('xiaohongshu.com')) {
       this.logger.log(`Xiaohongshu download bypass for URL: ${targetUrl}`);
       const proxyUrl = process.env.CLOUDFLARE_PROXY_URL;
       const finalUrl = proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}` : targetUrl;
       
       const res = await fetch(finalUrl, { 
           headers: { 
             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
           } 
       });
       const html = await res.text();
       const mp4Match = html.match(/(https?:\/\/[^"]+\.mp4[^"]*)/);
       if (mp4Match && mp4Match[1]) {
           videoUrl = mp4Match[1];
           this.logsService.log('INFO', `Successfully got Xiaohongshu MP4 video URL via Cloudflare Proxy.`);
       } else {
           throw new Error(`Failed to extract MP4 URL from Xiaohongshu HTML. Post might be images only or rate limited.`);
       }
    } else {
      this.logger.log(`Requesting loader.to for YouTube video: ${ytId}`);
      const loaderRes = await fetch(`https://loader.to/ajax/download.php?format=720&url=${encodedUrl}`);
      const loaderData = await loaderRes.json();
      
      if (!loaderData || !loaderData.id) {
        throw new Error(`Failed to initialize loader.to download. Response: ${JSON.stringify(loaderData)}`);
      }
      
      const downloadId = loaderData.id;
      this.logsService.log('INFO', `Waiting for loader.to processing (ID: ${downloadId})...`);
      
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
    
    this.logsService.log('INFO', `Successfully got direct video URL! Sending to Facebook...`);
    this.logger.log(`Direct URL: ${videoUrl}`);
    
    // Upload to Facebook using file_url
    const fbRes = await fetch(`https://graph-video.facebook.com/v19.0/${pageId}/videos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        access_token: accessToken,
        file_url: videoUrl,
        description: video.title
      })
    });
    
    const fbData = await fbRes.json();
    
    if (!fbRes.ok || fbData.error) {
      throw new Error(`Facebook API Error: ${JSON.stringify(fbData.error || fbData)}`);
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
        const targetUrl = `https://www.xiaohongshu.com/user/profile/${userId}`;
        const finalUrl = proxyUrl ? `${proxyUrl.replace(/\/$/, '')}/?url=${encodeURIComponent(targetUrl)}` : targetUrl;
        
        const response = await fetch(finalUrl, { headers });
        const html = await response.text();
        
        // Extract __INITIAL_STATE__
        const match = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\});/s) || html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.*?\})<\/script>/s);
        if (match && match[1]) {
          try {
             const jsonStr = match[1].replace(/undefined/g, 'null');
             const state = JSON.parse(jsonStr);
             const notes = state?.user?.notes ?? state?.user?.noteList ?? state?.user?.profile?.notes ?? [];
             if (notes && notes.length > 0) {
                const latestNoteId = notes[0].noteId ?? notes[0].id;
                return `https://www.xiaohongshu.com/explore/${latestNoteId}`;
             }
          } catch (e) {
             this.logger.warn(`Failed to parse XHS JSON state: ${e}`);
          }
        } else {
           this.logger.warn(`Could not find __INITIAL_STATE__ in XHS HTML`);
        }
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
}
