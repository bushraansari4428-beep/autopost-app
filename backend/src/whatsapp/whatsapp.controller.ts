import { Controller, Get, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WhatsappService } from './whatsapp.service';

@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @UseGuards(AuthGuard('jwt'))
  @Get('config')
  async getConfig(@Request() req: any) {
    const config = await this.whatsappService.getConfig(req.user?.id);
    return config || {
      phoneNumber: '',
      apiKey: '',
      reportTime: '08:00, 20:00',
      enabled: false,
      instantAlerts: true,
    };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('config')
  async saveConfig(@Body() body: any, @Request() req: any) {
    if (!body.phoneNumber) {
      throw new BadRequestException('Phone number is required.');
    }

    return this.whatsappService.saveConfig({
      phoneNumber: body.phoneNumber,
      apiKey: body.apiKey || undefined,
      reportTime: body.reportTime || '08:00, 20:00',
      enabled: body.enabled !== undefined ? body.enabled : true,
      instantAlerts: body.instantAlerts !== undefined ? body.instantAlerts : true,
      userId: req.user?.id,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('test')
  async sendTest(@Body() body: any, @Request() req: any) {
    const phone = body.phoneNumber;
    const apiKey = body.apiKey;

    if (!phone) {
      throw new BadRequestException('Phone number is required to test.');
    }

    const result = await this.whatsappService.sendTestReport(phone, apiKey || undefined, req.user?.id);
    if (!result.success) {
      throw new BadRequestException(result.message || 'Failed to send WhatsApp test message.');
    }

    return { success: true, message: result.message };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('test-instant')
  async sendTestInstantAlert(@Body() body: any, @Request() req: any) {
    const phone = body.phoneNumber;
    const apiKey = body.apiKey;

    if (!phone) {
      throw new BadRequestException('Phone number is required to test.');
    }

    const result = await this.whatsappService.sendTestInstantAlert(phone, apiKey || undefined);
    if (!result.success) {
      throw new BadRequestException(result.message || 'Failed to send WhatsApp instant alert.');
    }

    return { success: true, message: result.message };
  }

  /**
   * Relay endpoint for external Auto Bulk Video Generator & scripts to dispatch live alerts
   */
  @Post('send-alert')
  async sendCustomAlert(
    @Body()
    body: {
      message?: string;
      pageName?: string;
      status?: string;
      event?: string;
      details?: string;
      promptNumber?: number;
      workerId?: string;
    },
    @Request() req: any
  ) {
    let messageText = body.message;

    if (!messageText && body.pageName) {
      const isFailed = body.status === 'FAILED' || body.status === 'ERROR' || body.status === 'LIMIT_REACHED';
      const isCompleted = body.status === 'COMPLETED' || body.status === 'SUCCESS';
      const icon = isCompleted ? '✅' : isFailed ? '🚨' : '🎬';

      const eventLabel =
        body.event ||
        (isCompleted
          ? 'Video Tayyar & Downloaded!'
          : isFailed
          ? 'Video Generation Issue!'
          : 'Video Banna Shuru');

      const now = new Date();
      const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(now);

      messageText =
`${icon} *Auto Bulk Video Alert: ${eventLabel}*
━━━━━━━━━━━━━━━━━━━━
📄 *Page/Batch:* *${body.pageName}*
⚡ *Status:* ${body.status || 'Active'}
${body.promptNumber ? `🔢 *Prompt:* #${body.promptNumber}\n` : ''}${body.details ? `📝 *Details:* ${body.details}\n` : ''}${body.workerId ? `👤 *Worker Profile:* ${body.workerId}\n` : ''}🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
🤖 _Auto Bulk Video Generator Engine_`;
    }

    if (!messageText) {
      throw new BadRequestException('Message or structured event data (pageName, status, details) is required.');
    }

    const config = await this.whatsappService.getConfig(req.user?.id);
    const phone = config?.phoneNumber || '923400060008';
    const result = await this.whatsappService.dispatchWhatsAppMessage(phone, messageText, config?.apiKey || undefined);
    return result;
  }
}
