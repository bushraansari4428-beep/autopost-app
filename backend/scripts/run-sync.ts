import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CronService } from '../src/workers/cron.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('RunSyncScript');
  logger.log('Bootstrapping NestJS application context for CLI Sync Worker...');
  
  try {
    // Create the application context without starting the HTTP server
    const app = await NestFactory.createApplicationContext(AppModule);
    
    // Retrieve the CronService which contains the main handleCron logic
    const cronService = app.get(CronService);
    
    logger.log('Starting heavy sync process (GitHub Actions Context)...');
    
    // Execute the main scraping/sync logic
    await cronService.handleCron();
    
    logger.log('Sync process completed successfully. Closing application context.');
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Error during sync script execution: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
