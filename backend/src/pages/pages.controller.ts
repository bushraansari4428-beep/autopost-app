import { Controller, Get, Post, Body, Param, Delete, Put, UseGuards, Request } from '@nestjs/common';
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

  @Get()
  findAll(@Request() req: any) {
    return this.pagesService.findAll(req.user);
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

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.pagesService.remove(id);
  }
}
