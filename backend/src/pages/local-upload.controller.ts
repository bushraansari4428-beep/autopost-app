import { Controller, Post, Param, UseInterceptors, UploadedFile, UseGuards, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { SyncService } from '../workers/sync.service';
import * as multer from 'multer';
import * as path from 'path';
import * as os from 'os';

@Controller('pages')
export class LocalUploadController {
  constructor(private readonly syncService: SyncService) {}

  @Post(':id/local-upload')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('video', {
      storage: multer.diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = path.extname(file.originalname);
          cb(null, `local_upload_${uniqueSuffix}${ext}`);
        },
      }),
    }),
  )
  async uploadLocalVideo(
    @Param('id') pageId: string,
    @UploadedFile() file: any,
  ) {
    if (!file) {
      throw new BadRequestException('No video file provided');
    }

    try {
      const originalName = path.parse(file.originalname).name;
      const result = await this.syncService.processLocalVideo(pageId, file.path, originalName);
      
      // Clean up temp file
      const fs = require('fs');
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      return result;
    } catch (error: any) {
      const fs = require('fs');
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestException(error.message);
    }
  }
}
