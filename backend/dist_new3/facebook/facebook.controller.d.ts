import { FacebookService } from './facebook.service';
import { PrismaService } from '../prisma/prisma.service';
export declare class FacebookController {
    private readonly facebookService;
    private readonly prisma;
    constructor(facebookService: FacebookService, prisma: PrismaService);
    verifyAndAddPage(req: any, body: {
        pageId: string;
        accessToken: string;
    }): Promise<{
        message: string;
        page: {
            id: any;
            name: any;
            picture: any;
        };
    }>;
}
