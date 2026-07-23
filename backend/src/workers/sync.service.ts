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
      
      const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://gentle-grass-709d.bushraansari4428.workers.dev';
      if (workerUrl) {
        this.logger.log(`Using Cloudflare Worker for metadata extraction: ${mapping.source.url}`);
        const infoUrl = `${workerUrl}?url=${encodeURIComponent(mapping.source.url)}&action=info`;
        const res = await fetch(infoUrl);
        if (res.ok) {
          const data = await res.json();
          latestVideo = {
            id: data.id,
            title: data.title,
            url: `https://www.youtube.com/watch?v=${data.id}`,
            timestamp: Math.floor(Date.now() / 1000)
          };
        } else {
          this.logger.error(`Cloudflare worker info failed: ${await res.text()}`);
        }
      } else {
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

      let latestVideos = [];
      const workerUrl = process.env.CLOUDFLARE_WORKER_URL || 'https://gentle-grass-709d.bushraansari4428.workers.dev';
      
      if (workerUrl) {
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
      } else {
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

  private async triggerGitHubAction(uploadHistory: any) {
    const video = uploadHistory.video;
    const pageId = uploadHistory.facebookPage.pageId;
    const accessToken = uploadHistory.facebookPage.accessToken;
    
    this.logsService.log('INFO', `Triggering GitHub Action to download and upload ${video.title}...`);

    const ghPat = process.env.GH_PAT;
    if (!ghPat) {
      throw new Error('GH_PAT environment variable is not set. Cannot trigger GitHub Action.');
    }

    const repo = "bushraansari4428-beep/autopost-app";
    const webhookUrl = "https://autopost-app-1.onrender.com/webhooks/github-action";

    const response = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/post-video.yml/dispatches`, {
      method: 'POST',
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${ghPat}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ref: 'main',
        inputs: {
          videoId: video.originalId.replace('test_', '').split('_')[0],
          pageId: pageId,
          pageAccessToken: accessToken,
          uploadHistoryId: uploadHistory.id,
          webhookUrl: webhookUrl,
          title: video.title
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to trigger GitHub Action: ${response.status} ${errorText}`);
    }

    this.logger.log(`Successfully triggered GitHub Action for video ${video.originalId}`);
    // Status remains PROCESSING, GitHub action will update it to COMPLETED via webhook
  }

  private async downloadAndUpload(uploadHistory: any) {
    await this.triggerGitHubAction(uploadHistory);
  }
}
