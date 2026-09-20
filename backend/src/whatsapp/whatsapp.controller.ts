import { Controller, Get, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { WhatsappService } from './whatsapp.service';

@UseGuards(AuthGuard('jwt'))
@Controller('whatsapp')
export class WhatsappController {
  constructor(private readonly whatsappService: WhatsappService) {}

  @Get('config')
  async getConfig(@Request() req: any) {
    const config = await this.whatsappService.getConfig(req.user?.id);
    return config || {
      phoneNumber: '',
      apiKey: '',
      reportTime: '09:00',
      enabled: false,
      instantAlerts: true,
    };
  }

  @Post('config')
  async saveConfig(@Body() body: any, @Request() req: any) {
    if (!body.phoneNumber) {
      throw new BadRequestException('Phone number is required.');
    }

    return this.whatsappService.saveConfig({
      phoneNumber: body.phoneNumber,
      apiKey: body.apiKey || undefined,
      reportTime: body.reportTime || '09:00',
      enabled: body.enabled !== undefined ? body.enabled : true,
      instantAlerts: body.instantAlerts !== undefined ? body.instantAlerts : true,
      userId: req.user?.id,
    });
  }

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
}
