const { getLatestTikTokVideos } = require('./src/workers/tiktok.scraper');

async function test() {
  const result = await getLatestTikTokVideos('https://www.tiktok.com/@thelastpicks/video/7405785089201949983', 1);
  console.log(JSON.stringify(result, null, 2));
}

test();
