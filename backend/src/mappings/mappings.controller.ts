import { Controller, Get, Post, Body, Param, Delete, UseGuards } from '@nestjs/common';
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
  findAll() {
    return this.mappingsService.findAll();
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.mappingsService.remove(id);
  }
}
