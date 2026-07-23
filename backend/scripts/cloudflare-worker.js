export default {
  async fetch(request) {
    const url = new URL(request.url);
    const username = url.searchParams.get("username");
    const shortcode = url.searchParams.get("shortcode");

    if (!username && !shortcode) {
      return new Response(JSON.stringify({ error: "Username or shortcode required" }), { status: 400 });
    }

    const headers = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "x-ig-app-id": "936619743392459", // Required public web client ID
      "Accept": "*/*",
      "Accept-Language": "en-US,en;q=0.9",
    };

    try {
      if (shortcode) {
        // Fetch specific post info
        const igUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;
        const igResponse = await fetch(igUrl, { headers });
        if (!igResponse.ok) {
          return new Response(JSON.stringify({ error: "Instagram blocked or post not found" }), { status: igResponse.status });
        }
        const data = await igResponse.json();
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }

      if (username) {
        // Fetch profile info
        const igUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${username}`;
        const igResponse = await fetch(igUrl, { headers });
        if (!igResponse.ok) {
          return new Response(JSON.stringify({ error: "Instagram blocked or user not found" }), { status: igResponse.status });
        }
        const data = await igResponse.json();
        return new Response(JSON.stringify(data), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
        });
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  },
};
