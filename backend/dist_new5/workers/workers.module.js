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
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkersModule = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const monitoring_processor_1 = require("./monitoring.processor");
const download_processor_1 = require("./download.processor");
const upload_processor_1 = require("./upload.processor");
const cron_service_1 = require("./cron.service");
const prisma_module_1 = require("../prisma/prisma.module");
const facebook_module_1 = require("../facebook/facebook.module");
let WorkersModule = class WorkersModule {
    cronService;
    constructor(cronService) {
        this.cronService = cronService;
        console.log('==== WORKERS MODULE CONSTRUCTOR FIRED ====');
        this.cronService.onModuleInit();
        console.log('==== CRON SERVICE INIT CALLED FROM WORKERS MODULE ====');
    }
};
exports.WorkersModule = WorkersModule;
exports.WorkersModule = WorkersModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            facebook_module_1.FacebookModule,
            bullmq_1.BullModule.registerQueue({ name: 'monitor-sources' }, { name: 'download-video' }, { name: 'upload-facebook' }),
        ],
        providers: [
            monitoring_processor_1.MonitoringProcessor,
            download_processor_1.DownloadProcessor,
            upload_processor_1.UploadProcessor,
            cron_service_1.CronService,
        ],
        exports: [bullmq_1.BullModule],
    }),
    __metadata("design:paramtypes", [cron_service_1.CronService])
], WorkersModule);
//# sourceMappingURL=workers.module.js.map