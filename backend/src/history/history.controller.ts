import { Controller, Get, Post, Delete, Param, Query, UseGuards, Request } from '@nestjs/common';
import { HistoryService } from './history.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('stats')
  getStats(@Request() req: any) {
    return this.historyService.getStats(req.user);
  }

  @Get()
  findAll(@Request() req: any, @Query('limit') limit?: string) {
    return this.historyService.findAll(req.user, limit ? parseInt(limit, 10) : undefined);
  }

  @Delete('failed')
  clearFailed(@Request() req: any) {
    return this.historyService.clearFailed(req.user);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.historyService.retry(id);
  }
}
