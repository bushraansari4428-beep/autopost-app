import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HistoryService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.uploadHistory.findMany({
      include: {
        video: {
          include: {
            source: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
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
