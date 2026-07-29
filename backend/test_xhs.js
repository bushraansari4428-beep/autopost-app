const fs = require('fs');

async function run() {
  const fullUrl = 'https://www.xiaohongshu.com/explore/6a3d6e310000000007026fa4?xsec_token=ABaHJzVgSXIv5I-KDV6c4MbPLCHJyRok5k2XUJJpiX9mM=&xsec_source=pc_feed';
  const res = await fetch(fullUrl, { 
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Referer': 'https://www.xiaohongshu.com/'
    } 
  });
  const html = await res.text();
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s);
  if (stateMatch) {
    const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
    console.log("undertakeNote:", JSON.stringify(state?.feed?.undertakeNote, null, 2)?.substring(0, 800));
    console.log("undertakeNote keys:", Object.keys(state?.feed?.undertakeNote ?? {}));
  }
}
run();
