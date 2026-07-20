import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MappingsService {
  constructor(private prisma: PrismaService) {}

  create(createMappingDto: any) {
    return this.prisma.mapping.create({
      data: createMappingDto,
    });
  }

  findAll() {
    return this.prisma.mapping.findMany({
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
}
