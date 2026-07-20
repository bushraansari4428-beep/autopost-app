import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
import * as fs from 'fs';
import * as path from 'path';

@Processor('upload-facebook')
export class UploadProcessor extends WorkerHost {
  private readonly logger = new Logger(UploadProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly facebookService: FacebookService,
  ) {
    super();
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const { uploadHistoryId } = job.data;
    this.logger.log(`Processing upload job for UploadHistory: ${uploadHistoryId}`);
    
    const history = await this.prisma.uploadHistory.findUnique({
      where: { id: uploadHistoryId },
      include: { video: true, facebookPage: true }
    });

    if (!history) {
      throw new Error(`UploadHistory not found: ${uploadHistoryId}`);
    }

    try {
      const destination = history.facebookPage;
      const video = history.video;
      
      const pageId = destination.pageId;
      const accessToken = destination.accessToken;

      const downloadsDir = path.join(process.cwd(), 'downloads');
      if (!fs.existsSync(downloadsDir)) {
        throw new Error(`Downloads directory not found`);
      }
      const files = fs.readdirSync(downloadsDir);
      const downloadedFile = files.find(f => f.startsWith(video.originalId));
      if (!downloadedFile) {
        throw new Error(`File not found for video: ${video.originalId}`);
      }
      const localPath = path.join(downloadsDir, downloadedFile);

      const stat = fs.statSync(localPath);
      const fileSize = stat.size;

      // 2. Initialize upload session
      const { uploadSessionId } = await this.facebookService.initializeUpload(pageId, accessToken, fileSize);

      // 3. Upload file in chunks (chunk size: 10MB)
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

      // 4. Finish upload
      const result = await this.facebookService.finishUpload(pageId, accessToken, uploadSessionId, video.title, video.description || undefined);
      
      // 5. Update Upload status
      await this.prisma.uploadHistory.update({
        where: { id: uploadHistoryId },
        data: { 
          status: 'COMPLETED',
          facebookPostId: result.id || result.video_id
        }
      });
      
      this.logger.log(`Upload completed successfully: FB Video ID ${result.id || result.video_id}`);
      return { status: 'Upload completed', facebookVideoId: result.id || result.video_id };
    } catch (error) {
      await this.prisma.uploadHistory.update({
        where: { id: uploadHistoryId },
        data: { 
          status: 'FAILED',
          errorMessage: error.message
        }
      });
      this.logger.error(`Upload failed: ${error.message}`);
      throw error;
    }
  }
}

