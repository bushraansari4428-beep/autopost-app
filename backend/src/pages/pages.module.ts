import { Module, forwardRef } from '@nestjs/common';
import { PagesService } from './pages.service';
import { PagesController } from './pages.controller';
import { LocalUploadController } from './local-upload.controller';
import { WorkersModule } from '../workers/workers.module';

@Module({
  imports: [forwardRef(() => WorkersModule)],
  controllers: [PagesController, LocalUploadController],
  providers: [PagesService],
  exports: [PagesService],
})
export class PagesModule {}
