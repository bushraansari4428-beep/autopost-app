import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from './sync.service';
import { LogsService } from '../logs/logs.service';

@Injectable()
export class CronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private timer: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly syncService: SyncService,
    private readonly logsService: LogsService,
  ) {}

  onModuleInit() {
    console.log('==== CRON SERVICE onModuleInit EXECUTION STARTED ====');
    // Run every 5 minutes (300000 ms)
    this.timer = setInterval(() => {
      console.log('==== CRON setInterval FIRED ====');
      this.handleCron();
    }, 300000);
    this.logger.log('Started native setInterval for source monitoring every 5 minutes.');
    // Run immediately once on startup
    this.handleCron();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  async handleCron() {
    this.logsService.log('INFO', 'Starting scheduled source monitoring...');
    try {
      const sources = await this.prisma.source.findMany();
      if (sources.length === 0) {
        this.logsService.log('INFO', 'No sources found to monitor.');
        return;
      }

      let count = 0;
      for (const source of sources) {
        await this.syncService.monitorSource(source.id);
        count++;
      }

      this.logsService.log('INFO', `Checked ${count} sources for monitoring.`);

      // After checking sources, process any pending uploads
      await this.syncService.processPendingUploads();
    } catch (error) {
      this.logsService.log('ERROR', `Error in scheduled monitoring: ${error.message}`);
    }
  }
}

