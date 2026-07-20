import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { MonitoringProcessor } from './monitoring.processor';
import { DownloadProcessor } from './download.processor';
import { UploadProcessor } from './upload.processor';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
    BullModule.registerQueue(
      { name: 'monitor-sources' },
      { name: 'download-video' },
      { name: 'upload-facebook' },
    ),
  ],
  providers: [
    MonitoringProcessor,
    DownloadProcessor,
    UploadProcessor,
    CronService,
  ],
  exports: [BullModule],
})
export class WorkersModule {}
