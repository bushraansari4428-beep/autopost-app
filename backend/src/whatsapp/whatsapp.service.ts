import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);

  // Deduplication & tracking caches for instant alerts
  private readonly sentAlertIds = new Set<string>();
  private readonly zeroStockAlertedPages = new Set<string>();
  private readonly zeroStockAlertedChannels = new Set<string>();
  private readonly missedSlotAlerts = new Set<string>();
  private readonly tokenAlertedPages = new Set<string>();
  private isCheckingAlerts = false;
  private lastTokenCheckTime = 0;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Seed existing failed upload IDs on server start so we only alert fresh new failures
    try {
      const existingFbFails = await this.prisma.uploadHistory.findMany({
        where: { status: 'FAILED' },
        select: { id: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      });
      existingFbFails.forEach((f) => this.sentAlertIds.add(`fb_fail_${f.id}`));

      const existingYtFails = await this.prisma.youtubeCloudVideo.findMany({
        where: { status: 'FAILED' },
        select: { id: true },
        take: 100,
        orderBy: { updatedAt: 'desc' },
      });
      existingYtFails.forEach((f) => this.sentAlertIds.add(`yt_cloud_fail_${f.id}`));
    } catch (_) {}

    // Check every 45 seconds for scheduled WhatsApp daily reports
    setInterval(() => {
      this.checkAndSendScheduledReports().catch((err) => {
        this.logger.error('Error in scheduled WhatsApp reporter:', err.message);
      });
    }, 45 * 1000);

    // Check every 30 seconds for instant real-time alerts (failures, zero stock, missed slots)
    setInterval(() => {
      this.checkAndSendInstantAlerts().catch((err) => {
        this.logger.error('Error in instant WhatsApp alerts watcher:', err.message);
      });
    }, 30 * 1000);

    this.logger.log('WhatsApp Automated Daily Reporter & Instant Alert Engine initialized.');
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
    } else if (cleanDigits.startsWith('3') && cleanDigits.length === 10) {
      cleanDigits = '92' + cleanDigits;
    }

    // Option A: Green-API Gateway (Zero-config for user)
    const greenInstance = process.env.GREEN_API_INSTANCE_ID || '710722741413';
    const greenToken = process.env.GREEN_API_TOKEN || '60a1dd7a5f9e41b7bbfed4e57a3335fc5df38d4f8fe54caf9c';
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
        const errorDetail = err.response?.data?.message || err.response?.data || err.message;
        this.logger.error('Green-API dispatch failed:', errorDetail);
        return { success: false, message: `Green-API error: ${typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail}` };
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
   * Helper to dispatch instant alert to all active configs or specific user config
   */
  private async sendAlertToRecipients(message: string, targetUserId?: string | null) {
    try {
      const activeConfigs = await this.prisma.whatsAppConfig.findMany({
        where: {
          enabled: true,
          instantAlerts: true,
        },
      });

      if (activeConfigs.length === 0) return;

      const recipients = targetUserId
        ? activeConfigs.filter((c) => c.userId === targetUserId || !c.userId)
        : activeConfigs;

      const targetList = recipients.length > 0 ? recipients : activeConfigs;

      for (const config of targetList) {
        if (!config.phoneNumber) continue;
        await this.dispatchWhatsAppMessage(config.phoneNumber, message, config.apiKey || undefined);
      }
    } catch (err: any) {
      this.logger.error('Failed to send alert to recipients:', err.message);
    }
  }

  /**
   * Formats raw error messages into clean, actionable Roman Urdu descriptions
   */
  private formatErrorMessage(rawError?: string | null): string {
    if (!rawError) return 'Upload ke doran ghalat response ya error aya.';
    const lower = rawError.toLowerCase();
    if (lower.includes('access token') || lower.includes('session has expired') || lower.includes('code 190') || lower.includes('invalid oauth')) {
      return 'Facebook Page access token expire ho chuka hai ya session invalid ho gaya hai.';
    }
    if (lower.includes('checkpoint') || lower.includes('verification') || lower.includes('verify') || lower.includes('security check')) {
      return 'Facebook account par security verification / checkpoint aa chuka hai. Facebook login kar ke verify karein.';
    }
    if (lower.includes('rate limit') || lower.includes('too many calls') || lower.includes('throttled')) {
      return 'Facebook API rate limit reach ho chuki hai. System thori der me auto-retry karega.';
    }
    if (lower.includes('permission') || lower.includes('publish_video')) {
      return 'Page video upload permissions missing hain.';
    }
    if (lower.includes('quota') || lower.includes('youtubequota')) {
      return 'YouTube daily upload quota exhaust ho chuki hai.';
    }
    return rawError.length > 200 ? rawError.substring(0, 200) + '...' : rawError;
  }

  /**
   * Real-time watchdog checking every 30 seconds for:
   * 1. Facebook upload failures / warnings / errors
   * 2. YouTube upload failures
   * 3. Zero remaining videos in Cloud Queue (One-time instant alert per empty event)
   * 4. Missed scheduled upload slots
   * 5. Periodic Facebook access token / checkpoint health checks
   */
  async checkAndSendInstantAlerts() {
    if (this.isCheckingAlerts) return;
    this.isCheckingAlerts = true;

    try {
      // Check if there are active listeners
      const hasActiveListener = await this.prisma.whatsAppConfig.findFirst({
        where: { enabled: true, instantAlerts: true },
      });
      if (!hasActiveListener) return;

      const now = new Date();
      const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(now);

      const pktDateStr = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now);

      // ─────────────────────────────────────────────────────────────
      // 1. Facebook Upload Failures (Last 60 Minutes)
      // ─────────────────────────────────────────────────────────────
      const recentFbFails = await this.prisma.uploadHistory.findMany({
        where: {
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: {
          video: true,
          facebookPage: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      for (const fail of recentFbFails) {
        const alertKey = `fb_fail_${fail.id}`;
        if (!this.sentAlertIds.has(alertKey)) {
          this.sentAlertIds.add(alertKey);

          const pageName = fail.facebookPage?.name || 'Facebook Page';
          const videoTitle = fail.video?.title || 'Video';
          const errorMsg = this.formatErrorMessage(fail.errorMessage);

          const alert =
`🚨 *AutoPost Alert: Upload Failed!*
━━━━━━━━━━━━━━━━━━━━
📄 *Page:* *${pageName}*
🎬 *Video:* ${videoTitle}
⚠️ *Wajah:* ${errorMsg}
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Action Required: Baraye meharbani page settings ya Facebook account check karein taake posts jari reh sakein._`;

          await this.sendAlertToRecipients(alert, fail.facebookPage?.userId);
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 2. YouTube Upload Failures (Last 60 Minutes)
      // ─────────────────────────────────────────────────────────────
      const recentYtCloudFails = await this.prisma.youtubeCloudVideo.findMany({
        where: {
          status: 'FAILED',
          updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: { youtubeChannel: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      for (const fail of recentYtCloudFails) {
        const alertKey = `yt_cloud_fail_${fail.id}`;
        if (!this.sentAlertIds.has(alertKey)) {
          this.sentAlertIds.add(alertKey);

          const channelName = fail.youtubeChannel?.name || 'YouTube Channel';
          const videoTitle = fail.title || 'Short';
          const errorMsg = this.formatErrorMessage(fail.errorMessage);

          const alert =
`🚨 *AutoPost Alert: YouTube Upload Failed!*
━━━━━━━━━━━━━━━━━━━━
🔴 *YouTube Channel:* *${channelName}*
🎬 *Short:* ${videoTitle}
⚠️ *Wajah:* ${errorMsg}
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Baraye meharbani YouTube channel connection ya quota check karein._`;

          await this.sendAlertToRecipients(alert, fail.youtubeChannel?.userId);
        }
      }

      const recentTiktokYtFails = await this.prisma.tiktokYoutubeUpload.findMany({
        where: {
          status: 'FAILED',
          updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
        include: { youtubeChannel: true },
        orderBy: { updatedAt: 'desc' },
        take: 10,
      });

      for (const fail of recentTiktokYtFails) {
        const alertKey = `tt_yt_fail_${fail.id}`;
        if (!this.sentAlertIds.has(alertKey)) {
          this.sentAlertIds.add(alertKey);

          const channelName = fail.youtubeChannel?.name || 'YouTube Channel';
          const videoTitle = fail.title || 'TikTok Short';
          const errorMsg = this.formatErrorMessage(fail.errorMessage);

          const alert =
`🚨 *AutoPost Alert: YouTube Sync Failed!*
━━━━━━━━━━━━━━━━━━━━
🔴 *YouTube Channel:* *${channelName}*
🎬 *Short:* ${videoTitle}
⚠️ *Wajah:* ${errorMsg}
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━`;

          await this.sendAlertToRecipients(alert, fail.youtubeChannel?.userId);
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 3. Zero Remaining Videos Alert (Instant One-Time Alert)
      // ─────────────────────────────────────────────────────────────
      const activePages = await this.prisma.facebookPage.findMany({
        where: { status: 'ACTIVE' },
      });

      for (const page of activePages) {
        const cloudQueueCount = await this.prisma.video.count({
          where: {
            source: { platform: 'MEGA_CLOUD', url: `cloud://${page.pageId}` },
            uploads: { none: { facebookPageId: page.id, status: 'COMPLETED', facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } } },
          },
        });

        if (cloudQueueCount === 0) {
          if (!this.zeroStockAlertedPages.has(page.id)) {
            this.zeroStockAlertedPages.add(page.id);

            const alert =
`⚠️ *AutoPost Stock Alert: 0 Videos Left!*
━━━━━━━━━━━━━━━━━━━━
📄 *Page:* *${page.name}*
📁 *Queue Status:* Cloud queue me koi video baki nahi rahi (*0 Videos Remaining*).
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Agli scheduled posting miss ho sakti hai. Baraye meharbani mazeed videos upload karein taake auto-posting chalti rahe._`;

            await this.sendAlertToRecipients(alert, page.userId);
          }
        } else {
          // Re-arm alert if new videos added
          if (this.zeroStockAlertedPages.has(page.id)) {
            this.zeroStockAlertedPages.delete(page.id);
          }
        }
      }

      const activeYtChannels = await this.prisma.youtubeChannel.findMany({
        where: { status: 'ACTIVE' },
      });

      for (const ch of activeYtChannels) {
        const ytPendingQueue = await this.prisma.youtubeCloudVideo.count({
          where: { youtubeChannelId: ch.id, status: 'PENDING' },
        });

        if (ytPendingQueue === 0) {
          if (!this.zeroStockAlertedChannels.has(ch.id)) {
            this.zeroStockAlertedChannels.add(ch.id);

            const alert =
`⚠️ *AutoPost Stock Alert: 0 Shorts Left!*
━━━━━━━━━━━━━━━━━━━━
🔴 *YouTube Channel:* *${ch.name}*
📁 *Queue Status:* YouTube cloud queue me koi short baki nahi raha (*0 Shorts Remaining*).
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Baraye meharbani mazeed shorts upload karein taake YouTube schedule miss na ho._`;

            await this.sendAlertToRecipients(alert, ch.userId);
          }
        } else {
          // Re-arm alert if new videos added
          if (this.zeroStockAlertedChannels.has(ch.id)) {
            this.zeroStockAlertedChannels.delete(ch.id);
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 4. Missed Scheduled Upload Alert
      // ─────────────────────────────────────────────────────────────
      const pktHours = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', hour: '2-digit', hour12: false }).format(now),
        10
      );
      const pktMinutes = parseInt(
        new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Karachi', minute: '2-digit', hour12: false }).format(now),
        10
      );
      const currentPktTotalMins = pktHours * 60 + pktMinutes;

      const activeMappings = await this.prisma.mapping.findMany({
        where: {
          status: 'ACTIVE',
          scheduledTime: { not: null },
        },
        include: {
          facebookPage: true,
          source: true,
        },
      });

      for (const mapping of activeMappings) {
        if (!mapping.scheduledTime || mapping.scheduledTime === '00:00') continue;

        const slots = mapping.scheduledTime.split(',').map((s) => s.trim()).filter(Boolean);
        for (const slot of slots) {
          const parts = slot.split(':').map(Number);
          if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;

          const slotTotalMins = parts[0] * 60 + parts[1];
          // Check if slot has passed by 20 to 35 minutes
          if (currentPktTotalMins >= slotTotalMins + 20 && currentPktTotalMins <= slotTotalMins + 35) {
            const alertKey = `missed_${mapping.id}_${slot}_${pktDateStr}`;
            if (!this.missedSlotAlerts.has(alertKey)) {
              this.missedSlotAlerts.add(alertKey);

              const slotStartTime = new Date(Date.now() - 45 * 60 * 1000);
              const uploadsCount = await this.prisma.uploadHistory.count({
                where: {
                  facebookPageId: mapping.facebookPageId,
                  createdAt: { gte: slotStartTime },
                  status: { in: ['COMPLETED', 'PROCESSING', 'PENDING'] },
                  OR: [
                    { facebookPostId: null },
                    { facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } },
                  ],
                },
              });

              if (uploadsCount === 0) {
                const alert =
`⚠️ *AutoPost Alert: Scheduled Slot Missed!*
━━━━━━━━━━━━━━━━━━━━
📄 *Page:* *${mapping.facebookPage?.name || 'Page'}*
⏰ *Scheduled Time:* *${slot}* PKT
❌ *Status:* Is time slot pe video post nahi hui (Queue khali hai ya upload execute nahi hui).
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Baraye meharbani page queue aur schedule check karein._`;

                await this.sendAlertToRecipients(alert, mapping.facebookPage?.userId);
              }
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 5. Periodic Facebook Token & Checkpoint Verification (Every 15 mins)
      // ─────────────────────────────────────────────────────────────
      const nowMs = Date.now();
      if (nowMs - this.lastTokenCheckTime > 15 * 60 * 1000) {
        this.lastTokenCheckTime = nowMs;

        for (const page of activePages) {
          if (!page.accessToken) continue;
          try {
            const res = await axios.get(
              `https://graph.facebook.com/v19.0/${page.pageId}?fields=name,id&access_token=${page.accessToken}`,
              { timeout: 8000 }
            );
            if (res.data?.id && this.tokenAlertedPages.has(page.id)) {
              this.tokenAlertedPages.delete(page.id);
            }
          } catch (fbErr: any) {
            const errData = fbErr.response?.data?.error;
            const errCode = errData?.code;
            const subCode = errData?.error_subcode;
            const errMsg = errData?.message || fbErr.message;

            if (errCode === 190 || subCode === 463 || subCode === 467 || subCode === 458 || subCode === 459 || subCode === 460) {
              if (!this.tokenAlertedPages.has(page.id)) {
                this.tokenAlertedPages.add(page.id);

                const alert =
`⚠️ *AutoPost Alert: Facebook Verification / Token Expired!*
━━━━━━━━━━━━━━━━━━━━
📄 *Page:* *${page.name}*
🔐 *Issue:* Facebook session expire ho chuki hai ya security verification/checkpoint darkaar hai.
⚠️ *FB Error:* ${errMsg}
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Action Required: Facebook account open kar ke checkpoint verify karein, aur dashboard me Page ko dubara connect karein._`;

                await this.sendAlertToRecipients(alert, page.userId);
              }
            }
          }
        }
      }

      // Clean memory cache if size exceeds limits
      if (this.sentAlertIds.size > 2000) {
        const arr = Array.from(this.sentAlertIds).slice(-500);
        this.sentAlertIds.clear();
        arr.forEach((id) => this.sentAlertIds.add(id));
      }
      if (this.missedSlotAlerts.size > 1000) {
        const arr = Array.from(this.missedSlotAlerts).slice(-300);
        this.missedSlotAlerts.clear();
        arr.forEach((id) => this.missedSlotAlerts.add(id));
      }
    } catch (err: any) {
      this.logger.error('Error during checkAndSendInstantAlerts:', err.message);
    } finally {
      this.isCheckingAlerts = false;
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
   * Save or update WhatsApp configuration
   */
  async saveConfig(data: { phoneNumber: string; apiKey?: string; reportTime?: string; enabled?: boolean; instantAlerts?: boolean; userId?: string }) {
    const { phoneNumber, apiKey, reportTime = '09:00', enabled = true, instantAlerts = true, userId } = data;

    if (userId) {
      return this.prisma.whatsAppConfig.upsert({
        where: { userId },
        create: {
          userId,
          phoneNumber,
          apiKey: apiKey || null,
          reportTime,
          enabled,
          instantAlerts,
        },
        update: {
          phoneNumber,
          apiKey: apiKey || null,
          reportTime,
          enabled,
          instantAlerts,
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
          instantAlerts,
        },
      });
    }

    return this.prisma.whatsAppConfig.create({
      data: {
        phoneNumber,
        apiKey: apiKey || null,
        reportTime,
        enabled,
        instantAlerts,
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

  /**
   * Send test instant alert immediately to verify instant alerts delivery
   */
  async sendTestInstantAlert(phoneNumber: string, apiKey?: string) {
    const now = new Date();
    const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now);

    const testMessage =
`⚡ *AutoPost Alert: Instant Notification Test!*
━━━━━━━━━━━━━━━━━━━━
📄 *Status:* Instant Alerts Active & Operational ✅
🎯 *Coverage:*
 • Upload failures & errors
 • Facebook token expiration & checkpoints
 • Cloud Queue 0 videos baki rehne par instant stock alert
 • Missed scheduled upload slots
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
🤖 _AutoPost Real-Time Watchdog Engine_`;

    return this.dispatchWhatsAppMessage(phoneNumber, testMessage, apiKey);
  }
}
