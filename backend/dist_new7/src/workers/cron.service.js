"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var CronService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CronService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const prisma_service_1 = require("../prisma/prisma.service");
let CronService = CronService_1 = class CronService {
    prisma;
    monitorQueue;
    logger = new common_1.Logger(CronService_1.name);
    timer;
    constructor(prisma, monitorQueue) {
        this.prisma = prisma;
        this.monitorQueue = monitorQueue;
    }
    onModuleInit() {
        console.log('==== CRON SERVICE onModuleInit EXECUTION STARTED ====');
        this.timer = setInterval(() => {
            console.log('==== CRON setInterval FIRED ====');
            this.handleCron();
        }, 300000);
        this.logger.log('Started native setInterval for source monitoring every 5 minutes.');
        this.handleCron();
    }
    onModuleDestroy() {
        if (this.timer) {
            clearInterval(this.timer);
        }
    }
    async handleCron() {
        console.log('==== CRON handleCron CALLED ====');
        this.logger.log('Starting scheduled source monitoring...');
        try {
            const sources = await this.prisma.source.findMany();
            if (sources.length === 0) {
                this.logger.log('No sources found to monitor.');
                return;
            }
            let count = 0;
            for (const source of sources) {
                await this.monitorQueue.add('monitor', { sourceId: source.id }, {
                    jobId: `monitor-${source.id}-${Date.now()}`,
                    removeOnComplete: true,
                    removeOnFail: false,
                });
                count++;
            }
            this.logger.log(`Queued ${count} sources for monitoring.`);
        }
        catch (error) {
            this.logger.error(`Error in scheduled monitoring: ${error.message}`);
        }
    }
};
exports.CronService = CronService;
exports.CronService = CronService = CronService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, bullmq_1.InjectQueue)('monitor-sources')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], CronService);
//# sourceMappingURL=cron.service.js.map