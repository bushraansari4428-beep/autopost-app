async function testSingleNote() {
  const url = "https://xhslink.cn/m/5pQ3umOZjni";
  const proxyUrl = `https://autopost-app-one.vercel.app/api/xhs-proxy?url=${encodeURIComponent(url)}`;
  
  console.log("Fetching Note via proxy:", proxyUrl);
  try {
    const res = await fetch(proxyUrl);
    const html = await res.text();
    
    const fs = require('fs');
    fs.writeFileSync('scratch/profile_raw.html', html);
    console.log("Saved raw HTML to scratch/profile_raw.html");
  } catch (e) {
    console.error(e);
  }
}
testSingleNote();
