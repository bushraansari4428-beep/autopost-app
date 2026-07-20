import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CronService.name);
  private timer: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('monitor-sources') private readonly monitorQueue: Queue,
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
    console.log('==== CRON handleCron CALLED ====');
    this.logger.log('Starting scheduled source monitoring...');
    try {
      const sources = await this.prisma.source.findMany();
      if (sources.length === 0) {
        this.logger.log('No sources found to monitor.');
        return;
      }

      let count = 0;
      for (const source of sources) {
        // Add job to monitoring queue
        await this.monitorQueue.add(
          'monitor',
          { sourceId: source.id },
          {
            jobId: `monitor-${source.id}-${Date.now()}`,
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        count++;
      }

      this.logger.log(`Queued ${count} sources for monitoring.`);
    } catch (error) {
      this.logger.error(`Error in scheduled monitoring: ${error.message}`);
    }
  }
}

