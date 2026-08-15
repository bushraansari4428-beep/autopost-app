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

export async function getLatestTikTokVideo(inputUrl: string): Promise<TikTokVideoMetadata> {
  const cleanUrl = inputUrl.split('?')[0].replace(/\/$/, '').trim();
  const isVideoUrl = cleanUrl.includes('/video/') || cleanUrl.includes('/v/');
  
  

  let awemeId = '';
  let username = 'user';

  if (isVideoUrl) {
    // Attempt oEmbed to get aweme_id reliably (officially supported endpoint)
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
  } else {
    const usernameMatch = cleanUrl.match(/@([a-zA-Z0-9_.-]+)/);
    const uname = usernameMatch ? usernameMatch[1] : '';
    if (uname) {
      try {
        const tikwmRes = await axios.get(`https://www.tikwm.com/api/user/posts?unique_id=${uname}&count=1`, { timeout: 10000 });
        if (tikwmRes.data && tikwmRes.data.data && tikwmRes.data.data.videos && tikwmRes.data.data.videos.length > 0) {
           const v = tikwmRes.data.data.videos[0];
           return {
             id: v.video_id,
             caption: v.title,
             hashtags: [],
             playUrl: v.play,
             downloadUrl: v.play,
             author: v.author?.unique_id || uname,
             createTime: v.create_time,
             url: `https://www.tiktok.com/@${v.author?.unique_id || uname}/video/${v.video_id}`
           };
        }
      } catch (err: any) {
        console.log(`TikWM user posts API failed for ${uname}:`, err.message);
      }
    }

    try {
      await sessionManager.initSession();
      const profileRes = await axios.get(cleanUrl, { headers: sessionManager.getHeaders(), timeout: 10000 });
      const match = profileRes.data.match(/<script[^>]*id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
      if (match) {
        try {
          const data = JSON.parse(match[1]);
          const defaultScope = data['__DEFAULT_SCOPE__'] || data || {};
          const userDetail = defaultScope['webapp.user-detail'] || {};
          const itemIds = userDetail?.itemList || [];
          if (itemIds.length > 0) {
            awemeId = itemIds[0];
          }
        } catch (err) {}
      }
    } catch (err: any) {
      console.log(`Failed to fetch TikTok profile HTML:`, err.message);
    }
  }

  if (!awemeId) {
    throw new Error('Failed to resolve TikTok video ID from URL via pure HTTP');
  }

  // Query /api/item/detail/ with Native HTTP params
  const endpoint = 'https://www.tiktok.com/api/item/detail/';
  const params = new URLSearchParams({
    aweme_id: awemeId,
    aid: '1988',
    app_name: 'tiktok_web',
    ...sessionManager.getDeviceParams()
  });

  let urlWithParams = `${endpoint}?${params.toString()}`;

  // Attempt X-Bogus signature natively if package is available
  try {
    const xbogusModule = require('tiktok-signature');
    if (typeof xbogusModule === 'function' || xbogusModule.Signer) {
      const Signer = xbogusModule.Signer || xbogusModule;
      const signer = new Signer(null, DEFAULT_USER_AGENT);
      await signer.init();
      const signInfo = await signer.sign(urlWithParams);
      if (signInfo && signInfo.signed_url) {
        urlWithParams = signInfo.signed_url;
      }
    }
  } catch (err) {
    console.log('No pure-JS xbogus module found or generation failed. Proceeding without signature as fallback.');
  }

  let detailRes;
  try {
    await sessionManager.initSession();
    detailRes = await axios.get(urlWithParams, { headers: sessionManager.getHeaders(), timeout: 10000 });
  } catch (err: any) {
    if (err.response && err.response.status !== 200) {
      throw new Error(`TikTok Web API returned ${err.response.status}. Missing or invalid X-Bogus signature for pure HTTP.`);
    }
    throw err;
  }

  const itemInfo = detailRes.data?.itemInfo?.itemStruct;
  if (!itemInfo) {
    throw new Error('Failed to extract item detail from TikTok Web API (WAF Blocked or Empty Data)');
  }

  const fullCaption = itemInfo.desc || `TikTok Video ${awemeId}`;
  const playUrl = itemInfo.video?.playAddr || itemInfo.video?.downloadAddr || '';

  return {
    id: awemeId,
    caption: fullCaption,
    hashtags: [],
    playUrl: playUrl,
    downloadUrl: itemInfo.video?.downloadAddr || playUrl,
    author: itemInfo.author?.uniqueId || username,
    createTime: itemInfo.createTime || Math.floor(Date.now() / 1000),
    url: `https://www.tiktok.com/@${itemInfo.author?.uniqueId || username}/video/${awemeId}`
  };
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
