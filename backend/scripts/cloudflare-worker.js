export default {
  async fetch(request) {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");
    const shortcode = url.searchParams.get("shortcode");

    if (!username && !shortcode) {
      return new Response(JSON.stringify({ error: "Username or shortcode required" }), { 
        status: 400, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };

    // ==========================================
    // 1. EXTRACT MP4 STREAM BY SHORTCODE
    // ==========================================
    if (shortcode) {
      // Primary Mirror: kkinstagram (Discord Bot Unfurling Relay - 100% Verified)
      try {
        const kkRes = await fetch(`https://kkinstagram.com/reel/${shortcode}/`, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)" },
          redirect: "follow"
        });
        if (kkRes.ok && (kkRes.headers.get("content-type")?.includes("video/") || kkRes.url.includes(".mp4") || kkRes.url.includes("cdninstagram.com"))) {
          return new Response(JSON.stringify({ success: true, source: "kkinstagram", mp4_url: kkRes.url }), { 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
          });
        }
      } catch (e) {}

      // Secondary Mirror: Imginn
      try {
        const imgRes = await fetch(`https://imginn.com/p/${shortcode}/`, { headers });
        if (imgRes.ok) {
          const html = await imgRes.text();
          const mp4Match = html.match(/href="([^"]+cdninstagram[^"]+\.mp4[^"]*)"/i) || html.match(/(https?:\/\/[^"'\s]+cdninstagram[^"'\s]+\.mp4[^"'\s]*)/i);
          if (mp4Match && mp4Match[1]) {
            const cleanUrl = mp4Match[1].replace(/&#38;/g, '&').replace(/&amp;/g, '&');
            return new Response(JSON.stringify({ success: true, source: "imginn", mp4_url: cleanUrl }), { 
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            });
          }
        }
      } catch (e) {}

      // Fallback: Meta internal post API with anonymous handshake
      try {
        const authHeaders = await getAuthHeaders();
        const igUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
        const igResponse = await fetch(igUrl, { headers: authHeaders });
        if (igResponse.ok) {
          const data = await igResponse.json();
          const items = data.items || data?.graphql?.shortcode_media;
          const videoUrl = items?.[0]?.video_versions?.[0]?.url || items?.video_url;
          if (videoUrl) {
            return new Response(JSON.stringify({ success: true, source: "meta_api", mp4_url: videoUrl, data }), { 
              headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
            });
          }
        }
      } catch (e) {}

      return new Response(JSON.stringify({ error: "Failed to extract video MP4 from edge mirrors and internal APIs" }), { 
        status: 404, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }

    // ==========================================
    // 2. POLL PROFILE FOR LATEST REEL SHORTCODE
    // ==========================================
    if (username) {
      const profileMirrors = [
        { name: "Imginn", url: `https://imginn.com/${username}/` },
        { name: "Picnob", url: `https://www.picnob.com/profile/${username}/` },
        { name: "Dumpor", url: `https://dumpoir.com/v/${username}` },
        { name: "Greatfon", url: `https://greatfon.com/v/${username}` },
        { name: "Anonymously", url: `https://anonymously.io/profile/${username}/` }
      ];

      for (const m of profileMirrors) {
        try {
          const res = await fetch(m.url, { headers });
          if (res.ok) {
            const html = await res.text();
            // Filter out invalid purely numeric node IDs or common system words
            const regex = /(?:\/p\/|\/reel\/|\/post\/|shortcode["':\s]+)([A-Za-z0-9_-]{10,12})/gi;
            let match;
            while ((match = regex.exec(html)) !== null) {
              const code = match[1];
              if (!/^[0-9]+$/.test(code) && !/^(reels|posts|stories|profile|explore|tagged|highlights)$/i.test(code)) {
                return new Response(JSON.stringify({ 
                  success: true, 
                  source: m.name, 
                  shortcode: code, 
                  url: `https://www.instagram.com/reel/${code}/` 
                }), { 
                  headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
                });
              }
            }
          }
        } catch (e) {}
      }

      // Fallback: Meta internal profile API
      try {
        const authHeaders = await getAuthHeaders();
        const igUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        const igResponse = await fetch(igUrl, { headers: authHeaders });
        if (igResponse.ok) {
          const data = await igResponse.json();
          return new Response(JSON.stringify(data), { 
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
          });
        }
      } catch (e) {}

      return new Response(JSON.stringify({ error: `Could not find any videos for profile @${username} via edge mirrors and internal APIs` }), { 
        status: 404, 
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } 
      });
    }
  },
};

async function getAuthHeaders() {
  const baseHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "x-ig-app-id": "936619743392459",
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
  };
  try {
    const initRes = await fetch("https://www.instagram.com/api/v1/si/fetch_headers/", { headers: baseHeaders });
    const rawCookies = initRes.headers.get("set-cookie") || "";
    const midMatch = rawCookies.match(/mid=([^;]+)/);
    const csrfMatch = rawCookies.match(/csrftoken=([^;]+)/);
    const igDidMatch = rawCookies.match(/ig_did=([^;]+)/);
    const guestCookies = [
      midMatch ? `mid=${midMatch[1]}` : "",
      csrfMatch ? `csrftoken=${csrfMatch[1]}` : "",
      igDidMatch ? `ig_did=${igDidMatch[1]}` : "",
    ].filter(Boolean).join("; ");
    return {
      ...baseHeaders,
      "Cookie": guestCookies,
      "x-csrftoken": csrfMatch ? csrfMatch[1] : "",
    };
  } catch (e) {
    return baseHeaders;
  }
}
