import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    // Check every 45 seconds for scheduled WhatsApp daily reports
    setInterval(() => {
      this.checkAndSendScheduledReports().catch((err) => {
        this.logger.error('Error in scheduled WhatsApp reporter:', err.message);
      });
    }, 45 * 1000);

    this.logger.log('WhatsApp Automated Daily Reporter initialized (PKT Cron).');
  }

  /**
   * Unified WhatsApp message dispatcher supporting:
   * 1. Green-API Master Gateway (Instance + Token in server env)
   * 2. UltraMsg Gateway (Instance + Token in server env)
   * 3. CallMeBot Gateway (if personal API Key is supplied)
   */
  async dispatchWhatsAppMessage(phoneNumber: string, message: string, personalApiKey?: string): Promise<{ success: boolean; message: string }> {
    if (!phoneNumber) {
      return { success: false, message: 'WhatsApp phone number is required.' };
    }

    // Clean phone number: e.g. "0300 1234567" -> "923001234567"
    let cleanDigits = phoneNumber.replace(/\D/g, '');
    if (cleanDigits.startsWith('00')) cleanDigits = cleanDigits.substring(2);
    if (cleanDigits.startsWith('03') && cleanDigits.length === 11) {
      cleanDigits = '92' + cleanDigits.substring(1);
    }

    // Option A: Green-API Gateway (Zero-config for user)
    const greenInstance = process.env.GREEN_API_INSTANCE_ID;
    const greenToken = process.env.GREEN_API_TOKEN;
    if (greenInstance && greenToken) {
      try {
        this.logger.log(`Dispatching WhatsApp via Green-API Gateway to ${cleanDigits}...`);
        const url = `https://api.green-api.com/waInstance${greenInstance.trim()}/sendMessage/${greenToken.trim()}`;
        const res = await axios.post(
          url,
          {
            chatId: `${cleanDigits}@c.us`,
            message: message,
          },
          { timeout: 25000 }
        );

        if (res.data && res.data.idMessage) {
          return { success: true, message: 'WhatsApp report delivered via Green-API Gateway!' };
        }
      } catch (err: any) {
        this.logger.error('Green-API dispatch failed:', err.response?.data || err.message);
      }
    }

    // Option B: UltraMsg Gateway (Zero-config for user)
    const ultraInstance = process.env.ULTRAMSG_INSTANCE_ID;
    const ultraToken = process.env.ULTRAMSG_TOKEN;
    if (ultraInstance && ultraToken) {
      try {
        this.logger.log(`Dispatching WhatsApp via UltraMsg Gateway to ${cleanDigits}...`);
        const url = `https://api.ultramsg.com/${ultraInstance.trim()}/messages/chat`;
        const res = await axios.post(
          url,
          new URLSearchParams({
            token: ultraToken.trim(),
            to: cleanDigits,
            body: message,
          }),
          { timeout: 25000 }
        );

        if (res.data && (res.data.sent === 'true' || res.data.id)) {
          return { success: true, message: 'WhatsApp report delivered via UltraMsg Gateway!' };
        }
      } catch (err: any) {
        this.logger.error('UltraMsg dispatch failed:', err.response?.data || err.message);
      }
    }

    // Option C: CallMeBot Gateway
    if (personalApiKey && personalApiKey.trim()) {
      return this.sendCallMeBotMessage(cleanDigits, personalApiKey.trim(), message);
    }

    return {
      success: false,
      message: 'Server WhatsApp Gateway not yet connected. Please add GREEN_API_INSTANCE_ID and GREEN_API_TOKEN in Render environment variables or provide CallMeBot key.',
    };
  }

  /**
   * Dispatches text message through CallMeBot WhatsApp Gateway
   */
  async sendCallMeBotMessage(cleanPhone: string, apiKey: string, message: string): Promise<{ success: boolean; message: string }> {
    try {
      const formattedPhone = cleanPhone.startsWith('+') ? cleanPhone : '+' + cleanPhone;
      const encodedText = encodeURIComponent(message);
      const url = `https://api.callmebot.com/whatsapp.php?phone=${formattedPhone}&text=${encodedText}&apikey=${apiKey.trim()}`;

      this.logger.log(`Sending WhatsApp report via CallMeBot to ${formattedPhone}...`);

      const res = await axios.get(url, {
        timeout: 25000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (AutoPost-App-WhatsApp-Reporter/1.0)',
        },
      });

      const responseText = typeof res.data === 'string' ? res.data : JSON.stringify(res.data);
      if (responseText.includes('Message queued') || responseText.includes('Success') || res.status === 200) {
        return { success: true, message: 'WhatsApp report delivered successfully!' };
      }

      return { success: false, message: responseText.slice(0, 150) || 'Unexpected response from CallMeBot' };
    } catch (err: any) {
      this.logger.error(`CallMeBot WhatsApp dispatch error: ${err.message}`);
      return { success: false, message: err.response?.data || err.message };
    }
  }

  /**
   * Fetches real-time Facebook and YouTube data to construct executive daily morning report
   */
  async generateReportContent(userId?: string): Promise<string> {
    const now = new Date();
    const pktDateStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now);

    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. Fetch Facebook Pages
    const pageFilter = userId ? { userId } : {};
    const pages = await this.prisma.facebookPage.findMany({
      where: pageFilter,
      include: {
        uploads: {
          where: { createdAt: { gte: last24h } },
        },
      },
    });

    let fbSection = '';
    if (pages.length === 0) {
      fbSection = '  _Koi Facebook Page connected nahi hai._\n';
    } else {
      for (const page of pages) {
        let totalFollowers = 0;

        // Fetch fresh follower count from Facebook Graph API
        try {
          const res = await axios.get(
            `https://graph.facebook.com/v19.0/${page.pageId}?fields=followers_count,fan_count,name&access_token=${page.accessToken}`,
            { timeout: 8000 }
          );
          if (res.data) {
            totalFollowers = res.data.followers_count || res.data.fan_count || 0;
          }
        } catch (_) {}

        const completedUploads = page.uploads.filter((u) => u.status === 'COMPLETED').length;
        const failedUploads = page.uploads.filter((u) => u.status === 'FAILED').length;

        // Cloud queue count for this page
        const cloudQueueCount = await this.prisma.video.count({
          where: {
            source: { platform: 'MEGA_CLOUD', url: `cloud://${page.pageId}` },
            uploads: { none: { facebookPageId: page.id, status: 'COMPLETED', facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } } },
          },
        });

        fbSection += `🔹 *${page.name}*\n`;
        fbSection += `   • 👥 Followers: *${totalFollowers.toLocaleString()}*\n`;
        fbSection += `   • 🎬 Videos Uploaded (24h): *${completedUploads}* ${failedUploads > 0 ? `(${failedUploads} failed ⚠️)` : '✅'}\n`;
        fbSection += `   • 📁 Cloud Queue: *${cloudQueueCount}* videos left\n`;
        fbSection += `   • 🟢 Status: ${page.status === 'ACTIVE' ? 'Active' : 'Paused'}\n\n`;
      }
    }

    // 2. Fetch YouTube Channels (if any)
    const ytFilter = userId ? { userId } : {};
    const ytChannels = await this.prisma.youtubeChannel.findMany({
      where: ytFilter,
    });

    let ytSection = '';
    if (ytChannels.length > 0) {
      ytSection = '🔴 *YOUTUBE SHORTS:*\n';
      for (const ch of ytChannels) {
        const tiktokShortsUploaded = await this.prisma.tiktokYoutubeUpload.count({
          where: { youtubeChannelId: ch.id, status: 'COMPLETED', createdAt: { gte: last24h } },
        });
        const cloudShortsUploaded = await this.prisma.youtubeCloudVideo.count({
          where: { youtubeChannelId: ch.id, status: 'COMPLETED', uploadedAt: { gte: last24h } },
        });
        const totalShorts = tiktokShortsUploaded + cloudShortsUploaded;

        const ytPendingQueue = await this.prisma.youtubeCloudVideo.count({
          where: { youtubeChannelId: ch.id, status: 'PENDING' },
        });

        ytSection += `🔹 *${ch.name}*\n`;
        ytSection += `   • 🎬 Shorts Posted (24h): *${totalShorts}* ✅\n`;
        ytSection += `   • 📁 Cloud Queue: *${ytPendingQueue}* videos\n`;
        ytSection += `   • 🕒 Scheduled Times: *${ch.scheduledTime || 'OFF'}* (${ch.videosPerDay}/day)\n\n`;
      }
    }

    // 3. Check for Token or System Alerts
    const tokenIssues = await this.prisma.uploadHistory.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: last24h },
        errorMessage: { contains: 'access token', mode: 'insensitive' },
      },
    });

    let alertSection = '✅ All Page tokens & automation healthy.';
    if (tokenIssues > 0) {
      alertSection = `⚠️ *ATTENTION:* ${tokenIssues} upload(s) failed due to invalid/expired Facebook token. Please check your Pages!`;
    }

    const message = 
`📊 *AutoPost Daily Executive Report*
🗓 *Date:* ${pktDateStr} PKT
━━━━━━━━━━━━━━━━━━━━

📄 *FACEBOOK PAGES UPDATE:*
${fbSection.trim()}

${ytSection ? `${ytSection.trim()}\n━━━━━━━━━━━━━━━━━━━━\n` : ''}⚙️ *System Health:*
${alertSection}
━━━━━━━━━━━━━━━━━━━━
🤖 _AutoPost Cloud Monitoring Engine_`;

    return message;
  }

  /**
   * Cron check running every 45s: matches PKT time against user configured reportTime
   */
  async checkAndSendScheduledReports() {
    const now = new Date();

    const currentPktTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now); // e.g. "09:00"

    const currentPktDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now); // e.g. "2026-09-21"

    const activeConfigs = await this.prisma.whatsAppConfig.findMany({
      where: {
        enabled: true,
      },
    });

    for (const config of activeConfigs) {
      if (!config.phoneNumber) continue;

      // Check if time matches and hasn't been sent today
      if (config.reportTime === currentPktTime && config.lastSentDate !== currentPktDate) {
        this.logger.log(`Triggering daily morning WhatsApp report for user ${config.userId || 'Global'} (${config.phoneNumber}) at ${currentPktTime} PKT`);

        const report = await this.generateReportContent(config.userId || undefined);
        const result = await this.dispatchWhatsAppMessage(config.phoneNumber, report, config.apiKey || undefined);

        if (result.success) {
          await this.prisma.whatsAppConfig.update({
            where: { id: config.id },
            data: { lastSentDate: currentPktDate },
          });
          this.logger.log(`Scheduled WhatsApp report sent successfully to ${config.phoneNumber}`);
        } else {
          this.logger.warn(`Failed to send scheduled WhatsApp report: ${result.message}`);
        }
      }
    }
  }

  /**
   * Get WhatsApp configuration for user or default
   */
  async getConfig(userId?: string) {
    if (userId) {
      const userConfig = await this.prisma.whatsAppConfig.findUnique({
        where: { userId },
      });
      if (userConfig) return userConfig;
    }

    const firstConfig = await this.prisma.whatsAppConfig.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    return firstConfig;
  }

  /**
   * Save or update WhatsApp configuration (apiKey is optional)
   */
  async saveConfig(data: { phoneNumber: string; apiKey?: string; reportTime?: string; enabled?: boolean; userId?: string }) {
    const { phoneNumber, apiKey, reportTime = '09:00', enabled = true, userId } = data;

    if (userId) {
      return this.prisma.whatsAppConfig.upsert({
        where: { userId },
        create: {
          userId,
          phoneNumber,
          apiKey: apiKey || null,
          reportTime,
          enabled,
        },
        update: {
          phoneNumber,
          apiKey: apiKey || null,
          reportTime,
          enabled,
        },
      });
    }

    const existing = await this.prisma.whatsAppConfig.findFirst();
    if (existing) {
      return this.prisma.whatsAppConfig.update({
        where: { id: existing.id },
        data: {
          phoneNumber,
          apiKey: apiKey || null,
          reportTime,
          enabled,
        },
      });
    }

    return this.prisma.whatsAppConfig.create({
      data: {
        phoneNumber,
        apiKey: apiKey || null,
        reportTime,
        enabled,
      },
    });
  }

  /**
   * Send test report immediately to verify phone
   */
  async sendTestReport(phoneNumber: string, apiKey?: string, userId?: string) {
    const reportContent = await this.generateReportContent(userId);
    const testHeader = `🧪 *AutoPost WhatsApp Test Message*\n_Connection verified! Here is how your daily morning report will look:_\n\n`;
    const fullTestMessage = testHeader + reportContent;

    return this.dispatchWhatsAppMessage(phoneNumber, fullTestMessage, apiKey);
  }
}
