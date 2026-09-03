import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { AuthGuard } from '@nestjs/passport';

@Controller('notifications')
@UseGuards(AuthGuard('jwt'))
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  async getAlerts() {
    return await this.notificationsService.getActiveAlerts();
  }

  @Post('dismiss')
  dismissAlert(@Body() body: { alertId?: string; alertIds?: string[] }) {
    if (body.alertId) {
      return this.notificationsService.dismissAlert(body.alertId);
    }
    if (body.alertIds && Array.isArray(body.alertIds)) {
      return this.notificationsService.dismissAll(body.alertIds);
    }
    return { success: true };
  }
}
