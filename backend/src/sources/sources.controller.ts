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

  @Get('debug-loader')
  async debugLoader() {
    try {
      const url = encodeURIComponent('https://www.youtube.com/watch?v=oY45BsUygCc');
      const res = await fetch(`https://loader.to/ajax/download.php?format=720&url=${url}`);
      const data = await res.json();
      return { status: res.status, data };
    } catch (e) {
      return { error: e.message };
    }
  }

  @Get('debug-ytdlp')
  async debugYtdlp(@Query('url') url: string) {
    const { execPromise } = require('../utils/exec.util');
    try {
      const { stdout, stderr } = await execPromise(`./yt-dlp --cookies cookies.txt --extractor-args "youtube:player_client=android" -v --dump-json --playlist-end 1 "${url}"`);
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
