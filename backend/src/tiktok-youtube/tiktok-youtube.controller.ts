import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { TiktokYoutubeService } from './tiktok-youtube.service';
import { YoutubeService } from './youtube.service';

@UseGuards(AuthGuard('jwt'))
@Controller('tiktok-youtube')
export class TiktokYoutubeController {
  constructor(
    private readonly tiktokYoutubeService: TiktokYoutubeService,
    private readonly youtubeService: YoutubeService,
  ) {}

  // ==========================================
  // YOUTUBE CHANNELS
  // ==========================================

  @Get('channels')
  async listChannels(@Request() req: any) {
    return this.tiktokYoutubeService.listChannels(req.user?.id);
  }

  @Post('channels')
  async connectChannel(@Body() body: any, @Request() req: any) {
    return this.tiktokYoutubeService.connectChannel(body, req.user?.id);
  }

  @Delete('channels/:id')
  async disconnectChannel(@Param('id') id: string, @Request() req: any) {
    return this.tiktokYoutubeService.disconnectChannel(id, req.user?.id);
  }

  // ==========================================
  // OAUTH HELPERS
  // ==========================================

  @Get('oauth-url')
  getOAuthUrl(@Query('redirectUri') redirectUri: string, @Query('clientId') clientId?: string) {
    const cid = clientId || process.env.GOOGLE_CLIENT_ID;
    if (!cid) {
      return { url: null, error: 'Google Client ID is not configured.' };
    }
    const scopes = [
      'https://www.googleapis.com/auth/youtube.upload',
      'https://www.googleapis.com/auth/youtube.readonly',
      'https://www.googleapis.com/auth/youtube',
    ].join(' ');

    const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
      cid,
    )}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(
      scopes,
    )}&access_type=offline&prompt=consent`;

    return { url };
  }

  @Post('oauth-callback')
  async handleOAuthCallback(@Body() body: any, @Request() req: any) {
    const { code, redirectUri, clientId, clientSecret } = body;
    return this.youtubeService.exchangeAuthCode(code, redirectUri, clientId, clientSecret, req.user?.id);
  }

  // ==========================================
  // MAPPINGS
  // ==========================================

  @Get('mappings')
  async listMappings(@Request() req: any) {
    return this.tiktokYoutubeService.listMappings(req.user?.id);
  }

  @Post('mappings')
  async createMapping(@Body() body: any, @Request() req: any) {
    return this.tiktokYoutubeService.createMapping(body, req.user?.id);
  }

  @Put('mappings/:id')
  async updateMapping(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.tiktokYoutubeService.updateMapping(id, body, req.user?.id);
  }

  @Delete('mappings/:id')
  async deleteMapping(@Param('id') id: string, @Request() req: any) {
    return this.tiktokYoutubeService.deleteMapping(id, req.user?.id);
  }

  @Post('mappings/:id/sync')
  async manualSync(@Param('id') id: string) {
    return this.tiktokYoutubeService.syncMapping(id, true);
  }

  // ==========================================
  // HISTORY & STATS
  // ==========================================

  @Get('history')
  async getHistory(
    @Request() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const lim = limit ? parseInt(limit, 10) : 50;
    const off = offset ? parseInt(offset, 10) : 0;
    return this.tiktokYoutubeService.getHistory(req.user?.id, lim, off);
  }

  @Get('stats')
  async getStats(@Request() req: any) {
    return this.tiktokYoutubeService.getStats(req.user?.id);
  }
}
