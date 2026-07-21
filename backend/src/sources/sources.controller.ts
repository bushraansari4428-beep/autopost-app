import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Query } from '@nestjs/common';
import { SourcesService } from './sources.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('sources')
export class SourcesController {
  constructor(private readonly sourcesService: SourcesService) {}

  @Post()
  create(@Body() createSourceDto: any) {
    return this.sourcesService.create(createSourceDto);
  }

  @Get()
  findAll() {
    return this.sourcesService.findAll();
  }

  @Get('debug-env')
  getEnv() {
    return { db: process.env.DATABASE_URL };
  }

  @Get('debug-cobalt')
  async debugCobalt() {
    const instances = [
      'https://co.wuk.sh/api/json',
      'https://cobalt.acab.dev/api/json',
      'https://api.cobalt.best/api/json',
    ];
    const results = [];
    for (const api of instances) {
      try {
        const res = await fetch(api, {
          method: 'POST',
          headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=oY45BsUygCc' })
        });
        const data = await res.json();
        results.push({ api, status: res.status, data });
      } catch (e) {
        results.push({ api, error: e.message });
      }
    }
    return results;
  }

  @Get('debug-ytdlp')
  async debugYtdlp(@Query('url') url: string) {
    const { execPromise } = require('../utils/exec.util');
    try {
      const { stdout, stderr } = await execPromise(`./yt-dlp -v --dump-json --playlist-end 1 "${url}"`);
      return { stdout: stdout.substring(0, 500), stderr };
    } catch (e) {
      return { error: e.message, stderr: e.stderr };
    }
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.sourcesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateSourceDto: any) {
    return this.sourcesService.update(id, updateSourceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.sourcesService.remove(id);
  }
}
