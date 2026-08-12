import { extractXiaohongshuVideo } from '../backend/src/workers/xiaohongshu.scraper';

async function test() {
  console.log("Testing scraper...");
  const result = await extractXiaohongshuVideo("https://xhslink.cn/m/28GJE7zgSxL");
  console.log("Result:", result);
}
test();
