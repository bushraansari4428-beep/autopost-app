import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
  ],
  providers: [
    SyncService,
    CronService,
  ],
})
export class WorkersModule {}
