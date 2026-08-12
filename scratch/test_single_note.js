async function testMethod1() {
  const targetUrl = "https://www.xiaohongshu.com/user/profile/6116fdf2000000000100548a";
  const proxyUrl = `https://autopost-app-one.vercel.app/api/xhs-proxy?url=${encodeURIComponent(targetUrl)}`;
  
  try {
    const res = await fetch(proxyUrl);
    const html = await res.text();
    
    require('fs').writeFileSync('xhs_profile.html', html);
    console.log("Saved to xhs_profile.html");
  } catch(e) {
    console.error(e);
  }
}
testMethod1();
