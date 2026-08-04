import { chromium, Page } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';

export interface XiaohongshuMetadata {
  id: string;
  title: string;
  description: string;
  url: string;
  mp4Url: string;
  timestamp: number;
}

/**
 * Resolves short share URLs (e.g., xhslink.com) to obtain the full URL containing xsec_token
 */
export async function resolveXhsUrl(rawUrl: string): Promise<string> {
  if (!rawUrl.includes('xhslink.com') && !rawUrl.includes('t.cn') && !rawUrl.includes('url.cn')) {
    return rawUrl;
  }

  try {
    const response = await fetch(rawUrl, {
      method: 'HEAD',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    return response.url;
  } catch (e) {
    return rawUrl;
  }
}

/**
 * Extracts raw unwatermarked MP4 URL from a Xiaohongshu post
 */
export async function extractXiaohongshuVideo(shareUrl: string): Promise<XiaohongshuMetadata | null> {
  const fullUrl = await resolveXhsUrl(shareUrl);
  console.log(`Extracting Xiaohongshu (RedNote) video for resolved URL: ${fullUrl}`);

  // Determine Note ID for fallback metadata
  const noteMatch = fullUrl.match(/(?:explore|discovery\/item|item|note|profile)\/([a-zA-Z0-9_-]+)/i) || fullUrl.match(/([a-zA-Z0-9]{24,32})/);
  const noteId = noteMatch ? noteMatch[1] : 'xhs_' + Date.now();

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 },
    locale: 'zh-CN',
  });

  const page = await context.newPage();

  let extractedTitle = `RedNote Video ${noteId}`;
  let extractedMp4: string | undefined = undefined;

  try {
    // 1. Block client-side login redirect scripts and tracking
    await page.route('**/*', (route) => {
      const request = route.request();
      const url = request.url();

      // Cancel requests forcing redirect or captcha walls or unnecessary assets to speed up load
      if (url.includes('/login') || url.includes('captcha') || url.includes('analytics') || url.match(/\.(png|jpg|jpeg|gif|webp|svg|woff|woff2|css)$/)) {
        return route.abort();
      }
      return route.continue();
    });

    // 2. Intercept API responses containing note metadata
    page.on('response', async (response) => {
      const url = response.url();

      if (url.includes('/api/sns/web/v1/feed') || url.includes('/api/sns/web/v1/note') || url.includes('/api/sns/web/v1/user/otherinfo')) {
        try {
          const json = await response.json();
          const noteData = json?.data?.items?.[0]?.note_card || json?.data?.note_list?.[0] || json?.data?.items?.[0] || json?.items?.[0];

          if (noteData) {
             if (noteData.title || noteData.desc) {
               extractedTitle = `${noteData.title || ''} ${noteData.desc || ''}`.trim();
             }
             if (noteData.video) {
               const mediaStream = noteData.video.media?.stream?.h264?.[0] || noteData.video.media?.stream?.h265?.[0] || noteData.video.media?.stream?.av1?.[0];
               const directMp4Url = mediaStream?.master_url || mediaStream?.masterUrl || noteData.video.url || noteData.video.originVideoKey;
               if (directMp4Url && !extractedMp4) {
                 extractedMp4 = directMp4Url.replace(/^http:/, 'https:');
               }
             }
          }
        } catch {
          // Ignore non-JSON errors
        }
      }
    });

    // 3. Navigate with generous timeout
    await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null);

    // Fallback: Check window.__INITIAL_STATE__ if API interception didn't trigger
    if (!extractedMp4) {
      await page.waitForTimeout(2000); // Allow inline state to render

      const initialState = await page.evaluate(() => {
        const w = window as any;
        const st = w.__INITIAL_STATE__ || w.__INITIAL_SSR_STATE__;
        let mp4 = null;
        let title = document.title;
        let isProfile = window.location.href.includes('/user/profile/');
        let profileNoteId = null;

        if (st) {
          if (isProfile) {
            const notes = st?.user?.notes?.[0] || st?.user?.notes || [];
            if (notes.length > 0) {
              profileNoteId = notes[0].id || notes[0].noteId;
            }
          } else {
            const noteDetail = st?.note?.noteDetailMap ?? st?.noteData;
            if (noteDetail) {
              const firstKey = Object.keys(noteDetail)[0];
              const note = noteDetail[firstKey]?.note ?? noteDetail[firstKey];
              if (note?.title || note?.desc) title = `${note?.title || ''} ${note?.desc || ''}`.trim();
              const videoInfo = note?.video;

              if (videoInfo) {
                const streamUrl = videoInfo.media?.stream?.h264?.[0]?.master_url ||
                                  videoInfo.media?.stream?.h264?.[0]?.masterUrl ||
                                  videoInfo.media?.stream?.h265?.[0]?.master_url ||
                                  videoInfo.media?.stream?.av1?.[0]?.masterUrl ||
                                  videoInfo.url || videoInfo.originVideoKey;
                if (streamUrl) {
                  mp4 = streamUrl.replace(/^http:/, 'https:');
                }
              }
            }
          }
        }
        return { mp4, title, profileNoteId };
      }).catch(() => null);

      if (initialState) {
        if (initialState.title) extractedTitle = initialState.title.replace(/ - 小红书$| \| RedNote$/i, '').trim();
        
        // Handle profile recursive fetch
        if (initialState.profileNoteId) {
          console.log(`Profile latest note found: ${initialState.profileNoteId}, recursively fetching...`);
          await browser.close().catch(() => null);
          return await extractXiaohongshuVideo(`https://www.xiaohongshu.com/explore/${initialState.profileNoteId}`);
        }

        if (initialState.mp4) {
          extractedMp4 = initialState.mp4;
        }
      }
    }

    if (!extractedMp4) {
      console.warn(`Failed to locate MP4 stream for RedNote: ${fullUrl}`);
      return null;
    }

    // Cleanup URL
    extractedMp4 = extractedMp4.replace(/\\\//g, '/').replace(/\\u0026/g, '&');

    // Fix malformed protocols missing slashes (e.g., https:sns-video...)
    if (extractedMp4.startsWith('http:') && !extractedMp4.startsWith('http://')) {
      extractedMp4 = extractedMp4.replace('http:', 'http://');
    }
    if (extractedMp4.startsWith('https:') && !extractedMp4.startsWith('https://')) {
      extractedMp4 = extractedMp4.replace('https:', 'https://');
    }
    if (extractedMp4.startsWith('//')) {
      extractedMp4 = `https:${extractedMp4}`;
    } else if (!extractedMp4.startsWith('http')) {
      extractedMp4 = `https://sns-video-bd.xhscdn.com/${extractedMp4.replace(/^\//, '')}`;
    }

    return {
      id: noteId,
      title: extractedTitle || `RedNote Video ${noteId}`,
      description: extractedTitle || `RedNote Video ${noteId}`,
      url: fullUrl,
      mp4Url: extractedMp4,
      timestamp: Math.floor(Date.now() / 1000)
    };

  } finally {
    await browser.close().catch(() => null);
  }
}

/**
 * Downloads RedNote/Xiaohongshu MP4 locally with anti-403 CDN headers.
 */
export async function downloadXiaohongshuVideo(videoUrl: string, outputPath: string): Promise<string> {
  const response = await axios({
    method: 'GET',
    url: videoUrl,
    responseType: 'stream',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.xiaohongshu.com/',
      'Accept': '*/*'
    }
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
