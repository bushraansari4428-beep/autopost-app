const fs = require('fs');

async function testFetch() {
  const url = 'https://www.xiaohongshu.com/explore/654a1b02000000002a00938b';
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  
  const res = await fetch(url, { headers: { 'User-Agent': ua } });
  const html = await res.text();
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
  
  if (stateMatch) {
    console.log('Found state via fetch!');
    const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
    const noteMap = state?.note?.noteDetailMap ?? state?.noteData ?? {};
    const firstKey = Object.keys(noteMap)[0];
    const noteObj = noteMap[firstKey]?.note ?? noteMap[firstKey] ?? {};
    const videoObj = noteObj.video?.media?.stream?.h264?.[0] ?? noteObj.video?.media?.stream?.av1?.[0] ?? noteObj.video;
    console.log('Video URL:', videoObj?.masterUrl || videoObj?.url || videoObj?.originVideoKey);
  } else {
    console.log('No state found via fetch');
  }
}
testFetch();
