const APP_ID = '936619743392459';
const username = 'moromorotv';

async function testGraphQL() {
  console.log(`Testing Node.js fetch for GraphQL PolarisProfilePostsQuery against @${username}...`);
  try {
    const r = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST',
      headers: {
        'X-IG-App-ID': APP_ID,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      },
      body: new URLSearchParams({
        doc_id: '9310670392322965',
        variables: JSON.stringify({ username, first: 3 }),
      }),
    });
    console.log(`Status: ${r.status}`);
    const text = await r.text();
    console.log("Response text start:", text.substring(0, 300));
    try {
      const json = JSON.parse(text);
      const edges = json?.data?.user?.edge_owner_to_timeline_media?.edges || [];
      console.log(`Found ${edges.length} edges!`);
      if (edges.length > 0) {
        console.log("✅ LATEST REEL SHORTCODE:", edges[0]?.node?.shortcode);
      }
    } catch (e) {}
  } catch (e) {
    console.error("Error:", e.message);
  }
}

testGraphQL();
