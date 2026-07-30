import { Controller, Get, Post, Put, Body, Param, Delete, UseGuards, Request } from '@nestjs/common';
import { MappingsService } from './mappings.service';
import { AuthGuard } from '@nestjs/passport';

@UseGuards(AuthGuard('jwt'))
@Controller('mappings')
export class MappingsController {
  constructor(private readonly mappingsService: MappingsService) {}

  @Post()
  create(@Body() createMappingDto: any) {
    return this.mappingsService.create(createMappingDto);
  }

  @Get()
  findAll(@Request() req: any) {
    return this.mappingsService.findAll(req.user);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mappingsService.remove(id);
  }

  @Post(':id/test')
  testMapping(@Param('id') id: string) {
    return this.mappingsService.testMapping(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateData: any) {
    return this.mappingsService.update(id, updateData);
  }
}
