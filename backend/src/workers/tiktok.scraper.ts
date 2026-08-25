import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

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

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

class TikTokSessionManager {
  private msToken: string = '';
  private ttwid: string = '';
  private deviceId: string = '';

  constructor() {
    this.deviceId = Math.floor(Math.random() * 10000000000000000000).toString(); // 19 digits
    this.msToken = this.generateRandomString(107) + '==';
  }

  private generateRandomString(length: number) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async initSession() {
    try {
      const res = await axios.head('https://www.tiktok.com/', {
        headers: { 'User-Agent': DEFAULT_USER_AGENT },
        timeout: 10000
      });
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        for (const cookie of setCookie) {
          if (cookie.includes('ttwid=')) {
            this.ttwid = cookie.split('ttwid=')[1].split(';')[0];
          }
          if (cookie.includes('msToken=')) {
            this.msToken = cookie.split('msToken=')[1].split(';')[0];
          }
        }
      }
    } catch (err) {
      // Ignore
    }
  }

  getHeaders() {
    return {
      'User-Agent': DEFAULT_USER_AGENT,
      'Cookie': `ttwid=${this.ttwid}; msToken=${this.msToken};`,
      'Referer': 'https://www.tiktok.com/',
      'Accept': 'application/json, text/plain, */*'
    };
  }

  getDeviceParams() {
    return {
      device_id: this.deviceId,
      device_platform: 'web_pc',
      browser_name: 'Mozilla',
      browser_platform: 'Win32',
      browser_version: DEFAULT_USER_AGENT,
      os: 'windows',
      screen_width: '1920',
      screen_height: '1080',
      cookie_enabled: 'true',
      msToken: this.msToken
    };
  }
}

const sessionManager = new TikTokSessionManager();

export async function getLatestTikTokVideos(inputUrl: string, limit = 50): Promise<TikTokVideoMetadata[]> {
  const cleanUrl = inputUrl.split('?')[0].replace(/\/$/, '').trim();
  const isVideoUrl = cleanUrl.includes('/video/') || cleanUrl.includes('/v/');
  
  let awemeIds: { id: string, username: string }[] = [];
  let username = 'user';

  if (isVideoUrl) {
    let awemeId = '';
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
      const oembedRes = await axios.get(oembedUrl, { headers: { 'Accept': 'application/json' }, timeout: 10000 });
      if (oembedRes.data && oembedRes.data.embed_product_id) {
        awemeId = oembedRes.data.embed_product_id;
        username = oembedRes.data.author_unique_id || username;
      }
    } catch (err) {
      const vidMatch = cleanUrl.match(/(?:video|v)\/(\d{18,20})/);
      awemeId = vidMatch ? vidMatch[1] : '';
    }
    if (awemeId) awemeIds.push({ id: awemeId, username });
  } else {
    const usernameMatch = cleanUrl.match(/@([a-zA-Z0-9_.-]+)/);
    const uname = usernameMatch ? usernameMatch[1] : '';
    if (uname) {
      try {
        const { chromium } = require('playwright-extra');
        const stealth = require('puppeteer-extra-plugin-stealth')();
        chromium.use(stealth);
        
        console.log("Attempting Playwright fallback for TikWM...");
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        
        await page.goto(`https://www.tikwm.com/api/user/posts?unique_id=${uname}&count=${limit}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        let tikwmRes: any = null;
        for (let i = 0; i < 10; i++) {
          const content = await page.evaluate(() => document.body.innerText);
          try {
            tikwmRes = JSON.parse(content);
            if (tikwmRes && tikwmRes.data) break;
          } catch (e) { await page.waitForTimeout(1000); }
        }
        await browser.close();
        
        if (tikwmRes && tikwmRes.data && tikwmRes.data.videos && tikwmRes.data.videos.length > 0) {
           return tikwmRes.data.videos.slice(0, limit).map((v: any) => ({
             id: v.video_id,
             caption: v.title,
             hashtags: [],
             playUrl: v.hdplay || v.play,
             downloadUrl: v.hdplay || v.play,
             author: v.author?.unique_id || uname,
             createTime: v.create_time,
             url: `https://www.tiktok.com/@${v.author?.unique_id || uname}/video/${v.video_id}`
           }));
        }
      } catch (err: any) {
        console.log(`Playwright TikWM API failed for ${uname}:`, err.message);
      }
      
      try {
        console.log("Attempting Playwright fallback for TikTok HTML...");
        const { chromium } = require('playwright-extra');
        const stealth = require('puppeteer-extra-plugin-stealth')();
        chromium.use(stealth);
        
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(`https://www.tiktok.com/@${uname}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
        
        let scriptContent: string | null = null;
        for (let i = 0; i < 10; i++) {
          scriptContent = await page.evaluate(() => {
            const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
            return script ? script.textContent : null;
          });
          if (scriptContent) break;
          await page.waitForTimeout(1000);
        }
        await browser.close();
        
        if (scriptContent) {
          const data = JSON.parse(scriptContent);
          const defaultScope = data['__DEFAULT_SCOPE__'] || data || {};
          const userDetail = defaultScope['webapp.user-detail'] || {};
          const itemIds: string[] = userDetail?.itemList || [];
          if (itemIds.length > 0) {
            awemeIds = itemIds.slice(0, limit).map(id => ({ id, username: uname }));
          }
        }
      } catch (err: any) {
        console.log(`Playwright TikTok HTML failed:`, err.message);
      }
    }
  }

  if (awemeIds.length === 0) throw new Error('Failed to resolve TikTok video IDs from URL');

  const results: TikTokVideoMetadata[] = [];
  for (const item of awemeIds) {
    const awemeId = item.id;
    const uname = item.username;
    const endpoint = 'https://www.tiktok.com/api/item/detail/';
    const params = new URLSearchParams({
      aweme_id: awemeId,
      aid: '1988',
      app_name: 'tiktok_web',
      ...sessionManager.getDeviceParams()
    });

    let urlWithParams = `${endpoint}?${params.toString()}`;

    try {
      const xbogusModule = require('tiktok-signature');
      if (typeof xbogusModule === 'function' || xbogusModule.Signer) {
        const Signer = xbogusModule.Signer || xbogusModule;
        const signer = new Signer(null, DEFAULT_USER_AGENT);
        await signer.init();
        const signInfo = await signer.sign(urlWithParams);
        if (signInfo && signInfo.signed_url) urlWithParams = signInfo.signed_url;
      }
    } catch (err) {}

    try {
      await sessionManager.initSession();
      const detailRes = await axios.get(urlWithParams, { headers: sessionManager.getHeaders(), timeout: 10000 });
      const itemInfo = detailRes.data?.itemInfo?.itemStruct;
      if (itemInfo) {
        require('fs').writeFileSync('tiktok_video_debug.json', JSON.stringify(itemInfo.video, null, 2));
        let bestUrl = itemInfo.video?.playAddr || itemInfo.video?.downloadAddr || '';
        if (itemInfo.video?.bitrateInfo && Array.isArray(itemInfo.video.bitrateInfo) && itemInfo.video.bitrateInfo.length > 0) {
          const sortedBitrates = itemInfo.video.bitrateInfo.sort((a: any, b: any) => (b.Bitrate || 0) - (a.Bitrate || 0));
          const bestBitrate = sortedBitrates[0];
          if (bestBitrate?.PlayAddr?.UrlList?.length > 0) {
            bestUrl = bestBitrate.PlayAddr.UrlList[0];
          } else if (bestBitrate?.PlayAddr?.urlList?.length > 0) {
            bestUrl = bestBitrate.PlayAddr.urlList[0];
          }
        }
        
        results.push({
          id: awemeId,
          caption: itemInfo.desc || `TikTok Video ${awemeId}`,
          hashtags: [],
          playUrl: bestUrl,
          downloadUrl: bestUrl,
          author: itemInfo.author?.uniqueId || uname,
          createTime: itemInfo.createTime || Math.floor(Date.now() / 1000),
          url: `https://www.tiktok.com/@${itemInfo.author?.uniqueId || uname}/video/${awemeId}`
        });
      }
    } catch (err: any) {}
  }

  return results;
}

export async function downloadTikTokVideo(videoUrl: string, outputPath: string): Promise<string> {
  const response = await axios({
    method: 'GET',
    url: videoUrl,
    responseType: 'stream',
    headers: {
      'User-Agent': DEFAULT_USER_AGENT,
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
