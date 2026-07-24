import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  @Get('debug-prisma')
  async debugPrisma() {
    const util = require('util');
    const exec = util.promisify(require('child_process').exec);
    try {
      // Fix for Supabase PgBouncer hanging migrations: use direct port 5432
      let directUrl = process.env.DATABASE_URL || '';
      if (directUrl.includes('pooler.supabase.com:6543')) {
        directUrl = directUrl.replace(':6543', ':5432');
      }

      const { stdout, stderr } = await exec('npx prisma db push --accept-data-loss', { 
        timeout: 60000,
        env: { ...process.env, DATABASE_URL: directUrl, CI: '1', PRISMA_HIDE_UPDATE_MESSAGE: '1' } 
      });
      return { success: true, stdout, stderr };
    } catch (error: any) {
      return { success: false, error: error.message, stdout: error.stdout?.toString(), stderr: error.stderr?.toString() };
    }
  }
}
