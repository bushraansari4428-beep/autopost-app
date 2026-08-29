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

  async getRecentLogs(user?: any, limit = 100) {
    if (!user || user.role === 'ADMIN') {
      return this.prisma.log.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
    }

    try {
      // Find non-admin user's owned pages and sources
      const [userPages, userSources] = await Promise.all([
        this.prisma.facebookPage.findMany({
          where: { userId: user.id },
          select: { name: true, pageId: true }
        }),
        this.prisma.source.findMany({
          where: { userId: user.id },
          select: { name: true, url: true }
        })
      ]);

      const pageKeywords = userPages.flatMap(p => [p.name, p.pageId]).filter(Boolean).map(s => s.trim().toLowerCase());
      const sourceKeywords = userSources.flatMap(s => [s.name, s.url]).filter(Boolean).map(s => s.trim().toLowerCase());
      const allKeywords = [...new Set([...pageKeywords, ...sourceKeywords])].filter(k => k.length >= 3);

      // If user has no connected sources or pages, return empty logs
      if (allKeywords.length === 0) {
        return [];
      }

      // Fetch recent candidate logs
      const candidateLogs = await this.prisma.log.findMany({
        orderBy: { createdAt: 'desc' },
        take: 300,
      });

      const userLogs = candidateLogs.filter(log => {
        // Direct meta user attribution
        if (log.meta && typeof log.meta === 'object' && (log.meta as any).userId === user.id) {
          return true;
        }

        const msg = (log.message || '').toLowerCase();
        return allKeywords.some(keyword => msg.includes(keyword));
      });

      return userLogs.slice(0, limit);
    } catch (e: any) {
      this.logger.error(`Error filtering logs for user ${user?.id}: ${e.message}`);
      return [];
    }
  }
}
