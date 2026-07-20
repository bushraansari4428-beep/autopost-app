import { MappingsService } from './mappings.service';
export declare class MappingsController {
    private readonly mappingsService;
    constructor(mappingsService: MappingsService);
    create(createMappingDto: any): import("@prisma/client").Prisma.Prisma__MappingClient<{
        id: string;
        sourceId: string;
        facebookPageId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<({
        facebookPage: {
            id: string;
            createdAt: Date;
            name: string;
            status: import("@prisma/client").$Enums.Status;
            pageId: string;
            accessToken: string;
            tokenExpiry: Date | null;
        };
        source: {
            id: string;
            createdAt: Date;
            name: string;
            platform: import("@prisma/client").$Enums.Platform;
            sourceUrlId: string;
            status: import("@prisma/client").$Enums.Status;
            lastChecked: Date | null;
        };
    } & {
        id: string;
        sourceId: string;
        facebookPageId: string;
    })[]>;
    remove(id: string): import("@prisma/client").Prisma.Prisma__MappingClient<{
        id: string;
        sourceId: string;
        facebookPageId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
