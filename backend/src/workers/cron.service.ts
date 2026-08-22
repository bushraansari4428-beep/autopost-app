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
    this.logger.log('==== CRON SERVICE INIT (Auto-timer enabled: 1 minute) ====');
    // Run every 1 minute (60000 ms)
    this.timer = setInterval(() => this.handleCron(), 60000);
    // Also run immediately on startup
    this.handleCron();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async handleCron() {
    // this.logsService.log('INFO', 'Starting scheduled source monitoring...');
    try {
      const sources = await this.prisma.source.findMany({
        where: {
          mappings: { some: {} }
        },
        include: { mappings: true }
      });
      if (sources.length === 0) {
        // this.logsService.log('INFO', 'No sources found to monitor.');
        return;
      }

      // Calculate current PKT time (UTC+5)
      const nowUTC = new Date();
      const pktTime = new Date(nowUTC.getTime() + (5 * 60 * 60 * 1000));
      const currentPktTimeStr = `${pktTime.getUTCHours().toString().padStart(2, '0')}:${pktTime.getUTCMinutes().toString().padStart(2, '0')}`;
      const pkHours = pktTime.getUTCHours();
      const pkMinutes = pktTime.getUTCMinutes();
      const todayPktDateString = pktTime.toISOString().split('T')[0];

      let hasWorkToDo = false;
      let count = 0;
      for (const source of sources) {
        const dueMappingIds: string[] = [];
        
        let shouldMonitorExternal = false;
        if (source.platform !== 'MEGA_CLOUD') {
           const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000);
           if (!source.lastChecked || source.lastChecked <= thirtyMinsAgo) {
             shouldMonitorExternal = true;
           }
        }

        for (const mapping of source.mappings) {
          if (source.platform === 'MEGA_CLOUD') {
            if (!mapping.scheduledTime || mapping.scheduledTime === '00:00') {
              dueMappingIds.push(mapping.id);
              continue;
            }

            const [schedH, schedM] = mapping.scheduledTime.split(':').map(Number);
            const schedTotalMins = schedH * 60 + schedM;
            const currentTotalMins = pkHours * 60 + pkMinutes;

            if (currentTotalMins >= schedTotalMins && currentTotalMins <= schedTotalMins + 5) {
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
          } else {
            if (!mapping.scheduledTime || mapping.scheduledTime === '00:00') {
              if (shouldMonitorExternal) {
                dueMappingIds.push(mapping.id);
              }
            } else {
              const [schedH, schedM] = mapping.scheduledTime.split(':').map(Number);
              const schedTotalMins = schedH * 60 + schedM;
              const currentTotalMins = pkHours * 60 + pkMinutes;

              if (currentTotalMins >= schedTotalMins && currentTotalMins <= schedTotalMins + 5) {
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
          }
        }

        if (dueMappingIds.length > 0) {
          if (process.env.GITHUB_ACTIONS === 'true' || process.env.IS_WORKER === 'true') {
             await this.syncService.monitorSource(source.id, dueMappingIds);
          }
          hasWorkToDo = true;
          count++;
        }
      }

      const pendingUploads = await this.prisma.uploadHistory.count({ where: { status: 'PENDING' } });
      if (pendingUploads > 0) {
        hasWorkToDo = true;
      }

      if (process.env.GITHUB_ACTIONS === 'true' || process.env.IS_WORKER === 'true') {
        await this.syncService.processPendingUploads();
      } else {
        if (hasWorkToDo) {
           await this.triggerGithubWorker();
        }
      }

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

  private lastGithubTriggerTime = 0;

  private async triggerGithubWorker() {
    const now = Date.now();
    // Prevent triggering more than once every 5 minutes (300,000 ms)
    if (now - this.lastGithubTriggerTime < 300000) {
       return;
    }

    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
       this.logger.error('GITHUB_TOKEN missing. Cannot trigger GitHub Actions worker.');
       return;
    }

    try {
      this.lastGithubTriggerTime = now;
      this.logger.log('Triggering GitHub Actions Worker (Heavy Data Plane)...');
      
      const response = await fetch('https://api.github.com/repos/bushraansari4428-beep/autopost-app/actions/workflows/auto-scraper.yml/dispatches', {
        method: 'POST',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'Authorization': `token ${githubToken}`,
          'User-Agent': 'AutoPost-App-Orchestrator'
        },
        body: JSON.stringify({
          ref: 'main'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`GitHub API error: ${response.status} - ${errorText}`);
      } else {
        this.logger.log('Successfully dispatched GitHub Actions Worker!');
      }
    } catch (err: any) {
      this.logger.error(`Failed to trigger GitHub Actions: ${err.message}`);
    }
  }
}

