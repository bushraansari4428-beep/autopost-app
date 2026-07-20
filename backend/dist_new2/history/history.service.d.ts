import { PrismaService } from '../prisma/prisma.service';
export declare class HistoryService {
    private prisma;
    constructor(prisma: PrismaService);
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        video: {
            source: {
                id: string;
                createdAt: Date;
                name: string;
                platform: import("@prisma/client").$Enums.Platform;
                url: string;
                status: import("@prisma/client").$Enums.Status;
                lastChecked: Date | null;
            };
        } & {
            id: string;
            createdAt: Date;
            url: string;
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
