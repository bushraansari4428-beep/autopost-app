import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  findAll(user?: any) {
    if (!user) {
      return this.prisma.uploadHistory.findMany({
        include: {
          video: {
            include: {
              source: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    if (user.role === 'ADMIN') {
      return this.prisma.uploadHistory.findMany({
        where: {
          video: {
            source: {
              OR: [
                { userId: user.id },
                { userId: null }
              ]
            }
          }
        },
        include: {
          video: {
            include: {
              source: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return this.prisma.uploadHistory.findMany({
      where: {
        video: {
          source: {
            userId: user.id
          }
        }
      },
      include: {
        video: {
          include: {
            source: true
          }
        }
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
}
