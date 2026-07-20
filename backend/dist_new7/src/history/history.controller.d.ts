import { HistoryService } from './history.service';
export declare class HistoryController {
    private readonly historyService;
    constructor(historyService: HistoryService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        video: {
            source: {
                url: string;
                id: string;
                createdAt: Date;
                name: string;
                platform: import("@prisma/client").$Enums.Platform;
                status: import("@prisma/client").$Enums.Status;
                lastChecked: Date | null;
            };
        } & {
            url: string;
            id: string;
            createdAt: Date;
            sourceId: string;
            originalId: string;
            title: string;
            description: string | null;
            publishedAt: Date;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import("@prisma/client").$Enums.UploadStatus;
        facebookPageId: string;
        videoId: string;
        facebookPostId: string | null;
        attempts: number;
        errorMessage: string | null;
        updatedAt: Date;
    })[]>;
}
