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
var UploadProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.UploadProcessor = void 0;
const bullmq_1 = require("@nestjs/bullmq");
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const facebook_service_1 = require("../facebook/facebook.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let UploadProcessor = UploadProcessor_1 = class UploadProcessor extends bullmq_1.WorkerHost {
    prisma;
    facebookService;
    logger = new common_1.Logger(UploadProcessor_1.name);
    constructor(prisma, facebookService) {
        super();
        this.prisma = prisma;
        this.facebookService = facebookService;
    }
    async process(job) {
        const { uploadHistoryId } = job.data;
        this.logger.log(`Processing upload job for UploadHistory: ${uploadHistoryId}`);
        const history = await this.prisma.uploadHistory.findUnique({
            where: { id: uploadHistoryId },
            include: { video: true, facebookPage: true }
        });
        if (!history) {
            throw new Error(`UploadHistory not found: ${uploadHistoryId}`);
        }
        try {
            const destination = history.facebookPage;
            const video = history.video;
            const pageId = destination.pageId;
            const accessToken = destination.accessToken;
            const downloadsDir = path.join(process.cwd(), 'downloads');
            if (!fs.existsSync(downloadsDir)) {
                throw new Error(`Downloads directory not found`);
            }
            const files = fs.readdirSync(downloadsDir);
            const downloadedFile = files.find(f => f.startsWith(video.originalId));
            if (!downloadedFile) {
                throw new Error(`File not found for video: ${video.originalId}`);
            }
            const localPath = path.join(downloadsDir, downloadedFile);
            const stat = fs.statSync(localPath);
            const fileSize = stat.size;
            const { uploadSessionId } = await this.facebookService.initializeUpload(pageId, accessToken, fileSize);
            const chunkSize = 10 * 1024 * 1024;
            let startOffset = 0;
            const fd = fs.openSync(localPath, 'r');
            try {
                while (startOffset < fileSize) {
                    const buffer = Buffer.alloc(Math.min(chunkSize, fileSize - startOffset));
                    fs.readSync(fd, buffer, 0, buffer.length, startOffset);
                    await this.facebookService.uploadChunk(pageId, accessToken, uploadSessionId, startOffset, buffer);
                    startOffset += buffer.length;
                    this.logger.log(`Uploaded chunk... ${startOffset}/${fileSize} bytes`);
                }
            }
            finally {
                fs.closeSync(fd);
            }
            const result = await this.facebookService.finishUpload(pageId, accessToken, uploadSessionId, video.title, video.description);
            await this.prisma.uploadHistory.update({
                where: { id: uploadHistoryId },
                data: {
                    status: 'COMPLETED',
                    facebookPostId: result.id || result.video_id
                }
            });
            this.logger.log(`Upload completed successfully: FB Video ID ${result.id || result.video_id}`);
            return { status: 'Upload completed', facebookVideoId: result.id || result.video_id };
        }
        catch (error) {
            await this.prisma.uploadHistory.update({
                where: { id: uploadHistoryId },
                data: {
                    status: 'FAILED',
                    errorMessage: error.message
                }
            });
            this.logger.error(`Upload failed: ${error.message}`);
            throw error;
        }
    }
};
exports.UploadProcessor = UploadProcessor;
exports.UploadProcessor = UploadProcessor = UploadProcessor_1 = __decorate([
    (0, bullmq_1.Processor)('upload-facebook'),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        facebook_service_1.FacebookService])
], UploadProcessor);
//# sourceMappingURL=upload.processor.js.map