import { chromium, Page } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

process.env.PLAYWRIGHT_BROWSERS_PATH = '0';

export interface TikTokVideoMetadata {
  id: string;
  caption: string;
  hashtags: string[];
  playUrl: string;
  downloadUrl: string;
  author: string;
  createTime: number;
  url: string;
}

/**
 * Extracts the newest video metadata from a public TikTok profile or single video URL
 * using Playwright local headless interception with resource abort optimization.
 */
export async function getLatestTikTokVideo(inputUrl: string): Promise<TikTokVideoMetadata> {
  const cleanUrl = inputUrl.split('?')[0].replace(/\/$/, '').trim();

  // Extract username from URL
  const usernameMatch = cleanUrl.match(/@([\w.-]+)/);
  const username = usernameMatch ? usernameMatch[1] : cleanUrl.split('/').filter(Boolean).pop()?.replace(/^@/, '') || 'user';
  const isVideoUrl = cleanUrl.includes('/video/') || cleanUrl.includes('/v/');
  const targetUrl = isVideoUrl ? cleanUrl : `https://www.tiktok.com/@${username}`;

  // Launch headless chromium with anti-detection flags
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
    ],
  });

  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'en-US',
  });

  const page: Page = await context.newPage();
  let apiCapturedVideoData: any = null;

  // Listen for background XHR responses targeting item_list or single item detail
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/post/item_list/') || url.includes('/api/item/detail/')) {
      try {
        const json = await response.json();
        if (json?.itemList && json.itemList.length > 0) {
          apiCapturedVideoData = json.itemList[0];
        } else if (json?.itemInfo?.itemStruct) {
          apiCapturedVideoData = json.itemInfo.itemStruct;
        }
      } catch {
        // Ignore non-JSON or interrupted frames
      }
    }
  });

  // Block useless assets (images, styles, media, fonts) to speed up performance to ~1-2 seconds
  await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,css,woff,woff2}', (route) => route.abort());

  try {
    // Navigate to target URL
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });

    // Wait briefly for hydration scripts or API fetch to complete
    await page.waitForTimeout(2000);

    let rawVideoItem: any = apiCapturedVideoData;

    // Fallback: If network intercept did not fire, extract from SSR state in DOM
    if (!rawVideoItem) {
      const ssrDataRaw = await page.evaluate(() => {
        const scriptEl = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__') || document.getElementById('SIGI_STATE');
        return scriptEl ? scriptEl.textContent : null;
      });

      if (ssrDataRaw) {
        try {
          const parsedSSR = JSON.parse(ssrDataRaw);
          const defaultScope = parsedSSR['__DEFAULT_SCOPE__'] || parsedSSR || {};
          const userDetail = defaultScope['webapp.user-detail'] || {};

          if (userDetail?.statusCode === 209002 && !isVideoUrl) {
            console.warn('TikTok challenge triggered (209002) in SSR state.');
          }

          // Try reading itemModule or userDetail item lists
          const itemModule = defaultScope['itemModule'] || parsedSSR['ItemModule'] || {};
          const itemIds = userDetail?.itemList || [];

          if (itemIds.length > 0 && itemModule[itemIds[0]]) {
            rawVideoItem = itemModule[itemIds[0]];
          } else {
            // Search dynamically inside itemModule
            const keys = Object.keys(itemModule);
            if (keys.length > 0) {
              rawVideoItem = itemModule[keys[0]];
            }
          }
        } catch (err: any) {
          console.warn(`Failed to parse SSR json in Playwright: ${err.message}`);
        }
      }
    }

    if (!rawVideoItem && !isVideoUrl) {
      throw new Error(`No public videos found for user @${username} via Playwright interception`);
    }

    // If still no rawVideoItem for a single video page, construct basic details from page title
    if (!rawVideoItem && isVideoUrl) {
      const vidMatch = cleanUrl.match(/(?:video|v)\/(\d{18,20})/);
      const fallbackId = vidMatch ? vidMatch[1] : 'video_' + Date.now();
      const pageTitle = await page.title();
      return {
        id: fallbackId,
        caption: pageTitle.replace(/ \| TikTok$/i, '').trim(),
        hashtags: [],
        playUrl: '',
        downloadUrl: '',
        author: username,
        createTime: Math.floor(Date.now() / 1000),
        url: cleanUrl
      };
    }

    // Parse caption and hashtags
    const fullCaption: string = rawVideoItem?.desc || '';
    const hashtagRegex = /#[\w\u0590-\u05ff]+/g;
    const extractedHashtags = fullCaption.match(hashtagRegex) || [];

    // Direct MP4 Play & Download URLs
    const playUrl =
      rawVideoItem?.video?.playAddr ||
      rawVideoItem?.video?.downloadAddr ||
      '';

    const videoId = String(rawVideoItem?.id || Date.now());
    const videoWebUrl = `https://www.tiktok.com/@${username}/video/${videoId}`;

    return {
      id: videoId,
      caption: fullCaption || `TikTok Video ${videoId}`,
      hashtags: extractedHashtags,
      playUrl: playUrl,
      downloadUrl: rawVideoItem?.video?.downloadAddr || playUrl,
      author: username,
      createTime: rawVideoItem?.createTime || Math.floor(Date.now() / 1000),
      url: videoWebUrl
    };
  } finally {
    await browser.close().catch(() => null);
  }
}

/**
 * Downloads the high-res MP4 directly from TikTok CDN.
 * IMPORTANT: Must send Referer and User-Agent headers to avoid HTTP 403 Forbidden.
 */
export async function downloadTikTokVideo(
  videoUrl: string,
  outputPath: string
): Promise<string> {
  const response = await axios({
    method: 'GET',
    url: videoUrl,
    responseType: 'stream',
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
    },
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outputPath));
    writer.on('error', (err) => {
      writer.close();
      reject(err);
    });
  });
}
