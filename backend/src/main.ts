import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { CronService } from './workers/cron.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
