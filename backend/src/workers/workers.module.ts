import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { LogsModule } from '../logs/logs.module';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
    LogsModule,
  ],
  providers: [
    SyncService,
    CronService,
  ],
  exports: [SyncService],
})
export class WorkersModule {}
