import { Controller, Get, Post, Body, Param, Delete, Put, Patch, Res, UseGuards, Request } from '@nestjs/common';
import { PagesService } from './pages.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('pages')
export class PagesController {
  constructor(private readonly pagesService: PagesService) {}

  @Post()
  create(@Body() createPageDto: any, @Request() req: any) {
    if (req.user && req.user.id) {
      createPageDto.userId = req.user.id;
    }
    return this.pagesService.create(createPageDto);
  }

  @Post('bulk-import-tokens')
  bulkImportTokens(@Body() body: { tokens: string | string[] }, @Request() req: any) {
    return this.pagesService.bulkImportTokens(body.tokens, req.user);
  }

  @Post('facebook/oauth-callback')
  facebookOAuthCallback(
    @Body() body: { code: string; redirectUri: string; metaAppId?: string },
    @Request() req: any
  ) {
    return this.pagesService.handleFacebookOAuthCallback(
      body.code,
      body.redirectUri,
      req.user,
      body.metaAppId
    );
  }

  @Get('facebook/oauth-config')
  getFacebookOAuthConfig() {
    return {
      appId: process.env.FACEBOOK_APP_ID || '911473734693149',
    };
  }

  @Get('meta-apps')
  getMetaApps(@Request() req: any) {
    return this.pagesService.getMetaApps(req.user);
  }

  @Post('meta-apps')
  createOrSaveMetaApp(@Body() body: any, @Request() req: any) {
    return this.pagesService.createOrSaveMetaApp(body, req.user);
  }

  @Put('meta-apps/:id')
  updateMetaApp(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.pagesService.updateMetaApp(id, body, req.user);
  }

  @Delete('meta-apps/:id')
  deleteMetaApp(@Param('id') id: string) {
    return this.pagesService.deleteMetaApp(id);
  }

  @Get('youtube-channels')
  getYoutubeChannels(@Request() req: any) {
    return this.pagesService.getYoutubeChannels(req.user);
  }

  @Post('youtube-studio-sync')
  syncYoutubeStudioChannel(@Body() body: any, @Request() req: any) {
    return this.pagesService.syncYoutubeStudioChannel(body, req.user);
  }

  @Post('auto-link-youtube')
  autoLinkYoutubeChannels(@Request() req: any) {
    return this.pagesService.autoLinkYoutubeChannels(req.user);
  }

  @Get('youtube-mirror-queue')
  getYoutubeMirrorQueue() {
    return this.pagesService.getYoutubeMirrorQueue();
  }

  @Get('youtube-mirror-stream/:uploadHistoryId')
  streamYoutubeMirrorVideo(@Param('uploadHistoryId') uploadHistoryId: string, @Res() res: any) {
    return this.pagesService.streamYoutubeMirrorVideo(uploadHistoryId, res);
  }

  @Post('youtube-mirror-complete/:uploadHistoryId')
  completeYoutubeMirrorUpload(@Param('uploadHistoryId') uploadHistoryId: string, @Body() body: any) {
    return this.pagesService.completeYoutubeMirrorUpload(uploadHistoryId, body);
  }

  @Patch(':id/link-youtube')
  linkYoutubeChannel(@Param('id') id: string, @Body() body: { youtubeChannelId: string | null }) {
    return this.pagesService.linkYoutubeChannel(id, body.youtubeChannelId);
  }

  @Post('bulk-create-pages')
  bulkCreatePages(@Body() body: any, @Request() req: any) {
    return this.pagesService.bulkCreatePages(body, req.user);
  }

  @Post('fetch-creator-info')
  fetchCreatorInfo(@Body() body: { creatorUrl: string }) {
    return this.pagesService.fetchCreatorInfo(body.creatorUrl);
  }

  @Post(':id/sync-creator-identity')
  syncCreatorIdentity(@Param('id') id: string, @Body() body: any) {
    return this.pagesService.syncCreatorIdentity(id, body);
  }

  @Get('saved-accounts')
  getSavedAccounts(@Request() req: any) {
    return this.pagesService.getSavedAccounts(req.user);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.pagesService.findAll(req.user);
  }

  @Get('local-folder-mappings')
  getLocalFolderMappings(@Request() req: any) {
    return this.pagesService.getLocalFolderMappings(req.user);
  }

  @Get(':id/statistics')
  getStatistics(@Param('id') id: string) {
    return this.pagesService.getStatistics(id);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.pagesService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updatePageDto: any) {
    return this.pagesService.update(id, updatePageDto);
  }

  @Post(':id/update-identity')
  updatePageIdentity(@Param('id') id: string, @Body() body: { name: string; bio?: string }) {
    return this.pagesService.updatePageIdentity(id, body);
  }

  @Put(':id/identity')
  putPageIdentity(@Param('id') id: string, @Body() body: { name: string; bio?: string }) {
    return this.pagesService.updatePageIdentity(id, body);
  }

  @Post('check-monetization')
  checkMonetization(@Request() req: any) {
    const userId = req.user?.role === 'ADMIN' ? undefined : req.user?.id;
    return this.pagesService.checkPagesMonetization(userId);
  }

  @Post(':id/set-monetization')
  setPageMonetization(
    @Param('id') id: string,
    @Body() body: { hasContentMonetization: boolean; status?: string; sendWhatsApp?: boolean }
  ) {
    return this.pagesService.setPageMonetization(id, body);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
