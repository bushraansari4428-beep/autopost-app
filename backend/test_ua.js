async function test() {
  const url = 'https://www.xiaohongshu.com/explore/6a3d6e310000000007026fa4';
  
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Chrome/124.0.0.0 Mobile Safari/604.1',
    'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    'Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)'
  ];

  for (const ua of userAgents) {
    console.log(`\nTesting UA: ${ua}`);
    try {
      const res = await fetch(url, { headers: { 'User-Agent': ua } });
      const html = await res.text();
      const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
      
      if (stateMatch) {
        const stateStr = stateMatch[1].replace(/undefined/g, 'null');
        console.log("Found State Length:", stateStr.length);
        const state = JSON.parse(stateStr);
        const noteMap = state?.note?.noteDetailMap ?? state?.noteData ?? {};
        const firstKey = Object.keys(noteMap)[0];
        if (firstKey) {
          console.log(`✅ Success with UA! Found Note Data!`);
        } else {
          console.log(`❌ State found but no note map. Redirected to explore feed?`);
        }
      } else {
        console.log(`❌ No State found in HTML.`);
      }
    } catch (e) {
      console.log(`❌ Error: ${e.message}`);
    }
  }
}
test();
