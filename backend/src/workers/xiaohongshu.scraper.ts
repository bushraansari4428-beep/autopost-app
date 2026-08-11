import axios from 'axios';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

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
 * Extracts raw unwatermarked MP4 URL from a Xiaohongshu post using Native HTTP requests
 */
export async function extractXiaohongshuVideo(shareUrl: string): Promise<XiaohongshuMetadata | null> {
  const targetUrl = await resolveXhsUrl(shareUrl);
  console.log(`Extracting Xiaohongshu (RedNote) video natively for resolved URL: ${targetUrl}`);

  const noteMatch = targetUrl.match(/(?:explore|discovery\/item|item|note|profile)\/([a-zA-Z0-9_-]+)/i) || targetUrl.match(/([a-zA-Z0-9]{24,32})/);
  const noteId = noteMatch ? noteMatch[1] : 'xhs_' + Date.now();
  const isProfile = targetUrl.includes('/user/profile/');

  let extractedTitle = `RedNote Video ${noteId}`;
  let extractedMp4: string | undefined = undefined;

  try {
    const response = await axios({
      method: 'GET',
      url: targetUrl,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
      },
      timeout: 15000,
    });

    const html = response.data;

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
  } catch (err: any) {
    console.warn(`Direct HTTP extraction for RedNote failed: ${err.message}`);
  }

  if (extractedMp4) {
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
  const headerOptions = [
    {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Accept': '*/*',
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': '*/*',
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      'Referer': 'https://www.rednote.com/',
      'Accept': '*/*',
    },
    {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.xiaohongshu.com/',
      'Accept': '*/*'
    }
  ];

  let lastErr: any = null;
  for (const headers of headerOptions) {
    try {
      const response = await axios({
        method: 'GET',
        url: videoUrl,
        responseType: 'stream',
        headers,
        timeout: 20000
      });

      const writer = fs.createWriteStream(outputPath);
      response.data.pipe(writer);

      return await new Promise((resolve, reject) => {
        writer.on('finish', () => resolve(outputPath));
        writer.on('error', (err) => {
          writer.close();
          reject(err);
        });
      });
    } catch (e) {
      lastErr = e;
    }
  }

  // Fallback to yt-dlp stream download if axios headers failed
  try {
    const execPromise = promisify(exec);
    const ytCmd = process.platform === 'win32' ? 'yt-dlp.exe' : './yt-dlp';
    await execPromise(`${ytCmd} -o "${outputPath}" "${videoUrl}"`);
    if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
      return outputPath;
    }
  } catch (ytErr) {
    console.warn(`yt-dlp stream download fallback warning: ${ytErr.message}`);
  }

  throw lastErr || new Error('Failed to download Xiaohongshu video after multiple header attempts');
}
