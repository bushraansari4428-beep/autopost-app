import { Module } from '@nestjs/common';
import { SyncService } from './sync.service';
import { CronService } from './cron.service';
import { PrismaModule } from '../prisma/prisma.module';
import { FacebookModule } from '../facebook/facebook.module';
import { LogsModule } from '../logs/logs.module';
import { InstagramWebhookController } from './instagram-webhook.controller';
import { InstagramRelayClient } from './instagram-relay.client';
import { MegaService } from './mega.service';

@Module({
  imports: [
    PrismaModule,
    FacebookModule,
    LogsModule,
  ],
  controllers: [
    InstagramWebhookController
  ],
  providers: [
    SyncService,
    CronService,
    InstagramRelayClient,
    MegaService,
  ],
  exports: [SyncService, InstagramRelayClient, MegaService],
})
export class WorkersModule {}
