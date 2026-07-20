import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
export declare class CronService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly monitorQueue;
    private readonly logger;
    private timer;
    constructor(prisma: PrismaService, monitorQueue: Queue);
    onModuleInit(): void;
    onModuleDestroy(): void;
    handleCron(): Promise<void>;
}
