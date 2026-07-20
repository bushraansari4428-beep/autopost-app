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
}
