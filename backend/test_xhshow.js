const axios = require("axios");

function getCookieValue(cookieString, name) {
  const match = cookieString.match(new RegExp(`(?:^|;\\s*)${name}=([^;]*)`));
  return match ? match[1] : "";
}

async function testSign() {
  const { Client } = await import("xhshow-js");
  const signer = new Client();
  
  const userId = "6116fdf2000000000100548a"; // ID from user's shortlink
  // Replace this with a valid XHS cookie (a1 is required)
  const cookie = "a1=191456a1b1aw0y99g71baxd1rblgxwlz97x8cblud30000105370; web_session=030037a34651df986ec39d48b1224a1e9411bc;"; // Example, will need real one
  
  const a1 = getCookieValue(cookie, "a1");
  if (!a1) {
    console.error("XHS a1 cookie missing");
    return;
  }

  const uri = "/api/sns/web/v1/user_posted";
  const params = {
    num: 30,
    cursor: "",
    user_id: userId,
    image_formats: "jpg,webp,avif",
    xsec_token: "",
    xsec_source: "pc_user"
  };

  const xS = signer.signXS("GET", uri, a1, "xhs-pc-web", params);
  
  console.log("Generated X-s:", xS);

  const headers = {
    Cookie: cookie,
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
    "Referer": `https://www.xiaohongshu.com/user/profile/${userId}`,
    "x-s": xS,
    "x-t": String(Date.now()),
    "x-s-common": xS // Sometimes required based on AI suggestion
  };

  try {
    const proxyBase = "https://autopost-app-one.vercel.app";
    // We send to Proxy directly using the proxy's URL format.
    // Wait, the proxy on Vercel is just a simple Next.js API route that expects `?url=...`.
    // It doesn't dynamically map `/api/sns/...` unless configured.
    // Let's use the explicit target URL:
    const targetUrl = `https://www.xiaohongshu.com${uri}?` + new URLSearchParams(params).toString();
    const proxyUrl = `${proxyBase}/api/xhs-proxy?url=${encodeURIComponent(targetUrl)}`;

    console.log("Fetching:", proxyUrl);
    
    const res = await axios.get(proxyUrl, { headers });
    console.log("Response:", JSON.stringify(res.data).substring(0, 500));
  } catch (error) {
    console.error("Error:", error.response ? error.response.data : error.message);
  }
}

testSign();
