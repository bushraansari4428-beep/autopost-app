import { chromium, Page } from 'playwright';
import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

export interface XiaohongshuMetadata {
  id: string;
  title: string;
  description: string;
  url: string;
  mp4Url: string;
  timestamp: number;
}

/**
 * Resolves xhslink or short links to the complete note or profile URL.
 */
export async function resolveXhsUrl(inputUrl: string): Promise<string> {
  let cleanUrl = inputUrl.split('?')[0].trim();
  if (inputUrl.includes('xhslink.com') || inputUrl.includes('t.cn') || inputUrl.includes('url.cn') || inputUrl.includes('rednote')) {
    try {
      const res = await fetch(inputUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Chrome/124.0.0.0 Mobile Safari/604.1'
        }
      }).catch(() => null);
      if (res && res.url) {
        return res.url;
      }
    } catch (e) {
      // fallback to original
    }
  }
  return inputUrl;
}

/**
 * Extracts RedNote / Xiaohongshu video post metadata and direct MP4 URL
 * without using third-party APIs. Utilizes SSR State parsing + Playwright Interception.
 */
export async function extractXiaohongshuVideo(rawUrl: string): Promise<XiaohongshuMetadata | null> {
  const targetUrl = await resolveXhsUrl(rawUrl);
  console.log(`Extracting Xiaohongshu (RedNote) video for resolved URL: ${targetUrl}`);

  // Determine Note ID
  const noteMatch = targetUrl.match(/(?:explore|discovery\/item|item|note|profile)\/([a-zA-Z0-9_-]+)/i) || targetUrl.match(/([a-zA-Z0-9]{24,32})/);
  const noteId = noteMatch ? noteMatch[1] : 'xhs_' + Date.now();

  let extractedTitle = `RedNote Video ${noteId}`;
  let extractedMp4: string | undefined = undefined;
  let isProfile = targetUrl.includes('/user/profile/');

  // LAYER 1: Fast Direct HTTP SSR extraction
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': 'https://www.xiaohongshu.com/'
    };
    const res = await fetch(targetUrl, { headers }).catch(() => null);
    if (res && res.ok) {
      const html = await res.text();

      // Extract title from DOM or initial state
      const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/i) || html.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (titleMatch && titleMatch[1]) {
        extractedTitle = titleMatch[1].replace(/ - 小红书$| \| RedNote$/i, '').trim();
      }

      // Check for __INITIAL_STATE__
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
      if (stateMatch && stateMatch[1]) {
        try {
          const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
          // If profile, find latest note ID and redirect extraction to that note
          if (isProfile) {
            const notes = state?.user?.notes ?? state?.user?.noteList ?? state?.user?.profile?.notes ?? [];
            if (notes && notes.length > 0) {
              const latestNoteId = notes[0].noteId ?? notes[0].id;
              if (latestNoteId) {
                const newNoteUrl = `https://www.xiaohongshu.com/explore/${latestNoteId}`;
                console.log(`Discovered latest note (${latestNoteId}) from RedNote profile. Recursively extracting note...`);
                return await extractXiaohongshuVideo(newNoteUrl);
              }
            }
          }

          // Search inside note detail map for video stream
          const noteMap = state?.note?.noteDetailMap ?? state?.noteData ?? {};
          const firstNoteKey = Object.keys(noteMap)[0] || noteId;
          const noteObj = noteMap[firstNoteKey]?.note ?? noteMap[firstNoteKey] ?? {};

          if (noteObj.title) extractedTitle = noteObj.title;
          if (noteObj.desc && noteObj.desc.trim()) {
            extractedTitle = `${noteObj.title || ''} ${noteObj.desc}`.trim();
          }

          // Locate video stream URL in JSON
          const videoObj = noteObj.video?.media?.stream?.h264?.[0] ?? noteObj.video?.media?.stream?.av1?.[0] ?? noteObj.video;
          if (videoObj?.masterUrl || videoObj?.url || videoObj?.originVideoKey) {
            extractedMp4 = videoObj.masterUrl || videoObj.url || videoObj.originVideoKey;
          }
        } catch (e) {
          console.warn(`Error parsing XHS initial state JSON:`, e);
        }
      }

      // Regex fallback if state parsing didn't find mp4
      if (!extractedMp4 && !isProfile) {
        const urlMatch = html.match(/"(?:masterUrl|originVideoKey|urlDefault|backupUrl|url)"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*(?:sns-video-[^"\\]*|\.mp4[^"\\]*))"/i) ||
                         html.match(/(https?:\/\/[^"'\s\\]*sns-video-[^"'\s\\]*)/i) ||
                         html.match(/(https?:\/\/[^"'\s\\]*\.mp4[^"'\s\\]*)/i);
        if (urlMatch && urlMatch[1]) {
          extractedMp4 = urlMatch[1];
        }
      }
    }
  } catch (err: any) {
    console.warn(`Direct HTTP extraction for RedNote failed: ${err.message}`);
  }

  // Cleanup escaped slashes in URL
  if (extractedMp4) {
    extractedMp4 = extractedMp4.replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    if (!extractedMp4.startsWith('http')) {
      extractedMp4 = `https://sns-video-bd.xhscdn.com/${extractedMp4.replace(/^\//, '')}`;
    }
    return {
      id: noteId,
      title: extractedTitle || `RedNote Video ${noteId}`,
      description: extractedTitle || `RedNote Video ${noteId}`,
      url: targetUrl,
      mp4Url: extractedMp4,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  // LAYER 2: Local Playwright Interception if HTTP SSR failed or was gated
  if (!isProfile || !extractedMp4) {
    console.log(`Attempting Playwright headless interception for Xiaohongshu/RedNote: ${targetUrl}`);
    const browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled']
    }).catch(() => null);

    if (browser) {
      try {
        const context = await browser.newContext({
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          viewport: { width: 1280, height: 720 }
        });
        const page: Page = await context.newPage();

        // Listen for media streaming URLs or API responses
        page.on('response', async (res) => {
          const url = res.url();
          if (url.includes('sns-video-') || url.includes('.mp4') || url.includes('/video/')) {
            if (!extractedMp4 && url.startsWith('http') && !url.includes('jpg') && !url.includes('webp')) {
              extractedMp4 = url;
            }
          } else if (url.includes('/api/sns/web/v1/feed') || url.includes('/api/sns/web/v1/user/otherinfo')) {
            try {
              const data = await res.json();
              const items = data.items || data.data?.items || [];
              if (items.length > 0) {
                const item = items[0];
                if (item.title || item.desc) extractedTitle = `${item.title || ''} ${item.desc || ''}`.trim();
                const vid = item.video?.media?.stream?.h264?.[0]?.masterUrl || item.video?.masterUrl;
                if (vid) extractedMp4 = vid;
              }
            } catch (_) {}
          }
        });

        // Abort non-video media to accelerate load time
        await page.route('**/*.{png,jpg,jpeg,gif,webp,svg,woff,woff2,css}', (route) => route.abort());
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 25000 }).catch(() => null);
        await page.waitForTimeout(2500);

        // Check DOM state if response intercept didn't catch it
        if (!extractedMp4) {
          const pageData = await page.evaluate(() => {
            const w: any = window as any;
            const st = w.__INITIAL_STATE__ || w.__INITIAL_SSR_STATE__;
            const tit = document.title;
            return { st, tit };
          }).catch(() => null);

          if (pageData) {
            if (pageData.tit) extractedTitle = pageData.tit.replace(/ - 小红书$| \| RedNote$/i, '').trim();
            const state = pageData.st;
            if (state) {
              const noteMap = state?.note?.noteDetailMap ?? state?.noteData ?? {};
              const firstKey = Object.keys(noteMap)[0];
              const noteObj = noteMap[firstKey]?.note ?? noteMap[firstKey] ?? {};
              if (noteObj.title || noteObj.desc) extractedTitle = `${noteObj.title || ''} ${noteObj.desc || ''}`.trim();
              const videoObj = noteObj.video?.media?.stream?.h264?.[0] ?? noteObj.video?.media?.stream?.av1?.[0] ?? noteObj.video;
              if (videoObj?.masterUrl || videoObj?.url || videoObj?.originVideoKey) {
                extractedMp4 = videoObj.masterUrl || videoObj.url || videoObj.originVideoKey;
              }
            }
          }
        }
      } catch (pwErr) {
        console.warn(`Playwright RedNote exception:`, pwErr);
      } finally {
        await browser.close().catch(() => null);
      }
    }
  }

  if (extractedMp4) {
    extractedMp4 = extractedMp4.replace(/\\\//g, '/').replace(/\\u0026/g, '&');
    if (!extractedMp4.startsWith('http')) {
      extractedMp4 = `https://sns-video-bd.xhscdn.com/${extractedMp4.replace(/^\//, '')}`;
    }
    return {
      id: noteId,
      title: extractedTitle || `RedNote Video ${noteId}`,
      description: extractedTitle || `RedNote Video ${noteId}`,
      url: targetUrl,
      mp4Url: extractedMp4,
      timestamp: Math.floor(Date.now() / 1000)
    };
  }

  return null;
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
