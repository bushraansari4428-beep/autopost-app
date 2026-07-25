// relay-server.js — the ONLY code in this entire system that talks to Meta from genuine residential/home IP
import express from 'express';
const app = express();
const APP_ID = '936619743392459';
const SHARED_SECRET = process.env.RELAY_SECRET || 'autopost-secret-key-2026'; // Shared with Render

app.use((req, res, next) => {
  const incomingKey = req.headers['x-relay-key'] || req.query.key;
  if (incomingKey && incomingKey !== SHARED_SECRET) {
    console.warn(`[RELAY WARN] Unauthorized request rejected.`);
    return res.sendStatus(403);
  }
  next();
});

// --- THE BUG FIX & STRICT SINGLE SOURCE OF TRUTH FOR SHORTCODES ---
// Rejects thumbnail asset IDs (pt_xxxxx), raw numeric media IDs, and malformed matches.
function validateShortcode(code) {
  if (!code) return null;
  if (!/^[A-Za-z0-9_-]{10,11}$/.test(code)) return null;
  if (/^pt_/.test(code)) return null;
  if (/^\d+$/.test(code)) return null; // pure numeric = internal media ID, not a shortcode
  // Must contain both uppercase and lowercase letters to prevent random asset words
  if (!/[A-Z]/.test(code) || !/[a-z]/.test(code)) return null;
  return code;
}

// --- Problem 1: Polling ---
app.get('/latest', async (req, res) => {
  const { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username_required' });

  console.log(`[RELAY INFO] Polling latest Reel shortcode for @${username} via Residential IP...`);
  try {
    let shortcode = await pollViaGraphQL(username);
    if (!shortcode) {
      console.log(`[RELAY INFO] GraphQL missed or rate-limited for @${username}. Falling back to /embed/...`);
      shortcode = await pollViaEmbed(username);
    }
    if (!shortcode) return res.status(502).json({ error: 'no_shortcode_found' });
    
    console.log(`[RELAY SUCCESS] Found verified shortcode for @${username}: ${shortcode}`);
    res.json({ shortcode });
  } catch (e) {
    console.error(`[RELAY ERROR] /latest failed: ${e.message}`);
    res.status(502).json({ error: e.message });
  }
});

async function pollViaGraphQL(username) {
  try {
    const r = await fetch('https://www.instagram.com/graphql/query', {
      method: 'POST',
      headers: {
        'X-IG-App-ID': APP_ID,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
      },
      body: new URLSearchParams({
        doc_id: '9310670392322965', // PolarisProfilePostsQuery (rotate if deprecated)
        variables: JSON.stringify({ username, first: 1 }),
      }),
    });
    if (!r.ok) return null;
    const json = await r.json();
    const edge = json?.data?.user?.edge_owner_to_timeline_media?.edges?.[0]?.node;
    return validateShortcode(edge?.shortcode);
  } catch (e) {
    return null;
  }
}

// Fallback: the public embed widget page — lighter, less aggressively firewalled
async function pollViaEmbed(username) {
  try {
    const r = await fetch(`https://www.instagram.com/${username}/embed/`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36', 
        'X-IG-App-ID': APP_ID 
      },
    });
    const html = await r.text();
    // STRICT extraction: only trust canonical og:url tag, never loose regex over full HTML
    const match = html.match(/property="og:url"\s+content="https:\/\/www\.instagram\.com\/(?:reel|p)\/([^"/]+)\/?"/i);
    return validateShortcode(match?.[1]);
  } catch (e) {
    return null;
  }
}

// --- Problem 2: MP4 resolution (same Discordbot pattern with multi-mirror rotation) ---
app.get('/resolve', async (req, res) => {
  const { shortcode } = req.query;
  const validCode = validateShortcode(shortcode);
  if (!validCode) return res.status(400).json({ error: 'invalid_shortcode' });

  console.log(`[RELAY INFO] Resolving MP4 stream for shortcode [${validCode}]...`);

  const mirrors = [
    `https://kkinstagram.com/reel/${validCode}/`,
    `https://ddinstagram.com/reel/${validCode}/`,
    `https://g.ddinstagram.com/reel/${validCode}/`
  ];

  for (const target of mirrors) {
    try {
      const r = await fetch(target, {
        redirect: 'follow',
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' },
      });
      if (r.ok) {
        // Direct MP4 stream URL check
        if (r.url.includes('.mp4') || r.url.includes('cdninstagram.com') || r.headers.get('content-type')?.includes('video/')) {
          console.log(`[RELAY SUCCESS] Resolved MP4 directly via redirect from ${target}`);
          return res.json({ mp4_url: r.url });
        }
        const html = await r.text();
        const match =
          html.match(/property="og:video(?::secure_url)?"\s+content="([^"]+)"/) ||
          html.match(/<video[^>]+src="([^"]+)"/);
        if (match && match[1]) {
          console.log(`[RELAY SUCCESS] Extracted og:video MP4 from ${target}`);
          return res.json({ mp4_url: match[1].replace(/&amp;/g, '&') });
        }
      }
    } catch (e) {
      console.warn(`[RELAY WARN] Mirror ${target} failed: ${e.message}`);
    }
  }

  res.status(502).json({ error: 'mp4_not_found_on_any_mirror' });
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => console.log(`🚀 IG Residential Relay server listening on port :${PORT}`));
