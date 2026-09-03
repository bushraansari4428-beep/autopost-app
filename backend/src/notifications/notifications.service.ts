import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AlertItem {
  id: string;
  type: 'TOKEN_INVALID' | 'UPLOAD_FAILED' | 'SYSTEM_WARN';
  severity: 'CRITICAL' | 'WARNING';
  title: string;
  message: string;
  pageName?: string;
  timestamp: string;
  actionText?: string;
  actionUrl?: string;
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private dismissedAlertIds = new Set<string>();

  constructor(private readonly prisma: PrismaService) {}

  async getActiveAlerts(): Promise<{ count: number; alerts: AlertItem[] }> {
    const alerts: AlertItem[] = [];

    // 1. Check for Facebook Page Access Token invalidations
    const pages = await this.prisma.facebookPage.findMany();
    for (const page of pages) {
      // Check if recent upload had token invalidation error
      const recentTokenError = await this.prisma.uploadHistory.findFirst({
        where: {
          facebookPageId: page.id,
          status: 'FAILED',
          errorMessage: {
            contains: 'access token',
            mode: 'insensitive'
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      if (recentTokenError) {
        const alertId = `token_${page.id}_${recentTokenError.id}`;
        if (!this.dismissedAlertIds.has(alertId)) {
          alerts.push({
            id: alertId,
            type: 'TOKEN_INVALID',
            severity: 'CRITICAL',
            title: `Facebook Token Expired: ${page.name}`,
            message: `Facebook ne ${page.name} ka access token invalidate kar diya hai. Password tabdeel hone ya security session expire hone ki wajah se videos post nahi ho sakeingi. Barah-e-karam page ko foran reconnect karein.`,
            pageName: page.name,
            timestamp: recentTokenError.createdAt.toISOString(),
            actionText: 'Reconnect Page',
            actionUrl: '/dashboard/pages'
          });
        }
      }
    }

    // 2. Check for other recent failed uploads (within last 48 hours)
    const twoDaysAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);
    const failedUploads = await this.prisma.uploadHistory.findMany({
      where: {
        status: 'FAILED',
        createdAt: { gte: twoDaysAgo },
        NOT: {
          errorMessage: {
            contains: 'access token',
            mode: 'insensitive'
          }
        }
      },
      include: {
        facebookPage: true,
        video: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    for (const failed of failedUploads) {
      const alertId = `upload_failed_${failed.id}`;
      if (!this.dismissedAlertIds.has(alertId)) {
        const rawErr = failed.errorMessage || 'Unknown upload error';
        let cleanErr = rawErr;
        if (rawErr.includes('Playwright/TikWM both failed')) {
          cleanErr = 'Video stream could not be extracted (photo slideshow or restricted video).';
        }

        alerts.push({
          id: alertId,
          type: 'UPLOAD_FAILED',
          severity: 'WARNING',
          title: `Upload Failed: ${failed.facebookPage?.name || 'Page'}`,
          message: `Video "${failed.video?.title?.slice(0, 45) || 'Untitled'}" upload nahi ho saki: ${cleanErr}`,
          pageName: failed.facebookPage?.name,
          timestamp: failed.createdAt.toISOString(),
          actionText: 'View History',
          actionUrl: '/dashboard/history'
        });
      }
    }

    return {
      count: alerts.length,
      alerts
    };
  }

  dismissAlert(alertId: string) {
    this.dismissedAlertIds.add(alertId);
    return { success: true };
  }

  dismissAll(alertIds: string[]) {
    for (const id of alertIds) {
      this.dismissedAlertIds.add(id);
    }
    return { success: true };
  }
}
