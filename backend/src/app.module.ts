import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { SourcesModule } from './sources/sources.module';
import { PagesModule } from './pages/pages.module';
import { MappingsModule } from './mappings/mappings.module';
import { HistoryModule } from './history/history.module';
import { WorkersModule } from './workers/workers.module';
import { LogsModule } from './logs/logs.module';
import { WebhooksController } from './webhooks.controller';

import { FacebookModule } from './facebook/facebook.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    PrismaModule, 
    AuthModule, 
    SourcesModule,
    PagesModule,
    MappingsModule,
    HistoryModule,
    FacebookModule,
    MailModule,
    UsersModule,
    LogsModule,
    WorkersModule,
  ],
  controllers: [AppController, WebhooksController],
  providers: [AppService],
})
export class AppModule {}
