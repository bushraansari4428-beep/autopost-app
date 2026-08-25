import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SyncService } from '../workers/sync.service';

@Injectable()
export class MappingsService {
  constructor(
    private prisma: PrismaService,
    private syncService: SyncService
  ) {}

  async create(createMappingDto: any) {
    const existingSource = await this.prisma.mapping.findFirst({
      where: { sourceId: createMappingDto.sourceId }
    });
    
    if (existingSource) {
      throw new BadRequestException('This source is already connected to a Facebook page. A source can only be mapped to one page at a time.');
    }

    const existingPage = await this.prisma.mapping.findFirst({
      where: { facebookPageId: createMappingDto.facebookPageId }
    });

    if (existingPage) {
      throw new BadRequestException('This Facebook page is already connected to a source. A page can only have one active mapping at a time.');
    }

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

  update(id: string, updateData: any) {
    if (updateData.scheduledTime !== undefined) {
      if (updateData.scheduledTime && updateData.scheduledTime !== '00:00') {
        updateData.lastScheduledRun = null;
      } else {
        updateData.lastScheduledRun = null;
      }
    }
    return this.prisma.mapping.update({
      where: { id },
      data: updateData,
    });
  }
}
