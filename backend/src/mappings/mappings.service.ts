import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../workers/sync.service';

@Injectable()
export class MappingsService {
  constructor(
    private prisma: PrismaService,
    private syncService: SyncService
  ) {}

  create(createMappingDto: any) {
    return this.prisma.mapping.create({
      data: createMappingDto,
    });
  }

  findAll(user?: any) {
    if (!user) {
      return this.prisma.mapping.findMany({
        include: {
          source: true,
          facebookPage: true,
        }
      });
    }
    if (user.role === 'ADMIN') {
      return this.prisma.mapping.findMany({
        where: {
          source: {
            OR: [
              { userId: user.id },
              { userId: null }
            ]
          }
        },
        include: {
          source: true,
          facebookPage: true,
        }
      });
    }
    return this.prisma.mapping.findMany({
      where: {
        source: {
          userId: user.id
        }
      },
      include: {
        source: true,
        facebookPage: true,
      }
    });
  }

  remove(id: string) {
    return this.prisma.mapping.delete({
      where: { id },
    });
  }

  async testMapping(id: string) {
    return this.syncService.testMapping(id);
  }
}
