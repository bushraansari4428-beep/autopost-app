import { Controller, Get, Post, Param, UseGuards, Request } from '@nestjs/common';
import { HistoryService } from './history.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll(@Request() req: any) {
    return this.historyService.findAll(req.user);
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.historyService.retry(id);
  }
}
