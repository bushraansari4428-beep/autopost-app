import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsService {
  private readonly logger = new Logger(LogsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(level: 'INFO' | 'WARN' | 'ERROR', message: string, meta?: any) {
    // Log to console standard out
    if (level === 'ERROR') {
      this.logger.error(message);
    } else if (level === 'WARN') {
      this.logger.warn(message);
    } else {
      this.logger.log(message);
    }

    // Save to DB
    try {
      await this.prisma.log.create({
        data: {
          level,
          message,
          meta: meta ? meta : undefined,
        },
      });
    } catch (e) {
      this.logger.error(`Failed to save log to DB: ${e.message}`);
    }
  }

  async getRecentLogs(limit = 100) {
    return this.prisma.log.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
