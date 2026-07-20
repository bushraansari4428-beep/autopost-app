import { PrismaService } from '../prisma/prisma.service';
export declare class SourcesService {
    private prisma;
    constructor(prisma: PrismaService);
    create(createSourceDto: any): import("@prisma/client").Prisma.Prisma__SourceClient<{
        url: string;
        id: string;
        createdAt: Date;
        name: string;
        platform: import("@prisma/client").$Enums.Platform;
        status: import("@prisma/client").$Enums.Status;
        lastChecked: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        url: string;
        id: string;
        createdAt: Date;
        name: string;
        platform: import("@prisma/client").$Enums.Platform;
        status: import("@prisma/client").$Enums.Status;
        lastChecked: Date | null;
    }[]>;
    findOne(id: string): import("@prisma/client").Prisma.Prisma__SourceClient<{
        url: string;
        id: string;
        createdAt: Date;
        name: string;
        platform: import("@prisma/client").$Enums.Platform;
        status: import("@prisma/client").$Enums.Status;
        lastChecked: Date | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, updateSourceDto: any): import("@prisma/client").Prisma.Prisma__SourceClient<{
        url: string;
        id: string;
        createdAt: Date;
        name: string;
        platform: import("@prisma/client").$Enums.Platform;
        status: import("@prisma/client").$Enums.Status;
        lastChecked: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    remove(id: string): import("@prisma/client").Prisma.Prisma__SourceClient<{
        url: string;
        id: string;
        createdAt: Date;
        name: string;
        platform: import("@prisma/client").$Enums.Platform;
        status: import("@prisma/client").$Enums.Status;
        lastChecked: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
