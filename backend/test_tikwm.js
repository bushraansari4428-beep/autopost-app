const { chromium } = require('playwright-extra');
const stealth = require('puppeteer-extra-plugin-stealth')();
chromium.use(stealth);

async function testPlaywright() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  await page.goto('https://www.tiktok.com/@thelastpicks/video/7405785089201949983', { waitUntil: 'domcontentloaded', timeout: 15000 });
  
  let scriptContent = await page.evaluate(() => {
    const script = document.getElementById('__UNIVERSAL_DATA_FOR_REHYDRATION__');
    return script ? script.textContent : null;
  });
  
  if (scriptContent) {
    const data = JSON.parse(scriptContent);
    const defaultScope = data['__DEFAULT_SCOPE__'] || data || {};
    console.log(Object.keys(defaultScope));
  }
  
  await browser.close();
}
testPlaywright().catch(console.error);
