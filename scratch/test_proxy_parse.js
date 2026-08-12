async function testProxy() {
  const shareUrl = "https://xhslink.cn/m/5pQ3umOZjni"; // The one from user's screenshot
  const proxyUrl = `https://autopost-app-one.vercel.app/api/xhs-proxy?url=${encodeURIComponent(shareUrl)}`;
  
  console.log("Fetching proxy:", proxyUrl);
  try {
    const res = await fetch(proxyUrl);
    const html = await res.text();
    
    let targetUrl = res.headers.get('x-final-url') || shareUrl;
    console.log("Final URL:", targetUrl);
    
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s);
    if (stateMatch) {
      const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
      
      const isProfile = targetUrl.includes('/user/profile/');
      if (isProfile) {
        console.log("Is Profile. Checking latest notes...");
        const userNotesRaw = state?.user?.notes ?? state?.user?.noteList ?? state?.user?.profile?.notes ?? [];
        if (userNotesRaw.length > 0) {
          console.log("First Note dump:", JSON.stringify(userNotesRaw[0], null, 2).substring(0, 2000));
        }
      } else {
        const noteMap = state?.note?.noteDetailMap ?? state?.noteData ?? {};
        const firstNoteKey = Object.keys(noteMap)[0];
        const noteObj = noteMap[firstNoteKey]?.note ?? {};
        
        console.log("Note Type:", noteObj.type);
        console.log("Video Object:", JSON.stringify(noteObj.video, null, 2));
      }
    } else {
      console.log("No INITIAL_STATE found.");
    }
  } catch (e) {
    console.error(e);
  }
}

testProxy();
