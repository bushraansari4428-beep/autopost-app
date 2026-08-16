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

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

export async function extractXiaohongshuVideos(shareUrl: string, limit = 5): Promise<XiaohongshuMetadata[]> {
  console.log(`[XHS Scraper] Fetching via Native HTTP for: ${shareUrl}`);
  
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
  };

  if (process.env.XHS_COOKIE) headers['Cookie'] = process.env.XHS_COOKIE;

  try {
    const response = await axios.get(shareUrl, { headers, timeout: 15000 });
    const html = response.data;

    // Check for WAF block
    if (html.includes('<title>Verify</title>') || response.status === 403 || html.includes('captcha')) {
      console.log(`[XHS Scraper] WAF blocked. Status: ${response.status}. First 500 chars: ${html.substring(0, 500)}`);
      return [];
    }

    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s);
    if (!stateMatch || !stateMatch[1]) {
      console.log(`[XHS Scraper] No __INITIAL_STATE__ found. WAF block possible.`);
      return [];
    }

    const stateStr = stateMatch[1].replace(/undefined/g, 'null');
    const state = JSON.parse(stateStr);
    
    const results: XiaohongshuMetadata[] = [];
    const isProfile = shareUrl.includes('/user/profile/');

    if (isProfile) {
      const notesList = state?.user?.notes?.[0] || state?.notes?.notesList || [];
      const notesToProcess = notesList.slice(0, limit);
      
      for (const note of notesToProcess) {
        const noteId = note.id || note.noteId;
        if (!noteId) continue;
        const noteUrl = `https://www.xiaohongshu.com/explore/${noteId}`;
        const noteVideos = await extractXiaohongshuVideos(noteUrl, 1);
        if (noteVideos.length > 0) results.push(noteVideos[0]);
      }
    } else {
      const noteMap = state?.note?.noteDetailMap ?? {};
      const firstNoteKey = Object.keys(noteMap)[0];
      const noteObj = noteMap[firstNoteKey]?.note ?? {};
      
      let title = noteObj.title || 'RedNote Video';
      let mp4Url = '';
      
      const h264Url = noteObj.video?.media?.stream?.h264?.[0]?.masterUrl;
      const originKey = noteObj.video?.consumer?.originVideoKey;
      
      if (h264Url) mp4Url = h264Url;
      else if (originKey) mp4Url = `https://sns-video-bd.xhscdn.com/${originKey.replace(/^\//, '')}`;

      if (mp4Url) {
        if (mp4Url.startsWith('http:') && !mp4Url.startsWith('http://')) mp4Url = mp4Url.replace('http:', 'http://');
        if (mp4Url.startsWith('https:') && !mp4Url.startsWith('https://')) mp4Url = mp4Url.replace('https:', 'https://');

        results.push({
          id: firstNoteKey || 'xhs_' + Date.now(),
          title: title,
          description: title,
          url: shareUrl,
          mp4Url: mp4Url,
          timestamp: Math.floor(Date.now() / 1000)
        });
      }
    }
    return results;
  } catch (error: any) {
    console.error(`[XHS Scraper] Error: ${error.message}`);
    if (error.response) {
      console.log(`[XHS Scraper] Error Response Status: ${error.response.status}`);
      console.log(`[XHS Scraper] Error HTML (first 500 chars): ${String(error.response.data).substring(0, 500)}`);
    }
    return [];
  }
}

export async function downloadXiaohongshuVideo(videoUrl: string, outputPath: string): Promise<string> {
  const headers: Record<string, string> = {
    'User-Agent': DEFAULT_USER_AGENT,
    'Referer': 'https://www.xiaohongshu.com/',
  };
  if (process.env.XHS_COOKIE) headers['Cookie'] = process.env.XHS_COOKIE;

  const response = await axios({
    method: 'GET',
    url: videoUrl,
    responseType: 'stream',
    headers
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(outputPath));
    writer.on('error', (err: any) => {
      writer.close();
      reject(err);
    });
  });
}
