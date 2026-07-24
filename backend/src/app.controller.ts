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
    const { execSync } = require('child_process');
    try {
      const result = execSync('npx prisma db push --accept-data-loss').toString();
      return { success: true, result };
    } catch (error: any) {
      return { success: false, error: error.message, stdout: error.stdout?.toString(), stderr: error.stderr?.toString() };
    }
  }
}
