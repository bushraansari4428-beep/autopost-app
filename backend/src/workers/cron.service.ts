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
    console.log('==== CRON SERVICE INIT (Auto-timer disabled, awaiting GitHub Actions trigger) ====');
    // We no longer run setInterval here to prevent Render from running out of memory.
    // The handleCron method will be invoked externally by scripts/run-sync.ts
  }

  onModuleDestroy() {
    // No timer to clear
  }

  async handleCron() {
    this.logsService.log('INFO', 'Starting scheduled source monitoring...');
    try {
      const sources = await this.prisma.source.findMany({
        where: {
          mappings: { some: {} }
        },
        include: { mappings: true }
      });
      if (sources.length === 0) {
        this.logsService.log('INFO', 'No sources found to monitor.');
        return;
      }

      // Calculate current PKT time (UTC+5)
      const nowUTC = new Date();
      const pktTime = new Date(nowUTC.getTime() + (5 * 60 * 60 * 1000));
      const currentPktTimeStr = `${pktTime.getUTCHours().toString().padStart(2, '0')}:${pktTime.getUTCMinutes().toString().padStart(2, '0')}`;
      const todayPktDateString = pktTime.toISOString().split('T')[0];

      let count = 0;
      for (const source of sources) {
        const dueMappingIds: string[] = [];
        
        for (const mapping of source.mappings) {
          if (!mapping.scheduledTime) {
            dueMappingIds.push(mapping.id);
            continue;
          }

          if (currentPktTimeStr >= mapping.scheduledTime) {
            if (!mapping.lastScheduledRun) {
              dueMappingIds.push(mapping.id);
            } else {
               const lastRunUTC = new Date(mapping.lastScheduledRun);
               const lastRunPkt = new Date(lastRunUTC.getTime() + (5 * 60 * 60 * 1000));
               const lastRunDateString = lastRunPkt.toISOString().split('T')[0];
               
               if (lastRunDateString !== todayPktDateString) {
                 dueMappingIds.push(mapping.id);
               }
            }
          }
        }

        if (dueMappingIds.length > 0) {
          await this.syncService.monitorSource(source.id, dueMappingIds);
          count++;
        }
      }

      this.logsService.log('INFO', `Checked ${count} sources with due mappings.`);

      // After checking sources, process any pending uploads
      await this.syncService.processPendingUploads();

      // Auto-delete expired users
      try {
        const expiredUsers = await this.prisma.user.findMany({
          where: {
            expiresAt: { lt: new Date() },
            role: { not: 'ADMIN' }
          }
        });
        if (expiredUsers.length > 0) {
          for (const u of expiredUsers) {
            await this.prisma.user.delete({ where: { id: u.id } }).catch(() => null);
            this.logsService.log('INFO', `Auto-deleted expired user: ${u.email}`);
          }
        }
      } catch (err) {
        this.logsService.log('ERROR', `Error auto-deleting users: ${err.message}`);
      }
    } catch (error) {
      this.logsService.log('ERROR', `Error in scheduled monitoring: ${error.message}`);
    }
  }
}

