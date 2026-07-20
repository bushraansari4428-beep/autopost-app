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
import { BullModule } from '@nestjs/bullmq';
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
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
      },
    }),
    WorkersModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
