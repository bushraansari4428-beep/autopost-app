import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { HistoryService } from './history.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('history')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get()
  findAll() {
    return this.historyService.findAll();
  }

  @Post(':id/retry')
  retry(@Param('id') id: string) {
    return this.historyService.retry(id);
  }
}
