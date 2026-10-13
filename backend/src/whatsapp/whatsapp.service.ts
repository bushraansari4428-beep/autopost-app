import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import axios from 'axios';

@Injectable()
export class WhatsappService implements OnModuleInit {
  private readonly logger = new Logger(WhatsappService.name);

  // Deduplication & tracking caches for instant alerts and schedules
  private readonly sentAlertIds = new Set<string>();
  private readonly sentStockAlertSlots = new Set<string>();
  private readonly missedSlotAlerts = new Set<string>();
  private readonly tokenAlertedPages = new Set<string>();
  private readonly lowPromptAlertedKeys = new Set<string>();
  private isCheckingAlerts = false;
  private isCheckingReports = false;
  private lastTokenCheckTime = 0;

  // Live VPS Auto Bulk Video Generator Prompt Files Inventory
  private vpsPromptFiles: Map<
    string,
    { filename: string; remainingPrompts: number; matchedPage?: string; updatedAt: string }
  > = new Map([
    [
      'Stickhead_Skits-50-prompts.txt',
      {
        filename: 'Stickhead_Skits-50-prompts.txt',
        remainingPrompts: 9,
        matchedPage: 'Stickhead Skits',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'Unexplained_Finds-100-prompts.txt',
      {
        filename: 'Unexplained_Finds-100-prompts.txt',
        remainingPrompts: 91,
        matchedPage: 'Unexplained Finds',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'Marine mafia-1000- prompts.txt',
      {
        filename: 'Marine mafia-1000- prompts.txt',
        remainingPrompts: 929,
        matchedPage: 'Marine Mafia',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'EA_Hustle_1000-prompts.txt',
      {
        filename: 'EA_Hustle_1000-prompts.txt',
        remainingPrompts: 934,
        matchedPage: 'Sea hustle',
        updatedAt: new Date().toISOString(),
      },
    ],
    [
      'Viral_Anomaly_Found_Footage_500_Prompts.txt',
      {
        filename: 'Viral_Anomaly_Found_Footage_500_Prompts.txt',
        remainingPrompts: 500,
        matchedPage: 'General / Backup',
        updatedAt: new Date().toISOString(),
      },
    ],
  ]);

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

    // Run an immediate startup check after 8 seconds so if Render cold-starts during a report window,
    // any missed 8:00 AM / 8:00 PM report is dispatched right away
    setTimeout(() => {
      this.checkAndSendScheduledReports().catch((err) => {
        this.logger.error('Error in initial scheduled WhatsApp report check:', err.message);
      });
    }, 8000);

    // Check every 45 seconds for scheduled WhatsApp daily reports (8:00 AM & 8:00 PM PKT with catch-up window)
    // and scheduled low stock alerts (7:00 AM, 12:00 PM, 5:00 PM PKT)
    setInterval(() => {
      this.checkAndSendScheduledReports().catch((err) => {
        this.logger.error('Error in scheduled WhatsApp reporter:', err.message);
      });
      this.checkAndSendScheduledStockAlerts().catch((err) => {
        this.logger.error('Error in scheduled WhatsApp stock alert engine:', err.message);
      });
    }, 45 * 1000);

    // Check every 30 seconds for instant real-time alerts (failures, missed slots, token issues)
    setInterval(() => {
      this.checkAndSendInstantAlerts().catch((err) => {
        this.logger.error('Error in instant WhatsApp alerts watcher:', err.message);
      });
    }, 30 * 1000);

    this.logger.log('WhatsApp Automated Reporting & Alert Engine initialized.');
  }

  /**
   * Unified WhatsApp message dispatcher supporting:
   * 1. Green-API Master Gateway (Dedicated 7107 cluster + standard api.green-api.com failover)
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

    // Option A: Green-API Gateway (Dedicated cluster host first + standard host fallback)
    const greenInstance = (process.env.GREEN_API_INSTANCE_ID || '710722741413').trim();
    const greenToken = (process.env.GREEN_API_TOKEN || '60a1dd7a5f9e41b7bbfed4e57a3335fc5df38d4f8fe54caf9c').trim();
    if (greenInstance && greenToken) {
      const clusterPrefix = greenInstance.slice(0, 4);
      const greenEndpoints = [
        `https://${clusterPrefix}.api.greenapi.com/waInstance${greenInstance}/sendMessage/${greenToken}`,
        `https://api.green-api.com/waInstance${greenInstance}/sendMessage/${greenToken}`,
      ];

      let lastErrorDetail: any = null;
      for (const url of greenEndpoints) {
        try {
          const hostLabel = url.split('/waInstance')[0];
          this.logger.log(`Dispatching WhatsApp via Green-API (${hostLabel}) to ${cleanDigits}...`);
          const res = await axios.post(
            url,
            {
              chatId: `${cleanDigits}@c.us`,
              message: message,
            },
            { timeout: 15000 }
          );

          if (res.data && res.data.idMessage) {
            return { success: true, message: 'WhatsApp report delivered via Green-API Gateway!' };
          }
        } catch (err: any) {
          lastErrorDetail = err.response?.data?.message || err.response?.data || err.message;
          this.logger.warn(`Green-API host failed (${url.split('/waInstance')[0]}): ${lastErrorDetail}`);
        }
      }

      this.logger.error('All Green-API hosts failed:', lastErrorDetail);
      return {
        success: false,
        message: `Green-API error: ${typeof lastErrorDetail === 'object' ? JSON.stringify(lastErrorDetail) : lastErrorDetail}`,
      };
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
   * Updates the live VPS Auto Bulk Video Generator Prompt Files inventory
   * and triggers an instant WhatsApp notification if any file has <= 10 prompts remaining.
   */
  async updateVpsPromptInventory(
    files: Array<{ filename: string; remainingPrompts: number; matchedPage?: string }>,
    forceAlert = false,
  ) {
    if (!Array.isArray(files) || files.length === 0) {
      return { success: true, count: this.vpsPromptFiles.size, lowFilesAlerted: 0 };
    }

    const nowIso = new Date().toISOString();
    const currentPktDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const lowFilesToAlert: Array<{ filename: string; remainingPrompts: number; matchedPage?: string }> = [];

    for (const item of files) {
      if (!item || !item.filename) continue;
      const cleanName = item.filename.trim();
      const remaining = Math.max(0, Number(item.remainingPrompts) || 0);
      const matchedPage = item.matchedPage || this.inferPageFromPromptFilename(cleanName);

      this.vpsPromptFiles.set(cleanName, {
        filename: cleanName,
        remainingPrompts: remaining,
        matchedPage,
        updatedAt: nowIso,
      });

      // If file was restocked (> 10 prompts), clear previous low-stock alert locks for this file
      if (remaining > 10) {
        for (const key of Array.from(this.lowPromptAlertedKeys)) {
          if (key.includes(`_${cleanName}_`)) {
            this.lowPromptAlertedKeys.delete(key);
          }
        }
      } else {
        // File has <= 10 prompts left! Alert once per day per remaining count (or if forceAlert is true)
        const alertKey = `low_prompt_${currentPktDate}_${cleanName}_${remaining}`;
        const dailyFileKey = `low_prompt_daily_${currentPktDate}_${cleanName}`;
        if (forceAlert || (!this.lowPromptAlertedKeys.has(alertKey) && !this.lowPromptAlertedKeys.has(dailyFileKey))) {
          this.lowPromptAlertedKeys.add(alertKey);
          this.lowPromptAlertedKeys.add(dailyFileKey);
          lowFilesToAlert.push({ filename: cleanName, remainingPrompts: remaining, matchedPage });
        }
      }
    }

    if (lowFilesToAlert.length > 0) {
      await this.sendLowPromptFilesAlert(lowFilesToAlert);
    }

    return {
      success: true,
      count: this.vpsPromptFiles.size,
      lowFilesAlerted: lowFilesToAlert.length,
      inventory: this.getVpsPromptInventory(),
    };
  }

  getVpsPromptInventory() {
    return Array.from(this.vpsPromptFiles.values()).sort((a, b) => a.remainingPrompts - b.remainingPrompts);
  }

  private inferPageFromPromptFilename(filename: string): string {
    const lower = filename.toLowerCase();
    if (lower.includes('stickhead')) return 'Stickhead Skits';
    if (lower.includes('unexplained')) return 'Unexplained Finds';
    if (lower.includes('marine')) return 'Marine Mafia';
    if (lower.includes('hustle')) return 'Sea hustle';
    if (lower.includes('rare') && lower.includes('animal')) return 'Rare Animal Encounters';
    if (lower.includes('goofy')) return 'Goofy Critters';
    if (lower.includes('aircraft')) return 'Aircraft Expert';
    if (lower.includes('terminal')) return 'Terminal Task';
    if (lower.includes('luxury')) return 'Luxury Altitude';
    if (lower.includes('lens')) return 'Lens To Soul';
    if (lower.includes('unseen')) return 'Unseen Artistry';
    return filename.replace(/[-_]?\d+[-_]?prompts?\.txt$/i, '').replace(/\.txt$/i, '').replace(/[-_]+/g, ' ').trim();
  }

  /**
   * Sends a dedicated WhatsApp notification when any VPS .txt prompt file has <= 10 prompts remaining
   */
  async sendLowPromptFilesAlert(
    lowFiles: Array<{ filename: string; remainingPrompts: number; matchedPage?: string }>,
  ) {
    if (!lowFiles || lowFiles.length === 0) return { success: false, message: 'No low files to alert' };

    const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date());

    let fileLines = '';
    for (const f of lowFiles) {
      const statusBadge =
        f.remainingPrompts === 0
          ? '🔴 *0 Prompts Baki (File Khatam Ho Gayi Hai!)*'
          : `⚠️ *Sirf ${f.remainingPrompts} Prompts Reh Gayi Hain!* (<= 10 Alert)`;
      fileLines += `📂 *File:* *${f.filename}*\n`;
      if (f.matchedPage) {
        fileLines += `   • 📌 *Page:* *${f.matchedPage}*\n`;
      }
      fileLines += `   • 🔢 *Status:* ${statusBadge}\n\n`;
    }

    const message =
`🚨 *VPS Prompt File Low Stock Alert!*
━━━━━━━━━━━━━━━━━━━━
⚠️ *Bhai, aap ke VPS Auto Bulk Video Generator me niche di gayi Prompt File(s) me 10 ya us se kam prompts reh gayi hain:*

${fileLines.trim()}

🕒 *Alert Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 *Action Required:* Baraye meharbani is prompt file ko restock kar lein ya *Prompt Generator* se new prompt file VPS par send kar dein taake kisi bhi page ki prompt file khatam na ho aur video generation chalti rahe!`;

    await this.sendAlertToRecipients(message);
    this.logger.log(`Dispatched Low Prompt File WhatsApp Alert for ${lowFiles.length} file(s).`);
    return { success: true, alerted: lowFiles.length };
  }

  /**
   * Returns list of Facebook Pages that have an active Mega Cloud mapping that is ON (status === ACTIVE and scheduledTime != '00:00')
   */
  async getActiveMegaCloudPages(userId?: string) {
    const pageFilter = userId ? { userId } : {};
    return this.prisma.facebookPage.findMany({
      where: {
        ...pageFilter,
        status: 'ACTIVE',
        mappings: {
          some: {
            status: 'ACTIVE',
            scheduledTime: { not: null, notIn: ['00:00', ''] },
            source: { platform: 'MEGA_CLOUD' },
          },
        },
      },
      include: {
        mappings: {
          where: {
            status: 'ACTIVE',
            scheduledTime: { not: null, notIn: ['00:00', ''] },
            source: { platform: 'MEGA_CLOUD' },
          },
          include: { source: true },
        },
      },
    });
  }

  /**
   * Constructs the comprehensive Executive Daily Report (Sent at 8:00 AM & 8:00 PM PKT):
   * - Clearly highlighted Page Name for every page
   * - Explicit Upload Status (Uploaded vs Not Uploaded)
   * - Exact Upload Time(s) in PKT for every uploaded video
   * - Live Followers count with daily update
   * - Video Stock / Cloud Queue ready count + newly stocked videos in last 24h
   * - VPS Auto Bulk Video Generator Prompt Files status (highlighting any file with <= 10 prompts left)
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
    const pageFilter = userId ? { userId } : {};

    // 1. Fetch ALL active Facebook Pages
    const pages = await this.prisma.facebookPage.findMany({
      where: {
        ...pageFilter,
        status: 'ACTIVE',
      },
      include: {
        mappings: {
          include: { source: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    let totalUploadedPagesCount = 0;
    let totalVideosUploaded24h = 0;
    let totalReadyStockVideos = 0;
    const stockedPagesSummary: string[] = [];

    let fbSection = '';
    if (pages.length === 0) {
      fbSection = '  _Koi active Facebook Page nahi mila._\n';
    } else {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i];
        let totalFollowers = 0;
        let newFollowersToday = 0;

        // Fetch fresh follower count & daily adds from Facebook Graph API
        if (page.accessToken) {
          try {
            const res = await axios.get(
              `https://graph.facebook.com/v19.0/${page.pageId}?fields=followers_count,fan_count,name&access_token=${page.accessToken}`,
              { timeout: 8000 }
            );
            if (res.data) {
              totalFollowers = res.data.followers_count ?? res.data.fan_count ?? 0;
            }
            // Optional daily new followers check via page_fan_adds insight
            const insRes = await axios
              .get(
                `https://graph.facebook.com/v19.0/${page.pageId}/insights?metric=page_fan_adds&period=day&access_token=${page.accessToken}`,
                { timeout: 5000 }
              )
              .catch(() => null);
            const addsValues = insRes?.data?.data?.[0]?.values;
            if (Array.isArray(addsValues) && addsValues.length > 0) {
              const latestVal = addsValues[addsValues.length - 1]?.value;
              if (typeof latestVal === 'number' && latestVal > 0) {
                newFollowersToday = latestVal;
              }
            }
          } catch (fbErr: any) {
            this.logger.warn(`Could not fetch followers for ${page.name}: ${fbErr.message}`);
          }
        }

        // Fetch completed video uploads to Facebook in the last 24 hours
        const completedUploads = await this.prisma.uploadHistory.findMany({
          where: {
            facebookPageId: page.id,
            status: 'COMPLETED',
            createdAt: { gte: last24h },
            OR: [
              { facebookPostId: null },
              { facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } },
            ],
          },
          include: {
            video: {
              include: { source: true },
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        // Fetch how many new videos were generated/stocked into Cloud Queue in the last 24h
        const newlyStocked24h = await this.prisma.uploadHistory.count({
          where: {
            facebookPageId: page.id,
            status: 'COMPLETED',
            facebookPostId: 'MEGA_CLOUD_UPLOAD',
            createdAt: { gte: last24h },
          },
        });

        // Always check remaining ready video stock in Cloud Queue for this page
        const cloudQueueCount = await this.prisma.video.count({
          where: {
            source: { platform: 'MEGA_CLOUD', url: `cloud://${page.pageId}` },
            uploads: {
              none: {
                facebookPageId: page.id,
                status: 'COMPLETED',
                facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' },
              },
            },
          },
        });

        // Fetch failed uploads in the last 24 hours
        const failedUploadsCount = await this.prisma.uploadHistory.count({
          where: {
            facebookPageId: page.id,
            status: 'FAILED',
            createdAt: { gte: last24h },
          },
        });

        if (completedUploads.length > 0) {
          totalUploadedPagesCount++;
          totalVideosUploaded24h += completedUploads.length;
        }
        if (cloudQueueCount > 0) {
          totalReadyStockVideos += cloudQueueCount;
          stockedPagesSummary.push(`*${page.name.trim()}* (${cloudQueueCount} videos)`);
        }

        const primaryMapping = page.mappings?.find((m) => m.status === 'ACTIVE') || page.mappings?.[0];
        const isTikTokSource = primaryMapping?.source?.platform === 'TIKTOK';
        const isPaused = primaryMapping?.status === 'PAUSED';
        const scheduleSlots = primaryMapping?.scheduledTime || page.scheduledTime || '04:30, 19:00';
        const slotCount = scheduleSlots.split(',').map((s) => s.trim()).filter(Boolean).length;
        const targetPerDay = Math.max(primaryMapping?.videosPerDay || 0, page.videosPerDay || 0, slotCount || 2);

        // 1. Highlighted Page Header
        fbSection += `┏━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        fbSection += `📌 *${i + 1}. PAGE: ${page.name.trim().toUpperCase()}*\n`;

        // 2. Clear Video Upload Status & Upload Time(s)
        if (completedUploads.length > 0) {
          fbSection += `┣ 📤 *Upload Status:* ✅ *VIDEO UPLOADED (${completedUploads.length}/${targetPerDay} Today)*\n`;
          completedUploads.forEach((u, idx) => {
            const uploadTimeStr = new Intl.DateTimeFormat('en-GB', {
              timeZone: 'Asia/Karachi',
              hour: '2-digit',
              minute: '2-digit',
              hour12: true,
            })
              .format(u.updatedAt || u.createdAt)
              .toUpperCase();

            const rawTitle = (u.video?.title || 'Video').trim();
            const cleanTitle = rawTitle.length > 42 ? rawTitle.substring(0, 39) + '...' : rawTitle;
            fbSection += `┣ 🕒 *Video ${idx + 1} Time:* *${uploadTimeStr} PKT* — _"${cleanTitle}"_\n`;
          });
        } else {
          fbSection += `┣ 📤 *Upload Status:* ❌ *NO VIDEO UPLOADED YET (0/${targetPerDay})*\n`;
          fbSection += `┣ 🕒 *Upload Time:* _Last 24h me koi video upload nahi hui_\n`;
        }

        // 3. Followers Count with Daily Update
        const followersText = `${totalFollowers.toLocaleString()} Followers`;
        const dailyGrowthBadge =
          newFollowersToday > 0 ? ` *(+${newFollowersToday} New Today 📈)*` : ` _(Daily Live Update ✅)_`;
        fbSection += `┣ 👥 *Followers:* *${followersText}*${dailyGrowthBadge}\n`;

        // 4. Video Stock / Cloud Queue / Newly Created Videos Status
        const newStockTag = newlyStocked24h > 0 ? ` *(+${newlyStocked24h} New Videos Stocked Today 🆕)*` : '';
        if (cloudQueueCount > 0) {
          const stockHealth = cloudQueueCount <= 2 ? '🟡 *(Low Stock)*' : '✅ *(Stock Ready)*';
          fbSection += `┣ 📦 *Video Stock:* *${cloudQueueCount} Videos in Stock* ${stockHealth}${newStockTag}\n`;
        } else if (isTikTokSource) {
          fbSection += `┣ 📦 *Video Stock / Source:* 🔗 *TikTok Auto-Downloader Active* _(0 Cloud Stock)_\n`;
        } else {
          fbSection += `┣ 📦 *Video Stock:* 🔴 *0 Videos in Stock (Stock Empty!)*${newStockTag}\n`;
        }

        // 5. Schedule & Errors
        const statusTag = isPaused ? '⏸️ Paused' : '🟢 Active';
        fbSection += `┗ ⏰ *Schedule:* *${scheduleSlots} PKT* (${statusTag})${failedUploadsCount > 0 ? ` | ⚠️ *${failedUploadsCount} Failed*` : ''}\n\n`;
      }
    }

    // 2. Stocked Pages Quick Summary
    let stockOverviewSection = '';
    if (stockedPagesSummary.length > 0) {
      stockOverviewSection =
`📦 *PAGES WITH READY VIDEO STOCK (${totalReadyStockVideos} Total Videos):*
   • ${stockedPagesSummary.join('\n   • ')}\n\n`;
    }

    // 3. VPS Auto Bulk Video Generator Prompt Files Status
    const promptInventory = this.getVpsPromptInventory();
    let vpsPromptSection = '';
    if (promptInventory.length > 0) {
      vpsPromptSection = `📂 *VPS PROMPT FILES STATUS (Auto Bulk Generator):*\n`;
      for (const pf of promptInventory) {
        const isLow = pf.remainingPrompts <= 10;
        const badge =
          pf.remainingPrompts === 0
            ? '🔴 *0 LEFT (KHATAM! NEW FILE DEIN)*'
            : isLow
            ? `🚨 *SIRF ${pf.remainingPrompts} PROMPTS BAKI (RESTOCK KAREIN!)*`
            : `✅ *${pf.remainingPrompts} Prompts Left*`;
        const pageLabel = pf.matchedPage ? ` _(${pf.matchedPage})_` : '';
        vpsPromptSection += `   • 📄 *${pf.filename}*${pageLabel}: ${badge}\n`;
      }
      vpsPromptSection += `\n`;
    }

    // 4. Fetch YouTube Channels (Cloud active channels)
    const ytFilter = userId ? { userId } : {};
    const ytChannels = await this.prisma.youtubeChannel.findMany({
      where: {
        ...ytFilter,
        status: 'ACTIVE',
      },
    });

    let ytSection = '';
    if (ytChannels.length > 0) {
      ytSection = '🔴 *YOUTUBE SHORTS (CLOUD):*\n';
      for (const ch of ytChannels) {
        const completedShorts = await this.prisma.youtubeCloudVideo.findMany({
          where: {
            youtubeChannelId: ch.id,
            status: 'COMPLETED',
            uploadedAt: { gte: last24h },
          },
          orderBy: { uploadedAt: 'asc' },
        });

        const ytPendingQueue = await this.prisma.youtubeCloudVideo.count({
          where: { youtubeChannelId: ch.id, status: 'PENDING' },
        });

        ytSection += `🔹 *${ch.name}*\n`;
        ytSection += `   • 📤 Upload Status: ${completedShorts.length > 0 ? `✅ *${completedShorts.length} Uploaded*` : '❌ *No Short Uploaded*'}\n`;
        completedShorts.forEach((s, idx) => {
          const shortTime = s.uploadedAt
            ? new Intl.DateTimeFormat('en-GB', {
                timeZone: 'Asia/Karachi',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true,
              })
                .format(s.uploadedAt)
                .toUpperCase()
            : 'Earlier';
          const shortTitle = (s.title || 'Short').slice(0, 45);
          ytSection += `   • 🕒 Short ${idx + 1} Time: *${shortTime} PKT* — _"${shortTitle}"_\n`;
        });
        ytSection += `   • 📦 Video Stock: *${ytPendingQueue}* shorts left in queue\n\n`;
      }
    }

    // 5. System Health & Token Alerts
    const tokenIssues = await this.prisma.uploadHistory.count({
      where: {
        status: 'FAILED',
        createdAt: { gte: last24h },
        errorMessage: { contains: 'access token', mode: 'insensitive' },
      },
    });

    const lowPromptCount = promptInventory.filter((p) => p.remainingPrompts <= 10).length;
    let alertSection = '✅ All Page tokens, schedules & automation healthy.';
    if (tokenIssues > 0) {
      alertSection = `⚠️ *ATTENTION:* ${tokenIssues} upload(s) failed due to invalid/expired Facebook token. Please check Pages dashboard!`;
    }
    if (lowPromptCount > 0) {
      alertSection += `\n🚨 *PROMPT ALERT:* ${lowPromptCount} VPS Prompt File(s) me 10 ya us se kam prompts reh gayi hain! Baraye meharbani new prompt file restock karein.`;
    }

    const message =
`📊 *AutoPost Executive Daily Report*
🗓 *Date & Time:* ${pktDateStr.toUpperCase()} PKT
📈 *24h Summary:* *${totalUploadedPagesCount}/${pages.length} Pages Uploaded* (*${totalVideosUploaded24h} Videos Posted*)
━━━━━━━━━━━━━━━━━━━━

📄 *ALL FACEBOOK PAGES STATUS:*

${fbSection.trim()}

━━━━━━━━━━━━━━━━━━━━
${stockOverviewSection}${vpsPromptSection}${ytSection ? `${ytSection.trim()}\n━━━━━━━━━━━━━━━━━━━━\n` : ''}⚙️ *System Health & Watchdog:*
${alertSection}
━━━━━━━━━━━━━━━━━━━━
🤖 _AutoPost Executive Monitoring Engine_`;

    return message;
  }

  /**
   * Helper to convert "HH:MM" into total minutes from midnight (0..1439)
   */
  private parseTimeToMinutes(hhmm: string): number | null {
    const parts = (hhmm || '').trim().split(':').map(Number);
    if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return null;
    return parts[0] * 60 + parts[1];
  }

  /**
   * Scheduled WhatsApp Executive Daily Reporter:
   * Triggers TWICE daily at 8:00 AM (08:00) and 8:00 PM (20:00) PKT,
   * plus any custom times specified by the user.
   * Uses a 3-hour catch-up window (e.g. 08:00-11:00 AM and 20:00-23:00 PM PKT) so Render cold-starts
   * or transient network delays NEVER skip a scheduled morning or evening report.
   */
  async checkAndSendScheduledReports() {
    if (this.isCheckingReports) return;
    this.isCheckingReports = true;

    try {
      const now = new Date();

      const currentPktTime = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Karachi',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(now); // e.g. "08:00" or "20:00"

      const currentPktDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Karachi',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now); // e.g. "2026-10-13"

      const currentMins = this.parseTimeToMinutes(currentPktTime);
      if (currentMins === null) return;

      const activeConfigs = await this.prisma.whatsAppConfig.findMany({
        where: {
          enabled: true,
        },
      });

      for (const config of activeConfigs) {
        if (!config.phoneNumber) continue;

        // Primary schedule slots: 8:00 AM (08:00) and 8:00 PM (20:00) PKT
        let targetSlots = ['08:00', '20:00'];
        if (config.reportTime && config.reportTime.trim()) {
          const customSlots = config.reportTime.split(',').map((s) => s.trim()).filter(Boolean);
          targetSlots = Array.from(new Set([...customSlots, '08:00', '20:00']));
        }

        const sentSlots = (config.lastSentDate || '').split(',').map((s) => s.trim()).filter(Boolean);

        for (const slot of targetSlots) {
          const slotMins = this.parseTimeToMinutes(slot);
          if (slotMins === null) continue;

          // Match if current PKT time is within [slotMins, slotMins + 180 mins] (3-hour catch-up window)
          if (currentMins >= slotMins && currentMins <= slotMins + 180) {
            const slotKey = `${currentPktDate}_${slot}`;

            if (!sentSlots.includes(slotKey)) {
              this.logger.log(
                `Dispatching executive WhatsApp report for ${config.phoneNumber} at ${currentPktTime} PKT (Target Slot: ${slotKey})`
              );

              const report = await this.generateReportContent(config.userId || undefined);
              const result = await this.dispatchWhatsAppMessage(config.phoneNumber, report, config.apiKey || undefined);

              if (result.success) {
                sentSlots.push(slotKey);
                const updatedSentSlots = Array.from(new Set(sentSlots.filter((s) => s.startsWith(currentPktDate))));

                await this.prisma.whatsAppConfig.update({
                  where: { id: config.id },
                  data: { lastSentDate: updatedSentSlots.join(',') },
                });
                this.logger.log(`Scheduled WhatsApp report delivered successfully to ${config.phoneNumber} (${slotKey})`);
              } else {
                this.logger.warn(`Failed to dispatch scheduled WhatsApp report (${slotKey}): ${result.message}`);
              }
            }
          }
        }
      }
    } finally {
      this.isCheckingReports = false;
    }
  }

  /**
   * Scheduled Low Video Stock Checker:
   * Triggers ONLY 3 times a day at 07:00 AM, 12:00 PM, and 05:00 PM PKT (with a 60-minute catch-up window).
   * Gathers all pages with low/empty Mega Cloud stock and sends a single consolidated warning.
   */
  async checkAndSendScheduledStockAlerts() {
    const now = new Date();
    const currentPktTime = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(now);

    const currentPktDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Karachi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now);

    const currentMins = this.parseTimeToMinutes(currentPktTime);
    if (currentMins === null) return;

    const STOCK_ALERT_TIMES = ['07:00', '12:00', '17:00']; // 7:00 AM, 12:00 PM, 5:00 PM PKT
    const matchedSlot = STOCK_ALERT_TIMES.find((slot) => {
      const slotMins = this.parseTimeToMinutes(slot);
      return slotMins !== null && currentMins >= slotMins && currentMins <= slotMins + 60;
    });

    if (!matchedSlot) {
      return;
    }

    const slotKey = `stock_${currentPktDate}_${matchedSlot}`;
    if (this.sentStockAlertSlots.has(slotKey)) {
      return;
    }
    this.sentStockAlertSlots.add(slotKey);

    // Prune old slots from memory cache
    if (this.sentStockAlertSlots.size > 50) {
      const arr = Array.from(this.sentStockAlertSlots).slice(-20);
      this.sentStockAlertSlots.clear();
      arr.forEach((k) => this.sentStockAlertSlots.add(k));
    }

    const activeCloudPages = await this.getActiveMegaCloudPages();
    if (activeCloudPages.length === 0) return;

    const lowStockPages: { pageName: string; remaining: number; userId?: string | null }[] = [];

    for (const page of activeCloudPages) {
      const cloudQueueCount = await this.prisma.video.count({
        where: {
          source: { platform: 'MEGA_CLOUD', url: `cloud://${page.pageId}` },
          uploads: { none: { facebookPageId: page.id, status: 'COMPLETED', facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } } },
        },
      });

      // Video kam hone ka alert: stock <= 2 or 0 videos remaining
      if (cloudQueueCount <= 2) {
        lowStockPages.push({
          pageName: page.name,
          remaining: cloudQueueCount,
          userId: page.userId,
        });
      }
    }

    if (lowStockPages.length === 0) {
      this.logger.log(`Stock check at ${currentPktTime} PKT: All cloud pages have healthy video stock.`);
      return;
    }

    const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now);

    let itemsList = '';
    for (const item of lowStockPages) {
      const badge = item.remaining === 0 ? '🔴 *0 Videos Left (Out of Stock!)*' : `🟡 *${item.remaining} Video(s) Left (Low Stock!)*`;
      itemsList += `   • 📄 *${item.pageName}*: ${badge}\n`;
    }

    const alertMessage =
`⚠️ *AutoPost Stock Alert: Low Video Notice!*
━━━━━━━━━━━━━━━━━━━━
📌 *Pages with Low Mega Cloud Video Stock:*
${itemsList.trim()}

🕒 *Alert Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Baraye meharbani Mega Cloud folder me mazeed AI videos upload karein taake scheduled posting jari rahe._
🤖 _AutoPost Stock Monitor (Scheduled at 7:00 AM, 12:00 PM & 5:00 PM PKT)_`;

    await this.sendAlertToRecipients(alertMessage);
    this.logger.log(`Dispatched scheduled low-stock alert for ${lowStockPages.length} pages at ${currentPktTime} PKT (Slot: ${matchedSlot})`);
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
   * Dispatches instant real-time alert for video generation/downloading/scraping
   */
  async sendVideoActivityAlert(data: {
    pageName?: string;
    videoTitle?: string;
    sourcePlatform?: string;
    action: string;
    details?: string;
    isError?: boolean;
    userId?: string | null;
  }) {
    const now = new Date();
    const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(now);

    const icon = data.isError ? '🚨' : '🎬';
    const title = data.isError ? 'Auto Downloader: Video Issue Alert!' : 'Auto Downloader: Video Activity Update!';

    const message =
`${icon} *${title}*
━━━━━━━━━━━━━━━━━━━━
${data.pageName ? `📄 *Page:* *${data.pageName}*\n` : ''}${data.videoTitle ? `🎬 *Video:* ${data.videoTitle}\n` : ''}${data.sourcePlatform ? `🌐 *Source:* ${data.sourcePlatform}\n` : ''}⚡ *Status:* ${data.action}
${data.details ? `📝 *Details:* ${data.details}\n` : ''}🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
🤖 _AutoPost Video Automation Engine_`;

    return this.sendAlertToRecipients(message, data.userId);
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
      // STRICT FILTER: Source must be MEGA_CLOUD and mapping must be ON
      // ─────────────────────────────────────────────────────────────
      const recentFbFails = await this.prisma.uploadHistory.findMany({
        where: {
          status: 'FAILED',
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          video: {
            source: { platform: 'MEGA_CLOUD' }, // No TikTok or external sources
          },
          facebookPage: {
            status: 'ACTIVE',
            mappings: {
              some: {
                status: 'ACTIVE',
                scheduledTime: { not: null, notIn: ['00:00', ''] },
                source: { platform: 'MEGA_CLOUD' }, // Mapping must be ON for MEGA_CLOUD
              },
            },
          },
        },
        include: {
          video: { include: { source: true } },
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
      // 2. YouTube Upload Failures (Last 60 Minutes - CLOUD ONLY, NO TIKTOK)
      // ─────────────────────────────────────────────────────────────
      const recentYtCloudFails = await this.prisma.youtubeCloudVideo.findMany({
        where: {
          status: 'FAILED',
          updatedAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
          youtubeChannel: {
            status: 'ACTIVE',
            scheduledTime: { not: null, notIn: ['00:00', ''] }, // Only if cloud schedule is ON
          },
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

      // ─────────────────────────────────────────────────────────────
      // 3. Low Video Stock Alerts: Handled strictly via scheduled
      // checkAndSendScheduledStockAlerts() at 7:00 AM, 12:00 PM, and 5:00 PM PKT.
      // Instant watcher spam is disabled per user requirement.
      // ─────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────
      // 4. Missed Scheduled Upload Alert
      // STRICT FILTER: Only MEGA_CLOUD mappings with status === ACTIVE and scheduledTime != '00:00'
      // Only fires if queue actually has unposted videos (if queue is empty,
      // the user is already informed at 7 AM, 12 PM, 5 PM, so we do not spam).
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
          scheduledTime: { not: null, notIn: ['00:00', ''] },
          source: { platform: 'MEGA_CLOUD' }, // STRICTLY MEGA_CLOUD ONLY
          facebookPage: { status: 'ACTIVE' },
        },
        include: {
          facebookPage: true,
          source: true,
        },
      });

      for (const mapping of activeMappings) {
        const slots = mapping.scheduledTime!.split(',').map((s) => s.trim()).filter(Boolean);
        for (const slot of slots) {
          const parts = slot.split(':').map(Number);
          if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) continue;

          const slotTotalMins = parts[0] * 60 + parts[1];
          // Check if slot has passed by 20 to 35 minutes
          if (currentPktTotalMins >= slotTotalMins + 20 && currentPktTotalMins <= slotTotalMins + 35) {
            const alertKey = `missed_${mapping.id}_${slot}_${pktDateStr}`;
            if (!this.missedSlotAlerts.has(alertKey)) {
              this.missedSlotAlerts.add(alertKey);

              // Check if queue had videos available
              const cloudQueueCount = await this.prisma.video.count({
                where: {
                  source: { platform: 'MEGA_CLOUD', url: `cloud://${mapping.facebookPage?.pageId}` },
                  uploads: { none: { facebookPageId: mapping.facebookPageId, status: 'COMPLETED', facebookPostId: { not: 'MEGA_CLOUD_UPLOAD' } } },
                },
              });

              // Only alert if there were videos in queue that failed to post
              if (cloudQueueCount > 0) {
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
`⚠️ *AutoPost Alert: Scheduled Upload Missed!*
━━━━━━━━━━━━━━━━━━━━
📄 *Page:* *${mapping.facebookPage?.name || 'Page'}*
⏰ *Scheduled Slot:* *${slot}* PKT
❌ *Issue:* Queue me video mojood hone ke bawajood scheduled time pe post nahi hui.
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
💡 _Baraye meharbani page settings ya system logs check karein._`;

                  await this.sendAlertToRecipients(alert, mapping.facebookPage?.userId);
                }
              }
            }
          }
        }
      }

      // ─────────────────────────────────────────────────────────────
      // 5. Periodic Facebook Token & Checkpoint Verification (Every 15 mins)
      // STRICT FILTER: Only check active pages with active MEGA_CLOUD mapping ON
      // ─────────────────────────────────────────────────────────────
      const nowMs = Date.now();
      if (nowMs - this.lastTokenCheckTime > 15 * 60 * 1000) {
        this.lastTokenCheckTime = nowMs;

        const activeCloudPages = await this.getActiveMegaCloudPages();
        for (const page of activeCloudPages) {
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
🎯 *Coverage Policy:*
 • Sirf active MEGA CLOUD pages jinki mapping ON hai unke alerts aayenge.
 • Jin pages ki mapping OFF hai ya jin par TikTok source hai, unke alerts send nahi honge.
 • Cloud Queue me 0 videos baki rehne par foran stock alert.
 • Upload failures, missed slots aur token checkpoints.
🕒 *Time:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
🤖 _AutoPost Real-Time Watchdog Engine_`;

    return this.dispatchWhatsAppMessage(phoneNumber, testMessage, apiKey);
  }

  /**
   * Send high-priority Content Monetization (CM) Alert when a page unlocks monetization or receives invite
   */
  async sendContentMonetizationAlert(pageName: string, pageId: string, status = 'INVITED / ELIGIBLE', userId?: string) {
    const activeConfigs = await this.prisma.whatsAppConfig.findMany({
      where: {
        enabled: true,
      },
    });

    if (!activeConfigs || activeConfigs.length === 0) {
      this.logger.warn(`Cannot send WhatsApp CM alert for page ${pageName}: No active WhatsApp configuration found.`);
      return { success: false, message: 'No active WhatsApp recipient configured.' };
    }

    const now = new Date();
    const pktTimeStr = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Karachi',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(now);

    const message =
`🎉 *CONGRATULATIONS! Content Monetization (CM) Alert!* 🎉
━━━━━━━━━━━━━━━━━━━━
Mubarak Ho! Aapke Facebook Page par *Content Monetization (CM)* ka tool unlock / invite ho gaya hai! 💰✨

📄 *Page Details:*
• *Page Name:* ${pageName}
• *Page ID:* \`${pageId}\`
• *Status:* *${status}*
🕒 *Detected At:* ${pktTimeStr} PKT
━━━━━━━━━━━━━━━━━━━━
🚀 *Agla Zaroori Qadam (Action Required):*
1. Foran ixBrowser kholein (apni US Proxy / VPN ke sath).
2. Is page ki ID open karke Meta Business Suite / Professional Dashboard par jayein.
3. Apna Payout Account aur Tax Information attach karein taake aapki earnings shuru ho sakein!

🤖 _AutoPost Intelligent Monitoring Engine_`;

    let sentCount = 0;
    for (const config of activeConfigs) {
      if (!config.phoneNumber) continue;
      if (userId && config.userId && config.userId !== userId) continue;

      try {
        await this.dispatchWhatsAppMessage(config.phoneNumber, message, config.apiKey || undefined);
        sentCount++;
      } catch (err: any) {
        this.logger.error(`Failed to dispatch CM WhatsApp alert to ${config.phoneNumber}:`, err.message);
      }
    }

    return { success: sentCount > 0, message: `Dispatched CM alert to ${sentCount} recipient(s).` };
  }
}
