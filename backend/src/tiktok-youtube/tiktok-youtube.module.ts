import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LogsModule } from '../logs/logs.module';
import { WorkersModule } from '../workers/workers.module';
import { YoutubeService } from './youtube.service';
import { TiktokYoutubeService } from './tiktok-youtube.service';
import { TiktokYoutubeController } from './tiktok-youtube.controller';

@Module({
  imports: [PrismaModule, LogsModule, WorkersModule],
  controllers: [TiktokYoutubeController],
  providers: [YoutubeService, TiktokYoutubeService],
  exports: [YoutubeService, TiktokYoutubeService],
})
export class TiktokYoutubeModule {}
