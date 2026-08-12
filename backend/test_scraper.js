const { extractXiaohongshuVideo } = require('./dist/workers/xiaohongshu.scraper');

async function test() {
  console.log("Testing profile...");
  const profileResult = await extractXiaohongshuVideo('https://www.xiaohongshu.com/user/profile/5cad44ee0000000016010f10');
  console.log("Profile Result:", profileResult);

  console.log("Testing post...");
  const postResult = await extractXiaohongshuVideo('https://www.xiaohongshu.com/explore/654a1b02000000002a00938b');
  console.log("Post Result:", postResult);
  
  process.exit(0);
}

test();
