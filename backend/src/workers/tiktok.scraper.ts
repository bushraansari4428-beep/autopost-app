import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execPromise } from '../utils/exec.util';

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

export async function getYtDlpBinaryPath(): Promise<string> {
  // 1. Check if python -m yt_dlp or python3 -m yt_dlp is available (supports curl-cffi impersonation)
  try {
    await execPromise('python -m yt_dlp --version');
    return 'python -m yt_dlp';
  } catch (_) {}

  try {
    await execPromise('python3 -m yt_dlp --version');
    return 'python3 -m yt_dlp';
  } catch (_) {}

  if (process.env.GITHUB_ACTIONS === 'true') {
    return 'yt-dlp';
  }
  
  const isWin = process.platform === 'win32';
  const binName = isWin ? 'yt-dlp.exe' : 'yt-dlp';
  const tmpBin = path.join(os.tmpdir(), binName);

  if (fs.existsSync(tmpBin) && fs.statSync(tmpBin).size > 1000000) {
    if (!isWin) {
      try { fs.chmodSync(tmpBin, '755'); } catch (_) {}
    }
    return `"${tmpBin}"`;
  }

  // Try checking if yt-dlp exists globally
  try {
    await execPromise('yt-dlp --version');
    return 'yt-dlp';
  } catch (_) {}

  // Auto-download standalone official yt-dlp binary (only 3MB)
  try {
    console.log(`Downloading standalone yt-dlp binary to ${tmpBin}...`);
    const downloadUrl = isWin
      ? 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe'
      : 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    const res = await axios.get(downloadUrl, { responseType: 'stream', maxRedirects: 5, timeout: 30000 });
    const writer = fs.createWriteStream(tmpBin);
    res.data.pipe(writer);
    await new Promise((resolve, reject) => {
      writer.on('finish', () => resolve(true));
      writer.on('error', reject);
    });
    if (!isWin) {
      try { fs.chmodSync(tmpBin, '755'); } catch (_) {}
    }
    console.log(`yt-dlp ready at ${tmpBin}`);
    return `"${tmpBin}"`;
  } catch (err: any) {
    console.error(`Failed to download yt-dlp: ${err.message}`);
    return 'yt-dlp';
  }
}

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
  const usernameMatch = cleanUrl.match(/@([a-zA-Z0-9_.-]+)/);
  const uname = usernameMatch ? usernameMatch[1] : '';

  // 1. Direct, ultra-fast yt-dlp extraction (No browser, no Playwright, unwatermarked HD streams)
  try {
    const ytDlpCmd = await getYtDlpBinaryPath();
    const cookieArg = fs.existsSync('cookies.txt') ? '--cookies cookies.txt' : '';
    const impersonateArg = '--impersonate chrome';
    const ignoreErrorsArg = '-i';
    const extractCmd = isVideoUrl
      ? `${ytDlpCmd} ${impersonateArg} ${ignoreErrorsArg} ${cookieArg} --dump-json "${cleanUrl}"`
      : `${ytDlpCmd} ${impersonateArg} ${ignoreErrorsArg} ${cookieArg} --dump-json --playlist-end ${limit} "${cleanUrl}"`;
    
    console.log(`Executing yt-dlp TikTok extraction: ${extractCmd}`);
    let stdout = '';
    try {
      const res = await execPromise(extractCmd, {
        maxBuffer: 1024 * 1024 * 50,
        timeout: 2 * 60 * 1000
      });
      stdout = res.stdout;
    } catch (cmdErr: any) {
      stdout = cmdErr.stdout || '';
    }

    // Fallback without impersonate if stdout is empty
    if (!stdout || !stdout.trim()) {
      const fallbackCmd = isVideoUrl
        ? `${ytDlpCmd} ${ignoreErrorsArg} ${cookieArg} --dump-json "${cleanUrl}"`
        : `${ytDlpCmd} ${ignoreErrorsArg} ${cookieArg} --dump-json --playlist-end ${limit} "${cleanUrl}"`;
      try {
        const res = await execPromise(fallbackCmd, {
          maxBuffer: 1024 * 1024 * 50,
          timeout: 2 * 60 * 1000
        });
        stdout = res.stdout;
      } catch (cmdErr: any) {
        stdout = cmdErr.stdout || '';
      }
    }

    if (stdout && stdout.trim()) {
      const lines = stdout.trim().split('\n');
      const ytVideos: TikTokVideoMetadata[] = [];
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          const bestUrl = parsed.url || (parsed.requested_downloads?.[0]?.url) || '';
          
          let createTime = parsed.timestamp;
          if (!createTime && parsed.id && /^\d{15,22}$/.test(parsed.id)) {
            try {
              const tsFromId = Number(BigInt(parsed.id) >> 32n);
              if (tsFromId > 1500000000 && tsFromId < 2000000000) {
                createTime = tsFromId;
              }
            } catch (_) {}
          }
          if (!createTime && parsed.upload_date && typeof parsed.upload_date === 'string' && parsed.upload_date.length === 8) {
            const y = parseInt(parsed.upload_date.substring(0, 4), 10);
            const m = parseInt(parsed.upload_date.substring(4, 6), 10) - 1;
            const d = parseInt(parsed.upload_date.substring(6, 8), 10);
            createTime = Math.floor(new Date(y, m, d).getTime() / 1000);
          }

          ytVideos.push({
            id: parsed.id,
            caption: parsed.title || parsed.description || `TikTok Video ${parsed.id}`,
            hashtags: [],
            playUrl: bestUrl,
            downloadUrl: bestUrl,
            author: parsed.uploader || uname || 'user',
            createTime: createTime || Math.floor(Date.now() / 1000),
            url: parsed.webpage_url || `https://www.tiktok.com/@${uname}/video/${parsed.id}`
          });
        } catch (_) {}
      }
      if (ytVideos.length > 0) {
        console.log(`Successfully extracted ${ytVideos.length} TikTok video(s) via yt-dlp with exact timestamps.`);
        return ytVideos;
      }
    }
  } catch (err: any) {
    console.log(`yt-dlp TikTok extraction error:`, err.message);
  }

  // 2. Direct HTTP TikWM fallback (zero browser overhead)
  if (uname) {
    try {
      console.log(`Attempting direct HTTP TikWM API for @${uname}...`);
      const tikwmUrl = `https://www.tikwm.com/api/user/posts?unique_id=${encodeURIComponent(uname)}&count=${limit}`;
      const res = await axios.get(tikwmUrl, {
        timeout: 10000,
        headers: {
          'User-Agent': DEFAULT_USER_AGENT,
          'Accept': 'application/json, text/plain, */*'
        }
      });
      if (res.data && res.data.data && Array.isArray(res.data.data.videos) && res.data.data.videos.length > 0) {
        console.log(`Successfully extracted ${res.data.data.videos.length} videos from TikWM API.`);
        return res.data.data.videos.slice(0, limit).map((v: any) => ({
          id: v.video_id,
          caption: v.title || `TikTok Video ${v.video_id}`,
          hashtags: [],
          playUrl: v.hdplay || v.play,
          downloadUrl: v.hdplay || v.play,
          author: v.author?.unique_id || uname,
          createTime: v.create_time || Math.floor(Date.now() / 1000),
          url: `https://www.tiktok.com/@${v.author?.unique_id || uname}/video/${v.video_id}`
        }));
      }
    } catch (e: any) {
      console.log(`TikWM direct HTTP failed:`, e.message);
    }
  }

  // 3. Fallback for single video URL via oEmbed API
  if (isVideoUrl) {
    try {
      const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(cleanUrl)}`;
      const oembedRes = await axios.get(oembedUrl, { headers: { 'Accept': 'application/json' }, timeout: 10000 });
      if (oembedRes.data && oembedRes.data.embed_product_id) {
        const awemeId = oembedRes.data.embed_product_id;
        const author = oembedRes.data.author_unique_id || 'user';
        return [{
          id: awemeId,
          caption: oembedRes.data.title || `TikTok Video ${awemeId}`,
          hashtags: [],
          playUrl: '',
          downloadUrl: '',
          author: author,
          createTime: Math.floor(Date.now() / 1000),
          url: cleanUrl
        }];
      }
    } catch (_) {}
  }

  throw new Error('Failed to resolve TikTok video IDs from URL');
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
