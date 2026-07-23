const fetch = require('node-fetch');
async function run() {
  const r = await fetch('https://www.youtube.com/@MIKEHUDSON-m7q');
  const t = await r.text();
  console.log(t.match(/"channelId":"(UC[^"]+)"/)[1]);
}
run();
