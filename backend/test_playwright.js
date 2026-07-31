const { chromium } = require('playwright');

async function test() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 720 }
  });
  const page = await context.newPage();
  
  await page.goto('https://www.xiaohongshu.com/explore/6a3d6e310000000007026fa4');
  await page.waitForTimeout(5000);
  
  await page.screenshot({ path: 'xhs_screenshot.png' });
  
  const content = await page.content();
  const fs = require('fs');
  fs.writeFileSync('xhs_playwright.html', content);
  
  await browser.close();
  console.log('Screenshot saved to xhs_screenshot.png');
}

test();
