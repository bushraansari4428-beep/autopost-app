import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';
import * as fs from 'fs';

chromium.use(stealth());

export interface XiaohongshuMetadata {
  id: string;
  title: string;
  description: string;
  url: string;
  mp4Url: string;
  timestamp: number;
}

export async function extractXiaohongshuVideo(shareUrl: string): Promise<XiaohongshuMetadata | null> {
  console.log(`[XHS Playwright Scraper] Launching browser for: ${shareUrl}`);
  
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    });
    
    // Set cookie if provided to bypass login screens
    if (process.env.XHS_COOKIE) {
      const cookies = process.env.XHS_COOKIE.split(';').map(c => {
        const [name, ...rest] = c.split('=');
        return {
          name: name.trim(),
          value: rest.join('=').trim(),
          domain: '.xiaohongshu.com',
          path: '/'
        };
      });
      await page.context().addCookies(cookies);
    }

    let mp4Url = '';
    
    // Listen for network requests to intercept the raw video stream
    page.on('response', async (response) => {
      const url = response.url();
      if ((url.includes('sns-video') || url.includes('.mp4') || url.includes('/stream/')) && url.startsWith('http')) {
        const contentType = response.headers()['content-type'] || '';
        if (contentType.includes('video/') || url.includes('.mp4')) {
          mp4Url = url;
          console.log(`[XHS Playwright Scraper] Intercepted video stream: ${mp4Url}`);
        }
      }
    });

    await page.goto(shareUrl, { waitUntil: 'networkidle', timeout: 30000 });
    
    // Give it a couple seconds to trigger the video request
    await page.waitForTimeout(3000);
    
    const finalUrl = page.url();
    const isProfile = finalUrl.includes('/user/profile/');
    
    if (isProfile) {
      console.log(`[XHS Playwright Scraper] Profile detected. Finding latest video...`);
      // Find the first video note
      const videoNotes = await page.$$('a.cover[href*="/explore/"]');
      if (videoNotes.length > 0) {
        // Click the first video note
        await videoNotes[0].click();
        await page.waitForTimeout(3000);
        // Wait for video request to be intercepted
        if (!mp4Url) {
            await page.waitForTimeout(3000);
        }
      } else {
        console.warn(`[XHS Playwright Scraper] No videos found on profile.`);
        return null;
      }
    }

    // Try to extract title
    let title = await page.title();
    
    // If network interception failed, try DOM extraction
    if (!mp4Url) {
       console.log(`[XHS Playwright Scraper] Network interception missed. Checking DOM...`);
       const videoElement = await page.$('video');
       if (videoElement) {
         mp4Url = await videoElement.getAttribute('src') || '';
         if (mp4Url && mp4Url.startsWith('blob:')) {
            console.log(`[XHS Playwright Scraper] Blob URL found. Needs state extraction.`);
            mp4Url = ''; // Blob URL is useless, reset.
         }
       }
       
       if (!mp4Url) {
         // Extract from __INITIAL_STATE__
         const content = await page.content();
         const stateMatch = content.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s);
         if (stateMatch && stateMatch[1]) {
            try {
              const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
              const noteMap = state?.note?.noteDetailMap ?? {};
              const firstNoteKey = Object.keys(noteMap)[0];
              const noteObj = noteMap[firstNoteKey]?.note ?? {};
              
              if (noteObj.title) title = noteObj.title;
              
              const h264Url = noteObj.video?.media?.stream?.h264?.[0]?.masterUrl;
              const originKey = noteObj.video?.consumer?.originVideoKey;
              
              if (h264Url) mp4Url = h264Url;
              else if (originKey) mp4Url = `https://sns-video-bd.xhscdn.com/${originKey.replace(/^\//, '')}`;
            } catch (e) {}
         }
       }
    }
    
    if (!mp4Url) return null;
    
    // Normalize URL
    if (mp4Url.startsWith('http:') && !mp4Url.startsWith('http://')) {
        mp4Url = mp4Url.replace('http:', 'http://');
    }
    if (mp4Url.startsWith('https:') && !mp4Url.startsWith('https://')) {
        mp4Url = mp4Url.replace('https:', 'https://');
    }
    
    return {
      id: 'xhs_' + Date.now(),
      title: title || 'RedNote Video',
      description: title || 'RedNote Video',
      url: finalUrl,
      mp4Url: mp4Url,
      timestamp: Math.floor(Date.now() / 1000)
    };
    
  } catch (error) {
    console.error(`[XHS Playwright Scraper] Error: ${error.message}`);
    return null;
  } finally {
    await browser.close();
  }
}

export async function downloadXiaohongshuVideo(videoUrl: string, outputPath: string, pageUrl?: string): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      extraHTTPHeaders: {
          'Referer': 'https://www.xiaohongshu.com/',
          'Accept': '*/*'
      }
    });
    
    // We navigate to the actual video stream URL and download it as buffer
    const response = await page.goto(videoUrl, { waitUntil: 'load' });
    if (response) {
      const buffer = await response.body();
      fs.writeFileSync(outputPath, buffer);
      return outputPath;
    }
    throw new Error("Failed to download response body");
  } catch (e) {
    console.error(`[XHS Download] Error: ${e.message}`);
    throw e;
  } finally {
    await browser.close();
  }
}
