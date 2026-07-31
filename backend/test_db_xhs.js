const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function testMobile() {
  const sources = await prisma.source.findMany({ where: { platform: 'XIAOHONGSHU' } });
  
  for (const source of sources) {
    const url = source.url;
    console.log("Testing:", url);
    const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Chrome/124.0.0.0 Mobile Safari/604.1';
    
    // Parse cookies just in case
    let cookieString = '';
    try {
      const cookieContent = fs.readFileSync('cookies.txt', 'utf8');
      cookieString = cookieContent.split('\n')
        .filter(line => line.includes('xiaohongshu.com'))
        .map(line => {
          const parts = line.split('\t');
          if (parts.length >= 7) return `${parts[5]}=${parts[6].trim()}`;
          return null;
        }).filter(Boolean).join('; ');
    } catch(e) {}
    
    const headers = { 'User-Agent': ua };
    if (cookieString) headers['Cookie'] = cookieString;

    const res = await fetch(url, { headers });
    const html = await res.text();
    
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
    if (stateMatch) {
      const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
      const noteMap = state?.note?.noteDetailMap ?? state?.noteData ?? {};
      const firstKey = Object.keys(noteMap)[0];
      const noteObj = noteMap[firstKey]?.note ?? noteMap[firstKey] ?? {};
      
      const videoObj = noteObj.video?.media?.stream?.h264?.[0] ?? noteObj.video?.media?.stream?.av1?.[0] ?? noteObj.video;
      if (videoObj?.masterUrl || videoObj?.url || videoObj?.originVideoKey) {
         console.log("✅ MP4 FOUND:", videoObj.masterUrl || videoObj.url || videoObj.originVideoKey);
      } else {
         // Regex fallback on HTML
         const urlMatch = html.match(/"(?:masterUrl|originVideoKey|urlDefault|backupUrl|url)"\s*:\s*"([^"\\]+(?:\\.[^"\\]*)*(?:sns-video-[^"\\]*|\.mp4[^"\\]*))"/i) ||
                          html.match(/(https?:\/\/[^"'\s\\]*sns-video-[^"'\s\\]*)/i) ||
                          html.match(/(https?:\/\/[^"'\s\\]*\.mp4[^"'\s\\]*)/i);
         if (urlMatch && urlMatch[1]) {
           console.log("✅ MP4 FOUND VIA REGEX:", urlMatch[1]);
         } else {
           console.log("❌ No MP4 found.");
         }
      }
    } else {
      console.log("❌ No state match");
    }
  }
}
testMobile();
