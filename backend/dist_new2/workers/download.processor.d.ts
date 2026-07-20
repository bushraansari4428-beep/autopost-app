import { WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export declare class DownloadProcessor extends WorkerHost {
    private prisma;
    private uploadQueue;
    private readonly logger;
    constructor(prisma: PrismaService, uploadQueue: Queue);
    process(job: Job<any, any, string>): Promise<any>;
}
