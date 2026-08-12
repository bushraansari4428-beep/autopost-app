import { chromium } from 'playwright-extra';
import stealth from 'puppeteer-extra-plugin-stealth';

chromium.use(stealth());

async function main() {
  const url = 'https://www.xiaohongshu.com/explore/654a1b02000000002a00938b';
  console.log('Testing XHS with Stealth...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  
  const page = await context.newPage();
  
  let videoFound = false;
  page.on('response', res => {
    if (res.url().includes('sns-video-') || res.url().includes('.mp4')) {
      console.log('Found video in response:', res.url());
      videoFound = true;
    }
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(3000);
  
  const pageData = await page.evaluate(() => {
    const w: any = window as any;
    const st = w.__INITIAL_STATE__ || w.__INITIAL_SSR_STATE__;
    let mp4 = null;
    let isVideo = false;
    let title = document.title;
    
    if (st) {
      const noteMap = st?.note?.noteDetailMap ?? st?.noteData ?? {};
      const firstKey = Object.keys(noteMap)[0];
      const noteObj = noteMap[firstKey]?.note ?? noteMap[firstKey] ?? {};
      if (noteObj.title) title = noteObj.title;
      const videoObj = noteObj.video?.media?.stream?.h264?.[0] ?? noteObj.video?.media?.stream?.av1?.[0] ?? noteObj.video;
      if (videoObj) isVideo = true;
      if (videoObj?.masterUrl || videoObj?.url || videoObj?.originVideoKey) {
        mp4 = videoObj.masterUrl || videoObj.url || videoObj.originVideoKey;
      }
    }
    return { title, isVideo, mp4, hasState: !!st };
  });
  
  console.log('Page Data:', pageData);
  await browser.close();
}

main().catch(console.error);
