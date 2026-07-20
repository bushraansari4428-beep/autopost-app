import { PagesService } from './pages.service';
export declare class PagesController {
    private readonly pagesService;
    constructor(pagesService: PagesService);
    create(createPageDto: any): import("@prisma/client").Prisma.Prisma__FacebookPageClient<{
        id: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.Status;
        pageId: string;
        accessToken: string;
        tokenExpiry: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findAll(): import("@prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.Status;
        pageId: string;
        accessToken: string;
        tokenExpiry: Date | null;
    }[]>;
    findOne(id: string): import("@prisma/client").Prisma.Prisma__FacebookPageClient<{
        id: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.Status;
        pageId: string;
        accessToken: string;
        tokenExpiry: Date | null;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    update(id: string, updatePageDto: any): import("@prisma/client").Prisma.Prisma__FacebookPageClient<{
        id: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.Status;
        pageId: string;
        accessToken: string;
        tokenExpiry: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    remove(id: string): import("@prisma/client").Prisma.Prisma__FacebookPageClient<{
        id: string;
        createdAt: Date;
        name: string;
        status: import("@prisma/client").$Enums.Status;
        pageId: string;
        accessToken: string;
        tokenExpiry: Date | null;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
