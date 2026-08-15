import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { CronService } from '../src/workers/cron.service';
import { SyncService } from '../src/workers/sync.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('RunSyncScript');
  logger.log('Bootstrapping NestJS application context for CLI Sync Worker...');
  
  try {
    // Create the application context without starting the HTTP server
    const app = await NestFactory.createApplicationContext(AppModule);
    
    const cronService = app.get(CronService);
    const syncService = app.get(SyncService);
    
    // Run self-healing routine to clear stuck processes from previous crashes
    await syncService.fixStuckUploads();
    
    const testMappingId = process.env.TEST_MAPPING_ID;
    
    if (testMappingId) {
      logger.log(`Starting specific manual test for mapping: ${testMappingId}`);
      await syncService.executeTestMapping(testMappingId);
    } else {
      logger.log('Starting heavy sync process (GitHub Actions Context)...');
      // Execute the main scraping/sync logic
      await cronService.handleCron();
    }
    
    logger.log('Sync process completed successfully. Closing application context.');
    await app.close();
    process.exit(0);
  } catch (error) {
    logger.error(`Error during sync script execution: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap();
