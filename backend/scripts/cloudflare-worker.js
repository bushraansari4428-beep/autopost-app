export default {
  async fetch(request) {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");
    const shortcode = url.searchParams.get("shortcode");

    if (!username && !shortcode) {
      return new Response(JSON.stringify({ error: "Username or shortcode required" }), { status: 400 });
    }

    const baseHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "x-ig-app-id": "936619743392459",
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };

    try {
      // Step 1: Handshake request to generate anonymous guest tokens
      const initRes = await fetch("https://www.instagram.com/api/v1/si/fetch_headers/", { 
        headers: baseHeaders 
      });
      
      const rawCookies = initRes.headers.get("set-cookie") || "";
      const midMatch = rawCookies.match(/mid=([^;]+)/);
      const csrfMatch = rawCookies.match(/csrftoken=([^;]+)/);
      const igDidMatch = rawCookies.match(/ig_did=([^;]+)/);

      const guestCookies = [
        midMatch ? `mid=${midMatch[1]}` : "",
        csrfMatch ? `csrftoken=${csrfMatch[1]}` : "",
        igDidMatch ? `ig_did=${igDidMatch[1]}` : "",
      ].filter(Boolean).join("; ");

      const authHeaders = {
        ...baseHeaders,
        "Cookie": guestCookies,
        "x-csrftoken": csrfMatch ? csrfMatch[1] : "",
      };

      if (shortcode) {
        const igUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
        const igResponse = await fetch(igUrl, { headers: authHeaders });
        if (!igResponse.ok) return new Response(JSON.stringify({ error: "Post not found" }), { status: igResponse.status });
        const data = await igResponse.json();
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
      
      if (username) {
        const igUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        const igResponse = await fetch(igUrl, { headers: authHeaders });
        if (!igResponse.ok) return new Response(JSON.stringify({ error: "User not found" }), { status: igResponse.status });
        const data = await igResponse.json();
        return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};
