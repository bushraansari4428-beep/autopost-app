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
    };
  }

  @Post('config')
  async saveConfig(@Body() body: any, @Request() req: any) {
    if (!body.phoneNumber || !body.apiKey) {
      throw new BadRequestException('Phone number and API Key are required.');
    }

    return this.whatsappService.saveConfig({
      phoneNumber: body.phoneNumber,
      apiKey: body.apiKey,
      reportTime: body.reportTime || '09:00',
      enabled: body.enabled !== undefined ? body.enabled : true,
      userId: req.user?.id,
    });
  }

  @Post('test')
  async sendTest(@Body() body: any, @Request() req: any) {
    const phone = body.phoneNumber;
    const apiKey = body.apiKey;

    if (!phone || !apiKey) {
      throw new BadRequestException('Phone number and API key are required to test.');
    }

    const result = await this.whatsappService.sendTestReport(phone, apiKey, req.user?.id);
    if (!result.success) {
      throw new BadRequestException(result.message || 'Failed to send WhatsApp test message. Please verify your phone number and CallMeBot API key.');
    }

    return { success: true, message: result.message };
  }
}
