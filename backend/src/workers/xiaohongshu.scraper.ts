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
  if (!rawUrl.includes('xhslink') && !rawUrl.includes('t.cn') && !rawUrl.includes('url.cn')) {
    return rawUrl;
  }

  try {
    const response = await fetch(rawUrl, {
      method: 'GET',
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
    });
    return response.url || rawUrl;
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

  // Option B: RapidAPI WAF Bypass (If key is provided in Render)
  if (process.env.RAPIDAPI_KEY && !isProfile) {
    try {
      console.log(`[XHS Scraper] Using RapidAPI WAF Bypass for: ${targetUrl}`);
      const apiRes = await axios({
        method: 'GET',
        url: 'https://social-media-video-downloader.p.rapidapi.com/smvd/get/all',
        params: { url: targetUrl },
        headers: {
          'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
          'X-RapidAPI-Host': 'social-media-video-downloader.p.rapidapi.com'
        },
        timeout: 20000
      });

      const apiData = apiRes.data;
      // Handle standard Social Media Video Downloader format
      const videoLink = apiData?.links?.find((l: any) => l.type === 'video' || l.link.includes('.mp4'))?.link || apiData?.video || apiData?.data?.video || apiData?.url;
      
      if (videoLink) {
        console.log(`[XHS Scraper] Successfully extracted MP4 via RapidAPI Bypass!`);
        return {
          id: noteId,
          title: apiData?.title || apiData?.data?.title || extractedTitle,
          description: apiData?.title || apiData?.data?.desc || extractedTitle,
          url: targetUrl,
          mp4Url: videoLink,
          timestamp: Math.floor(Date.now() / 1000)
        };
      }
    } catch (e: any) {
      console.warn(`[XHS Scraper] RapidAPI Bypass failed: ${e.message}. Falling back to Native HTTP...`);
    }
  }

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
        ...(process.env.XHS_COOKIE ? { 'Cookie': process.env.XHS_COOKIE } : {})
      },
      timeout: 15000,
    });

    const html = response.data;
    const statusCode = response.status;
    const htmlSnippet = typeof html === 'string' ? html.substring(0, 500) : JSON.stringify(html).substring(0, 500);

    console.log(`[XHS Scraper] HTTP Status Code: ${statusCode} for ${targetUrl}`);
    console.log(`[XHS Scraper] HTML Snippet (First 500 chars):\n${htmlSnippet}`);
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
    if (stateMatch && stateMatch[1]) {
      try {
        const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
        
        // If profile, find latest note ID and redirect extraction to that note
        if (isProfile) {
          const userNotesRaw = state?.user?.notes ?? state?.user?.noteList ?? state?.user?.profile?.notes ?? [];
          const notesList: any[] = [];
          if (Array.isArray(userNotesRaw)) {
            for (const item of userNotesRaw) {
              if (Array.isArray(item)) {
                notesList.push(...item);
              } else if (item && typeof item === 'object') {
                notesList.push(item);
              }
            }
          }

          if (notesList.length > 0) {
            for (const item of notesList) {
              const card = item.noteCard || item;
              const title = card.displayTitle || card.title || item.title || `RedNote Video ${noteId}`;
              const xsecToken = item.xsecToken || card.xsecToken;
              const coverUrl = card.cover?.urlDefault || card.cover?.urlPre || '';
              
              let latestNoteId = card.noteId || item.noteId || item.id;
              if (!latestNoteId && coverUrl) {
                const coverMatch = coverUrl.match(/\/([a-zA-Z0-9]{24,32})!/);
                if (coverMatch) latestNoteId = coverMatch[1];
              }

              let extractedNote: any = null;
              if (latestNoteId) {
                const newNoteUrl = `https://www.xiaohongshu.com/explore/${latestNoteId}${xsecToken ? `?xsec_token=${xsecToken}&xsec_source=pc_feed` : ''}`;
                console.log(`Discovered latest note (${title}) from RedNote profile. Extracting note...`);
                extractedNote = await extractXiaohongshuVideo(newNoteUrl);
              }

              if (extractedNote && extractedNote.mp4Url && extractedNote.mp4Url !== targetUrl) {
                return extractedNote;
              } else if (title || coverUrl) {
                console.log(`Using profile card metadata for RedNote video (${title})...`);
                return {
                  id: latestNoteId || noteId,
                  title: title || `RedNote Video ${latestNoteId || noteId}`,
                  description: title || `RedNote Video ${latestNoteId || noteId}`,
                  url: targetUrl,
                  mp4Url: coverUrl || targetUrl,
                  timestamp: Math.floor(Date.now() / 1000)
                };
              }
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
        const h264Url = noteObj.video?.media?.stream?.h264?.[0]?.masterUrl;
        const av1Url = noteObj.video?.media?.stream?.av1?.[0]?.masterUrl;
        const originKey = noteObj.video?.consumer?.originVideoKey || noteObj.video?.originVideoKey || noteObj.video?.media?.stream?.h264?.[0]?.originVideoKey;

        if (h264Url && (h264Url.includes('/stream/') || h264Url.includes('.mp4'))) {
          extractedMp4 = h264Url;
        } else if (av1Url && (av1Url.includes('/stream/') || av1Url.includes('.mp4'))) {
          extractedMp4 = av1Url;
        } else if (originKey) {
          const cleanKey = originKey.replace(/^\//, '');
          extractedMp4 = `https://sns-video-bd.xhscdn.com/${cleanKey}`;
        }
      } catch (e) {
        console.warn(`Error parsing XHS initial state JSON:`, e);
      }
    }

    // Regex fallback if state parsing didn't find mp4
    if ((!extractedMp4 || (!extractedMp4.includes('/stream/') && !extractedMp4.includes('.mp4'))) && !isProfile) {
      const urlMatch = html.match(/"(?:masterUrl|originVideoKey|urlDefault|backupUrl)"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*(?:sns-video-[^"\\]*|\.mp4[^"\\]*))"/i) ||
                       html.match(/(stream\/[a-zA-Z0-9_\-\/]+\.mp4)/i) ||
                       html.match(/(spectrum\/[a-zA-Z0-9_\-\/]+\.mp4)/i);
      if (urlMatch && urlMatch[1]) {
        const val = urlMatch[1].replace(/\\\//g, '/');
        if (val.startsWith('http')) {
          extractedMp4 = val;
        } else {
          extractedMp4 = `https://sns-video-bd.xhscdn.com/${val.replace(/^\//, '')}`;
        }
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

    // If bare domain without stream path, reset to fallback
    if (!extractedMp4.includes('/stream/') && !extractedMp4.includes('.mp4') && !extractedMp4.includes('/spectrum/')) {
      extractedMp4 = targetUrl;
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
 * Downloads RedNote/Xiaohongshu MP4 or media asset locally with anti-403 CDN headers via Native HTTP.
 */
export async function downloadXiaohongshuVideo(videoUrl: string, outputPath: string, pageUrl?: string): Promise<string> {
  const targetUrlToDownload = videoUrl && videoUrl.startsWith('http') ? videoUrl : (pageUrl || videoUrl);

  if (targetUrlToDownload && targetUrlToDownload.startsWith('http')) {
    const headerOptions = [
      {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.xiaohongshu.com/',
        'Accept': '*/*',
        ...(process.env.XHS_COOKIE ? { 'Cookie': process.env.XHS_COOKIE } : {})
      },
      {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.rednote.com/',
        'Accept': '*/*',
        ...(process.env.XHS_COOKIE ? { 'Cookie': process.env.XHS_COOKIE } : {})
      }
    ];

    for (const headers of headerOptions) {
      try {
        const response = await axios({
          method: 'GET',
          url: targetUrlToDownload,
          responseType: 'stream',
          headers,
          timeout: 25000
        });

        const writer = fs.createWriteStream(outputPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
          writer.on('finish', () => resolve(outputPath));
          writer.on('error', (err) => {
            writer.close();
            reject(err);
          });
        });

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 1000) {
          return outputPath;
        }
      } catch (e: any) {
        console.warn(`Native HTTP download attempt failed for ${targetUrlToDownload}: ${e.message}`);
      }
    }
  }

  throw new Error('Failed to download Xiaohongshu video asset via Native HTTP');
}
