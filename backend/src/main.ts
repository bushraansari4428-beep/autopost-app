import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CronService } from './workers/cron.service';

import { execSync } from 'child_process';

async function bootstrap() {
  try {
    console.log('Running database migrations...');
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    console.log('Database migrations completed successfully.');
  } catch (error) {
    console.error('Failed to run database migrations:', error);
  }

  const app = await NestFactory.create(AppModule);
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
