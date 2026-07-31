async function test() {
  const url = 'https://www.xiaohongshu.com/explore/6a3d6e310000000007026fa4';
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Chrome/124.0.0.0 Mobile Safari/604.1';
  
  const res = await fetch(url, { headers: { 'User-Agent': ua } });
  const html = await res.text();
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
  
  if (stateMatch) {
    const stateStr = stateMatch[1].replace(/undefined/g, 'null');
    const state = JSON.parse(stateStr);
    console.log(Object.keys(state));
    console.log("Note object:", Object.keys(state?.note ?? {}));
    
    // Dump full JSON string just first 1000 chars
    console.log(JSON.stringify(state).substring(0, 1000));
    
    const fs = require('fs');
    fs.writeFileSync('xhs_mobile_state.json', JSON.stringify(state, null, 2));
  }
}
test();
