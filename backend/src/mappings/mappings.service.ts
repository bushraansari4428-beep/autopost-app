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
      where: { facebookPageId: createMappingDto.facebookPageId },
      include: { source: true }
    });

    if (existingPage) {
      // Smart Logic: Check if the existing mapping is only an empty MEGA_CLOUD placeholder
      const isCloudSource = existingPage.source?.platform === 'MEGA_CLOUD';
      let hasVideos = false;
      if (isCloudSource) {
        const videoCount = await this.prisma.video.count({
          where: {
            sourceId: existingPage.sourceId,
            uploads: { some: { facebookPageId: createMappingDto.facebookPageId } }
          }
        });
        const cloudVideos = await this.prisma.video.count({
          where: { sourceId: existingPage.sourceId }
        });
        const totalUploads = await this.prisma.uploadHistory.count({
          where: { facebookPageId: createMappingDto.facebookPageId }
        });
        hasVideos = (
          videoCount > 0 || 
          cloudVideos > 0 || 
          totalUploads > 0 || 
          !!existingPage.lastScheduledRun || 
          (existingPage.scheduledTime && existingPage.scheduledTime !== '12:00' && existingPage.scheduledTime !== '00:00') ||
          !!existingPage.customHashtags
        );
      }

      if (isCloudSource && !hasVideos) {
        // Unused dummy cloud placeholder - delete it cleanly to allow the new mapping
        await this.prisma.mapping.delete({
          where: { id: existingPage.id }
        });
      } else {
        throw new BadRequestException('This Facebook page is already connected to an active source. A page can only have one active mapping at a time.');
      }
    }

    return this.prisma.mapping.create({
      data: createMappingDto,
    });
  }

  findAll(user?: any) {
    if (!user || user.role === 'SUPER_ADMIN') {
      return this.prisma.mapping.findMany({
        include: {
          source: true,
          facebookPage: true,
        }
      });
    }

    const userCondition = user.role === 'ADMIN'
      ? [{ userId: user.id }, { userId: null }]
      : [{ userId: user.id }];

    return this.prisma.mapping.findMany({
      where: {
        OR: [
          { source: { OR: userCondition } },
          { facebookPage: { OR: userCondition } }
        ]
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
