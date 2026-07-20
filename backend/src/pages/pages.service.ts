import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PagesService {
  constructor(private prisma: PrismaService) {}

  create(createPageDto: any) {
    return this.prisma.facebookPage.create({
      data: createPageDto,
    });
  }

  findAll() {
    return this.prisma.facebookPage.findMany();
  }

  findOne(id: string) {
    return this.prisma.facebookPage.findUnique({
      where: { id },
    });
  }

  update(id: string, updatePageDto: any) {
    return this.prisma.facebookPage.update({
      where: { id },
      data: updatePageDto,
    });
  }

  remove(id: string) {
    return this.prisma.facebookPage.delete({
      where: { id },
    });
  }
}
