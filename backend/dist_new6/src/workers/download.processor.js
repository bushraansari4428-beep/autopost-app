"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DownloadProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DownloadProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const exec_util_1 = require("../utils/exec.util");
let DownloadProcessor = DownloadProcessor_1 = class DownloadProcessor extends bullmq_1.WorkerHost {
    prisma;
    uploadQueue;
    logger = new common_1.Logger(DownloadProcessor_1.name);
    constructor(prisma, uploadQueue) {
        super();
        this.prisma = prisma;
        this.uploadQueue = uploadQueue;
    }
    async process(job) {
        const { videoId } = job.data;
        this.logger.log(`Processing download job for video: ${videoId}`);
        const video = await this.prisma.video.findUnique({
            where: { id: videoId },
            include: { source: { include: { mappings: true } } }
        });
        if (!video) {
            this.logger.error(`Video not found: ${videoId}`);
            return;
        }
        if (video.source.mappings.length === 0) {
            this.logger.log(`No mappings for source ${video.source.id}, skipping download.`);
            return;
        }
        try {
            const downloadsDir = path.join(process.cwd(), 'downloads');
            if (!fs.existsSync(downloadsDir)) {
                fs.mkdirSync(downloadsDir, { recursive: true });
            }
            const outputTemplate = path.join(downloadsDir, `${video.originalId}.%(ext)s`);
            const cmd = `yt-dlp -f "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best" --merge-output-format mp4 -o "${outputTemplate}" "${video.url}"`;
            this.logger.log(`Downloading video: ${video.url}`);
            await (0, exec_util_1.execPromise)(cmd);
            const files = fs.readdirSync(downloadsDir);
            const downloadedFile = files.find(f => f.startsWith(video.originalId));
            if (!downloadedFile) {
                throw new Error('Downloaded file not found on disk');
            }
            const localPath = path.join(downloadsDir, downloadedFile);
            this.logger.log(`Downloaded to ${localPath}. Queueing upload jobs...`);
            for (const mapping of video.source.mappings) {
                const uploadHistory = await this.prisma.uploadHistory.create({
                    data: {
                        videoId: video.id,
                        facebookPageId: mapping.facebookPageId,
                        status: 'PENDING'
                    }
                });
                await this.uploadQueue.add('upload', {
                    uploadHistoryId: uploadHistory.id
                });
            }
            return { status: 'Download completed' };
        }
        catch (error) {
            this.logger.error(`Failed to download video ${videoId}: ${error.message}`);
            throw error;
        }
    }
};
exports.DownloadProcessor = DownloadProcessor;
exports.DownloadProcessor = DownloadProcessor = DownloadProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('download-video'),
    __param(1, (0, bullmq_1.InjectQueue)('upload-facebook')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        bullmq_2.Queue])
], DownloadProcessor);
//# sourceMappingURL=download.processor.js.map