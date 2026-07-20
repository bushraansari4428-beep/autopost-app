import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { FacebookService } from '../facebook/facebook.service';
export declare class UploadProcessor extends WorkerHost {
    private readonly prisma;
    private readonly facebookService;
    private readonly logger;
    constructor(prisma: PrismaService, facebookService: FacebookService);
    process(job: Job<any, any, string>): Promise<any>;
}
