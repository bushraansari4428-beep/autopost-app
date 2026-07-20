import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { execPromise } from '../utils/exec.util';

@Processor('monitor-sources')
export class MonitoringProcessor extends WorkerHost {
  private readonly logger = new Logger(MonitoringProcessor.name);

  constructor(
    private prisma: PrismaService,
    @InjectQueue('download-video') private downloadQueue: Queue
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { sourceId } = job.data;
    this.logger.log(`Processing monitoring job for source: ${sourceId}`);
    
    const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
    if (!source) {
      this.logger.error(`Source not found: ${sourceId}`);
      return;
    }

    try {
      // Use yt-dlp to get the latest 5 videos from the source URL
      // --dump-json outputs JSON for each video
      // --playlist-end 5 limits to 5 videos
      // --flat-playlist is fast, but we might need actual data. Let's use it without flat first.
      const cmd = `yt-dlp --dump-json --playlist-end 5 "${source.url}"`;
      this.logger.log(`Running yt-dlp for ${source.url}`);
      
      const { stdout } = await execPromise(cmd, { maxBuffer: 1024 * 1024 * 50 }); // 50MB buffer
      const lines = stdout.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        try {
          const videoData = JSON.parse(line);
          const platformVideoId = videoData.id;
          
          // Check if we already have this video
          const existing = await this.prisma.video.findFirst({
            where: {
              sourceId: source.id,
              originalId: platformVideoId
            }
          });

          if (!existing) {
            this.logger.log(`Found new video: ${videoData.title}`);
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

            // Add to download queue
            await this.downloadQueue.add('download', {
              videoId: newVideo.id
            });
          }
        } catch (e) {
          this.logger.error(`Error parsing yt-dlp output line: ${e.message}`);
        }
      }

      await this.prisma.source.update({
        where: { id: source.id },
        data: { lastChecked: new Date() }
      });
      
      return { status: 'Monitoring completed' };
    } catch (error) {
      this.logger.error(`Failed to monitor source ${source.id}: ${error.message}`);
      throw error;
    }
  }
}

