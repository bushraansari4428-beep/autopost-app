import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  create(createSourceDto: any) {
    return this.prisma.source.create({
      data: createSourceDto,
    });
  }

  findAll() {
    return this.prisma.source.findMany();
  }

  findOne(id: string) {
    return this.prisma.source.findUnique({
      where: { id },
    });
  }

  update(id: string, updateSourceDto: any) {
    return this.prisma.source.update({
      where: { id },
      data: updateSourceDto,
    });
  }

  remove(id: string) {
    return this.prisma.source.delete({
      where: { id },
    });
  }
}
