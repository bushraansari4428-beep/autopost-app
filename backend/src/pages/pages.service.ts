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

  findAll(user?: any) {
    if (!user) {
      return this.prisma.facebookPage.findMany();
    }
    if (user.role === 'ADMIN') {
      return this.prisma.facebookPage.findMany({
        where: {
          OR: [
            { userId: user.id },
            { userId: null }
          ]
        },
        orderBy: { createdAt: 'desc' }
      });
    }
    return this.prisma.facebookPage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' }
    });
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
