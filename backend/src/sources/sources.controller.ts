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
  async debugYtdlp(@Query('url') url: string, @Query('args') args: string) {
    const { execPromise } = require('../utils/exec.util');
    try {
      const extraArgs = args ? decodeURIComponent(args) : '';
      const { stdout, stderr } = await execPromise(`./yt-dlp --cookies cookies.txt ${extraArgs} -v --dump-json --playlist-end 1 "${url}"`);
      return { stdout: stdout.substring(0, 500), stderr };
    } catch (e) {
      return { error: e.message, stderr: e.stderr };
    }
  }

  @Get('debug-cobalt')
  async debugCobalt(@Query('url') url: string, @Query('api') api: string) {
    try {
      const response = await fetch(api || 'https://cobalt-api.kwiatekm.cloud/api/json', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: url,
          vCodec: 'h264',
          vQuality: '720'
        })
      });
      const data = await response.json();
      return data;
    } catch (error) {
      return { error: error.message };
    }
  }

  @Get('debug-ytdl-core')
  async debugYtdlCore(@Query('url') url: string) {
    try {
      const ytdl = require('@distube/ytdl-core');
      const info = await ytdl.getInfo(url);
      return { 
        title: info.videoDetails.title,
        id: info.videoDetails.videoId,
        formats: info.formats.length 
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  @Get('debug-rss')
  async debugRss(@Query('channelId') channelId: string) {
    try {
      const response = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`);
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      const text = await response.text();
      return { success: true, length: text.length, snippet: text.substring(0, 500) };
    } catch (e) {
      return { error: e.message };
    }
  }

  @Get('debug-invidious')
  async debugInvidious(@Query('id') id: string, @Query('api') api: string) {
    try {
      const baseUrl = api || 'https://inv.tux.pizza';
      const response = await fetch(`${baseUrl}/api/v1/videos/${id}`);
      if (!response.ok) {
        return { error: `HTTP ${response.status}` };
      }
      const data = await response.json();
      return { success: true, title: data.title, formats: data.formatStreams?.length };
    } catch (e) {
      return { error: e.message };
    }
  }

  @Get('debug-curl')
  async debugCurl(@Query('url') url: string) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`curl -sL "${url}" | head -c 500`, (error: any, stdout: any, stderr: any) => {
          resolve({ stdout, stderr, error: error?.message });
        });
      });
    } catch (e) {
      return { error: e.message };
    }
  }

  @Get('debug-tiktok')
  async debugTiktok(@Query('url') url: string) {
    try {
      const { exec } = require('child_process');
      return new Promise((resolve) => {
        exec(`./yt-dlp --flat-playlist --playlist-end 1 --print id "${url}"`, (error: any, stdout: any, stderr: any) => {
          resolve({ stdout, stderr, error: error?.message });
        });
      });
    } catch (e) {
      return { error: e.message };
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
