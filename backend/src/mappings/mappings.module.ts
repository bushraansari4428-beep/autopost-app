import { Module } from '@nestjs/common';
import { MappingsService } from './mappings.service';
import { MappingsController } from './mappings.controller';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [WorkersModule],
  controllers: [MappingsController],
  providers: [MappingsService],
  exports: [MappingsService],
})
export class MappingsModule {}
