const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
  const targetUrl = 'https://www.xiaohongshu.com/user/profile/5cad44ee0000000016010f10';
  
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });

  // Inject cookies
  if (fs.existsSync('cookies.txt')) {
    const lines = fs.readFileSync('cookies.txt', 'utf8').split('\n');
    const cookies = lines.filter(l => l.includes('xiaohongshu.com')).map(l => {
      const parts = l.split('\t');
      if (parts.length >= 7) {
        return {
          name: parts[5],
          value: parts[6].trim(),
          domain: '.xiaohongshu.com',
          path: '/'
        };
      }
      return null;
    }).filter(Boolean);
    await context.addCookies(cookies);
    console.log(`Injected ${cookies.length} cookies into Playwright.`);
  } else {
    console.log('No cookies.txt found!');
  }

  const page = await context.newPage();
  
  page.on('response', async (res) => {
    const url = res.url();
    if (url.includes('/api/sns/web/v1/user/posted') || url.includes('/api/sns/web/v1/feed') || url.includes('otherinfo')) {
       console.log('Intercepted API response:', url);
       try {
         const data = await res.json();
         fs.writeFileSync('xhs_profile_api.json', JSON.stringify(data, null, 2));
         console.log('Wrote API response to xhs_profile_api.json');
       } catch (e) {}
    }
  });

  console.log('Navigating to', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 }).catch(e => console.log(e.message));
  await page.waitForTimeout(5000);
  
  const html = await page.content();
  fs.writeFileSync('xhs_profile_pw.html', html);
  console.log('Saved Playwright DOM to xhs_profile_pw.html');

  // Check state
  const state = await page.evaluate(() => window.__INITIAL_STATE__ || window.__INITIAL_SSR_STATE__);
  if (state) {
     fs.writeFileSync('xhs_profile_pw_state.json', JSON.stringify(state, null, 2));
     console.log('Saved Playwright State to xhs_profile_pw_state.json');
  } else {
     console.log('No state found in window object');
  }

  await browser.close();
}
test();
