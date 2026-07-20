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
var MonitoringProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MonitoringProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const exec_util_1 = require("../utils/exec.util");
let MonitoringProcessor = MonitoringProcessor_1 = class MonitoringProcessor extends bullmq_1.WorkerHost {
    prisma;
    downloadQueue;
    logger = new common_1.Logger(MonitoringProcessor_1.name);
    constructor(prisma, downloadQueue) {
        super();
        this.prisma = prisma;
        this.downloadQueue = downloadQueue;
    }
    async process(job) {
        const { sourceId } = job.data;
        this.logger.log(`Processing monitoring job for source: ${sourceId}`);
        const source = await this.prisma.source.findUnique({ where: { id: sourceId } });
        if (!source) {
            this.logger.error(`Source not found: ${sourceId}`);
            return;
        }
        try {
            const cmd = `yt-dlp --dump-json --playlist-end 5 "${source.url}"`;
            this.logger.log(`Running yt-dlp for ${source.url}`);
            const { stdout } = await (0, exec_util_1.execPromise)(cmd);
            const lines = stdout.split('\n').filter(line => line.trim() !== '');
            for (const line of lines) {
                try {
                    const videoData = JSON.parse(line);
                    const platformVideoId = videoData.id;
                    const existing = await this.prisma.video.findFirst({
                        where: {
                            sourceId: source.id,
                            originalId: platformVideoId
                        }
                    });
                    if (!existing) {
                        this.logger.log(`Found new video: ${videoData.title}`);
                        const publishedAt = videoData.timestamp ? new Date(videoData.timestamp * 1000) : new Date();
                        const newVideo = await this.prisma.video.create({
                            data: {
                                title: videoData.title,
                                description: videoData.description || '',
                                originalId: platformVideoId,
                                publishedAt: publishedAt,
                                url: videoData.webpage_url || videoData.url || '',
                                sourceId: source.id,
                            }
                        });
                        await this.downloadQueue.add('download', {
                            videoId: newVideo.id
                        });
                    }
                }
                catch (e) {
                    this.logger.error(`Error parsing yt-dlp output line: ${e.message}`);
                }
            }
            await this.prisma.source.update({
                where: { id: source.id },
                data: { lastChecked: new Date() }
            });
            return { status: 'Monitoring completed' };
        }
        catch (error) {
            this.logger.error(`Failed to monitor source ${source.id}: ${error.message}`);
            throw error;
        }
    }
};
exports.MonitoringProcessor = MonitoringProcessor;
exports.MonitoringProcessor = MonitoringProcessor = MonitoringProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('monitor-sources'),
    __param(1, (0, bullmq_1.InjectQueue)('download-video')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], MonitoringProcessor);
//# sourceMappingURL=monitoring.processor.js.map