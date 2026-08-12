async function testDirectFetch() {
  const noteId = "1040g2sg323eq4od8nkkg5o8mvnp08l4ac2i9ato";
  const xsec = "ABhu_Cqz8_LewlXka4tu0shYDfjBGU05D8QZzxPVdXk0A=";
  const url = `https://www.xiaohongshu.com/explore/${noteId}?xsec_token=${xsec}&xsec_source=pc_feed`;

  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      }
    });
    
    const html = await res.text();
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s);
    if (stateMatch) {
      const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
      const map = state?.note?.noteDetailMap;
      if (map && map[noteId] && map[noteId].note) {
        console.log("Note keys:", Object.keys(map[noteId].note));
        console.log("Video:", !!map[noteId].note.video);
      } else {
        console.log("Note object is empty.");
      }
    } else {
      console.log("No INITIAL_STATE found.");
      const titleMatch = html.match(/<title>(.*?)<\/title>/);
      console.log("Page Title:", titleMatch ? titleMatch[1] : "Unknown");
    }
  } catch (e) {
    console.error(e.message);
  }
}

testDirectFetch();
