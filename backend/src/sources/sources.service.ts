import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SourcesService {
  constructor(private prisma: PrismaService) {}

  async create(createSourceDto: any) {
    if (createSourceDto.url && createSourceDto.url.includes('@')) {
      try {
        const handle = createSourceDto.url.split('@')[1].split('/')[0].split('?')[0];
        const res = await fetch(`https://www.youtube.com/@${handle}`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        if (res.ok) {
          const html = await res.text();
          const match = html.match(/"channelId":"(UC[^"]+)"/) || html.match(/<meta itemprop="identifier" content="(UC[^"]+)"/);
          if (match && match[1]) {
            createSourceDto.url = `https://www.youtube.com/channel/${match[1]}`;
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
