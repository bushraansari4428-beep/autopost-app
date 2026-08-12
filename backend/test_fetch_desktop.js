const fs = require('fs');

async function testFetch() {
  const url = 'https://www.xiaohongshu.com/user/profile/5cad44ee0000000016010f10';
  const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
  
  const res = await fetch(url, { headers: { 'User-Agent': ua } });
  const html = await res.text();
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
  
  if (stateMatch) {
    console.log('Found state via fetch!');
    const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
    if (state.user && state.user.notes) {
       console.log('Found notes:', state.user.notes.length);
    }
  } else {
    console.log('No state found via fetch');
  }
}
testFetch();
