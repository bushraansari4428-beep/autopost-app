const { chromium } = require('playwright');

async function test() {
  const targetUrl = 'https://www.xiaohongshu.com/user/profile/5cad44ee0000000016010f10';
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  const page = await context.newPage();
  
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/sns/web/v1/user/posted') || url.includes('/api/sns/web/v1/feed') || url.includes('otherinfo')) {
       console.log('Intercepted API response:', url);
    }
  });

  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log(e.message));
  await page.waitForTimeout(5000);
  
  const state = await page.evaluate(() => window.__INITIAL_STATE__ || window.__INITIAL_SSR_STATE__);
  if (state) {
     console.log('Found state with keys:', Object.keys(state));
     if (state.user) {
         console.log('User notes:', state.user.notes?.length);
     }
  } else {
     console.log('No state found in window object');
  }

  await browser.close();
}
test();
