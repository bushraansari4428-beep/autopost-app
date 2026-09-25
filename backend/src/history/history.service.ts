import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  async getStats(user?: any) {
    const notCloudQueue = {
      NOT: {
        facebookPostId: 'MEGA_CLOUD_UPLOAD'
      }
    };

    const userCondition = (!user || user.role === 'ADMIN') ? {} : {
      OR: [
        { video: { source: { userId: user.id } } },
        { facebookPage: { userId: user.id } }
      ]
    };

    const baseWhere = {
      AND: [
        notCloudQueue,
        userCondition
      ]
    };

    const [completed, failed, processing, total, totalSources, connectedPages] = await Promise.all([
      this.prisma.uploadHistory.count({
        where: {
          ...baseWhere,
          status: 'COMPLETED'
        }
      }),
      this.prisma.uploadHistory.count({
        where: {
          ...baseWhere,
          status: 'FAILED'
        }
      }),
      this.prisma.uploadHistory.count({
        where: {
          ...baseWhere,
          status: { in: ['PROCESSING', 'PENDING'] }
        }
      }),
      this.prisma.uploadHistory.count({
        where: baseWhere
      }),
      this.prisma.source.count({
        where: (!user || user.role === 'ADMIN') ? {} : { userId: user.id }
      }),
      this.prisma.facebookPage.count({
        where: (!user || user.role === 'ADMIN') ? {} : { userId: user.id }
      })
    ]);

    return {
      completed,
      failed,
      processing,
      total,
      totalSources,
      connectedPages
    };
  }

  findAll(user?: any, limit?: number) {
    const notCloudQueue = {
      NOT: {
        facebookPostId: 'MEGA_CLOUD_UPLOAD'
      }
    };

    const takeLimit = limit ? Math.min(Math.max(Number(limit), 1), 2000) : 500;

    if (!user || user.role === 'ADMIN') {
      return this.prisma.uploadHistory.findMany({
        where: notCloudQueue,
        take: takeLimit,
        include: {
          video: {
            include: {
              source: true
            }
          },
          facebookPage: true
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return this.prisma.uploadHistory.findMany({
      where: {
        AND: [
          notCloudQueue,
          {
            OR: [
              { video: { source: { userId: user.id } } },
              { facebookPage: { userId: user.id } }
            ]
          }
        ]
      },
      take: takeLimit,
      include: {
        video: {
          include: {
            source: true
          }
        },
        facebookPage: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async retry(id: string) {
    return this.prisma.uploadHistory.update({
      where: { id },
      data: {
        status: 'PENDING',
        errorMessage: null,
      }
    });
  }
  async clearFailed(user?: any) {
    if (!user || user.role === 'ADMIN') {
      return this.prisma.uploadHistory.deleteMany({
        where: {
          status: 'FAILED'
        }
      });
    }
    
    // For normal users, only delete their own failed histories
    return this.prisma.uploadHistory.deleteMany({
      where: {
        status: 'FAILED',
        video: {
          source: { userId: user.id }
        }
      }
    });
  }
}
