const { Client } = require('xhshow-js/dist/index.cjs');
const axios = require('axios');

async function test() {
  const signer = new Client();
  const uri = "/api/sns/web/v1/user_posted";
  // using a dummy user_id
  const userId = "5f17829e0000000001001395";
  const params = {
    num: 30,
    cursor: "",
    user_id: userId,
    image_formats: "jpg,webp,avif",
    xsec_token: "",
    xsec_source: "pc_user"
  };
  
  // dummy a1
  const a1 = "188a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t";
  const cookieStr = `a1=${a1}; web_session=12345;`;

  const xS = signer.signXS("GET", uri, a1, "xhs-pc-web", params);
  
  const apiHeaders = {
    'x-xhs-cookie': cookieStr,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
    'Referer': `https://www.xiaohongshu.com/user/profile/${userId}`,
    'x-s': xS,
    'x-t': String(Date.now()),
    'x-s-common': xS
  };
  
  const targetApiUrl = `https://www.xiaohongshu.com${uri}?` + new URLSearchParams(params).toString();
  const apiProxyUrl = `https://autopost-app-one.vercel.app/api/xhs-proxy?url=${encodeURIComponent(targetApiUrl)}`;
  
  try {
    const res = await axios.get(apiProxyUrl, { headers: apiHeaders });
    console.log("RESPONSE:", res.data);
  } catch (err) {
    console.error("ERROR:", err.response?.data || err.message);
  }
}
test();
