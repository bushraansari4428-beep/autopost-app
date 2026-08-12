const fs = require('fs');

async function testProfile() {
  const url = 'https://www.xiaohongshu.com/user/profile/5cad44ee0000000016010f10';
  const ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 Chrome/124.0.0.0 Mobile Safari/604.1';
  const headers = {
    'User-Agent': ua,
    'Cookie': fs.existsSync('cookies.txt') ? fs.readFileSync('cookies.txt', 'utf8').split('\n').filter(l => l.includes('xiaohongshu.com')).map(l => { const p = l.split('\t'); return p.length >= 7 ? `${p[5]}=${p[6].trim()}` : null; }).filter(Boolean).join('; ') : ''
  };

  const res = await fetch(url, { headers });
  const html = await res.text();
  const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s) || html.match(/window\.__INITIAL_SSR_STATE__\s*=\s*(\{.+?\});?</s);
  
  if (stateMatch) {
    const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
    fs.writeFileSync('xhs_profile_state.json', JSON.stringify(state, null, 2));
    console.log('Saved state to xhs_profile_state.json');
    console.log('Keys in state:', Object.keys(state));
    if (state.user) console.log('Keys in state.user:', Object.keys(state.user));
    if (state.user?.notes) console.log('Notes length:', state.user.notes.length);
  } else {
    fs.writeFileSync('xhs_profile_html.html', html);
    console.log('No state match found. Wrote HTML to xhs_profile_html.html');
  }
}
testProfile();
