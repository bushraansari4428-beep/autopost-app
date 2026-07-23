import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  async create(createSourceDto: any) {
    if (createSourceDto.url && createSourceDto.url.includes('@')) {
      try {
        const handle = createSourceDto.url.split('@')[1].split('/')[0].split('?')[0];
        const res = await fetch(`https://yt.lemnoslife.com/channels?handle=@${handle}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.items && data.items.length > 0 && data.items[0].id) {
            createSourceDto.url = `https://www.youtube.com/channel/${data.items[0].id}`;
          }
        }
      } catch (e) {
        console.error('Failed to resolve handle', e);
      }
    }
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
