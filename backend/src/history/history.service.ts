import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  findAll(user?: any) {
    if (!user || user.role === 'ADMIN') {
      return this.prisma.uploadHistory.findMany({
        take: 300,
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
        OR: [
          { video: { source: { userId: user.id } } },
          { facebookPage: { userId: user.id } }
        ]
      },
      take: 300,
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
