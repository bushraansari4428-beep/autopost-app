async function testSingleNote() {
  const url = "https://xhslink.cn/m/28GJE7zgSxL";
  const proxyUrl = `https://autopost-app-one.vercel.app/api/xhs-proxy?url=${encodeURIComponent(url)}`;
  
  console.log("Fetching Note via proxy:", proxyUrl);
  try {
    const res = await fetch(proxyUrl);
    const html = await res.text();
    
    const stateMatch = html.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\});?</s);
    if (stateMatch) {
      const state = JSON.parse(stateMatch[1].replace(/undefined/g, 'null'));
      const userNotesRaw = state?.user?.notes ?? state?.user?.noteList ?? state?.user?.profile?.notes ?? [];
      if (userNotesRaw.length > 0) {
        console.log("Found notes:", userNotesRaw.length);
        console.log("First NoteCard ID fields:", {
          id: userNotesRaw[0].id,
          noteId: userNotesRaw[0].noteCard?.noteId,
          xsecToken: userNotesRaw[0].noteCard?.xsecToken
        });
      } else {
        console.log("No notes found in state.");
      }
    } else {
      console.log("No INITIAL_STATE found.");
    }
  } catch (e) {
    console.error(e);
  }
}
testSingleNote();
