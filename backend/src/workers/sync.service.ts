import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import { LogsService } from '../logs/logs.service';
import { execPromise } from '../utils/exec.util';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private isProcessing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
    private readonly logsService: LogsService,
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

      if (!latestVideo && workerUrl) {
        for (const url of urlsToScan) {
          const cmd = `./yt-dlp --cookies cookies.txt --dump-json --playlist-end 1 "${url}"`;
          try {
            const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
            const lines = stdout.split('\n').filter(line => line.trim() !== '');
            if (lines.length > 0) {
              latestVideo = JSON.parse(lines[0]);
              break;
            }
          } catch (e) {
            // ignore
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

      if (latestVideos.length === 0 && workerUrl) {
        this.logger.log(`Using Cloudflare Worker for metadata extraction: ${source.url}`);
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
      } else if (latestVideos.length === 0) {
        for (const url of urlsToScan) {
          const cmd = `./yt-dlp --cookies cookies.txt --dump-json --playlist-end 5 "${url}"`;
          this.logger.log(`Running yt-dlp for ${url}`);
          try {
            const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
            const lines = stdout.split('\n').filter(line => line.trim() !== '');
            const parsed = lines.map(line => {
              try {
                return JSON.parse(line);
              } catch (e) {
                return null;
              }
            }).filter(Boolean);
            
            latestVideos = latestVideos.concat(parsed);
          } catch (e) {
            this.logger.error(`Error running yt-dlp for ${url}: ${e.message}`);
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
    const encodedUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${ytId}`);
    
    this.logger.log(`Requesting loader.to for ${ytId}`);
    const loaderRes = await fetch(`https://loader.to/ajax/download.php?format=720&url=${encodedUrl}`);
    const loaderData = await loaderRes.json();
    
    if (!loaderData || !loaderData.id) {
      throw new Error(`Failed to initialize loader.to download. Response: ${JSON.stringify(loaderData)}`);
    }
    
    const downloadId = loaderData.id;
    this.logsService.log('INFO', `Waiting for loader.to processing (ID: ${downloadId})...`);
    
    let videoUrl = null;
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
    
    if (!videoUrl) {
      throw new Error('Timed out waiting for loader.to to process the video.');
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
}
