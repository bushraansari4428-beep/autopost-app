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
      for (const url of urlsToScan) {
        const cmd = `./yt-dlp --cookies cookies.txt --extractor-args "youtube:player_client=android" --dump-json --playlist-end 1 "${url}"`;
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

      let allLines: string[] = [];
      for (const url of urlsToScan) {
        const cmd = `./yt-dlp --cookies cookies.txt --extractor-args "youtube:player_client=android" --dump-json --playlist-end 5 "${url}"`;
        this.logger.log(`Running yt-dlp for ${url}`);
        try {
          const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 });
          const lines = stdout.split('\n').filter(line => line.trim() !== '');
          allLines = allLines.concat(lines);
        } catch (e) {
          this.logger.warn(`Failed to scan ${url}, might not exist or be empty.`);
        }
      }
      
      const lines = allLines;
      
      for (const line of lines) {
        try {
          const videoData = JSON.parse(line);
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

            // Instead of queuing download, we just create PENDING upload histories
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
          this.logger.error(`Error parsing yt-dlp output line: ${e.message}`);
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
      // Find one pending upload to process at a time
      const pendingUpload = await this.prisma.uploadHistory.findFirst({
        where: { status: 'PENDING' },
        include: { video: true, facebookPage: true },
        orderBy: { createdAt: 'asc' }
      });

      if (!pendingUpload) {
        return; // Nothing to process
      }

      this.logger.log(`Processing upload: ${pendingUpload.id} for video: ${pendingUpload.video.title}`);
      
      // Mark as PROCESSING
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

  private async downloadAndUpload(uploadHistory: any) {
    const video = uploadHistory.video;
    const pageId = uploadHistory.facebookPage.pageId;
    const accessToken = uploadHistory.facebookPage.accessToken;

    const downloadsDir = path.join(process.cwd(), 'downloads');
    if (!fs.existsSync(downloadsDir)) {
      fs.mkdirSync(downloadsDir, { recursive: true });
    }

    const outputTemplate = path.join(downloadsDir, `${video.originalId}.%(ext)s`);
    
    // 1. Download
    this.logsService.log('INFO', `Downloading video ${video.title} from YouTube...`);
    const cmd = `./yt-dlp --cookies cookies.txt --extractor-args "youtube:player_client=android" -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${video.url}"`;
    await execPromise(cmd);

    const files = fs.readdirSync(downloadsDir);
    const downloadedFile = files.find(f => f.startsWith(video.originalId));
    if (!downloadedFile) {
      throw new Error('Downloaded file not found on disk');
    }
    const localPath = path.join(downloadsDir, downloadedFile);

    // 2. Upload
    this.logsService.log('INFO', `Uploading ${video.title} to Facebook Page...`);
    const stat = fs.statSync(localPath);
    const fileSize = stat.size;

    const { uploadSessionId } = await this.facebookService.initializeUpload(pageId, accessToken, fileSize);
    const chunkSize = 10 * 1024 * 1024; 
    let startOffset = 0;
    const fd = fs.openSync(localPath, 'r');

    try {
      while (startOffset < fileSize) {
        const buffer = Buffer.alloc(Math.min(chunkSize, fileSize - startOffset));
        fs.readSync(fd, buffer, 0, buffer.length, startOffset);
        
        await this.facebookService.uploadChunk(pageId, accessToken, uploadSessionId, startOffset, buffer);
        startOffset += buffer.length;
        
        this.logger.log(`Uploaded chunk... ${startOffset}/${fileSize} bytes`);
      }
    } finally {
      fs.closeSync(fd);
    }

    const result = await this.facebookService.finishUpload(pageId, accessToken, uploadSessionId, video.title, video.description || undefined);
    
    // 3. Mark Completed
    await this.prisma.uploadHistory.update({
      where: { id: uploadHistory.id },
      data: { 
        status: 'COMPLETED',
        facebookPostId: result.id || result.video_id
      }
    });
    this.logsService.log('INFO', `Upload completed successfully: FB Video ID ${result.id || result.video_id} for ${video.title}`);

    // Optional: Delete the file after successful upload to save disk space immediately!
    try {
      fs.unlinkSync(localPath);
      this.logger.log(`Cleaned up local file: ${localPath}`);
    } catch(e) {
      this.logger.warn(`Failed to clean up file: ${e.message}`);
    }
  }
}
