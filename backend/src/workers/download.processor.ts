import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import { execPromise } from '../utils/exec.util';

@Processor('download-video')
export class DownloadProcessor extends WorkerHost {
  private readonly logger = new Logger(DownloadProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('upload-facebook') private uploadQueue: Queue
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { videoId } = job.data;
    this.logger.log(`Processing download job for video: ${videoId}`);
    
    const video = await this.prisma.video.findUnique({
      where: { id: videoId },
      include: { source: { include: { mappings: true } } }
    });

    if (!video) {
      this.logger.error(`Video not found: ${videoId}`);
      return;
    }

    if (video.source.mappings.length === 0) {
      this.logger.log(`No mappings for source ${video.source.id}, skipping download.`);
      return;
    }

    try {
      // Ensure downloads dir exists
      const downloadsDir = path.join(process.cwd(), 'downloads');
      if (!fs.existsSync(downloadsDir)) {
        fs.mkdirSync(downloadsDir, { recursive: true });
      }

      const outputTemplate = path.join(downloadsDir, `${video.originalId}.%(ext)s`);
      // Best video+audio, merge to mp4
      const cmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${video.url}"`;
      
      this.logger.log(`Downloading video: ${video.url}`);
      await execPromise(cmd);

      // Find the downloaded file
      const files = fs.readdirSync(downloadsDir);
      const downloadedFile = files.find(f => f.startsWith(video.originalId));
      
      if (!downloadedFile) {
        throw new Error('Downloaded file not found on disk');
      }

      const localPath = path.join(downloadsDir, downloadedFile);

      this.logger.log(`Downloaded to ${localPath}. Queueing upload jobs...`);

      // Queue upload for each mapped page
      for (const mapping of video.source.mappings) {
        // Create an UploadHistory record as PENDING
        const uploadHistory = await this.prisma.uploadHistory.create({
          data: {
            videoId: video.id,
            facebookPageId: mapping.facebookPageId,
            status: 'PENDING'
          }
        });

        await this.uploadQueue.add('upload', {
          uploadHistoryId: uploadHistory.id
        });
      }

      return { status: 'Download completed' };
    } catch (error) {
      this.logger.error(`Failed to download video ${videoId}: ${error.message}`);
      throw error;
    }
  }
}

