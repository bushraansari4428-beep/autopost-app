import { Controller, Post, Body, Request, Get, BadRequestException } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('facebook')
export class FacebookController {
  constructor(
    private readonly facebookService: FacebookService,
    private readonly prisma: PrismaService,
  ) {}

  @Post('verify-page')
  async verifyAndAddPage(@Request() req: any, @Body() body: { pageId: string; accessToken: string }) {
    if (!body.pageId || !body.accessToken) {
      throw new BadRequestException('pageId and accessToken are required');
    }

    // Verify token with Facebook
    const pageDetails = await this.facebookService.verifyPageToken(body.pageId, body.accessToken);

    // TODO: In a real implementation, you would save this to the database, e.g.:
    /*
    await this.prisma.destination.create({
      data: {
        userId: req.user.userId,
        platform: 'facebook',
        identifier: pageDetails.id,
        name: pageDetails.name,
        accessToken: pageDetails.access_token,
      },
    });
    */

    return {
      message: 'Page successfully verified and connected',
      page: {
        id: pageDetails.id,
        name: pageDetails.name,
        picture: pageDetails.picture?.data?.url,
      }
    };
  }
}
