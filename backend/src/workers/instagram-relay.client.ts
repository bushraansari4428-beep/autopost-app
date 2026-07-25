import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class InstagramRelayClient {
  private readonly logger = new Logger(InstagramRelayClient.name);

  /**
   * Rejects thumbnail asset IDs (pt_xxxxx), raw numeric media IDs, and malformed matches.
   * Centralized validation - the single source of truth for shortcodes.
   */
  public validateShortcode(code?: string | null): string | null {
    if (!code) return null;
    const clean = code.trim();
    if (!/^[A-Za-z0-9_-]{10,11}$/.test(clean)) return null;
    if (/^(pt|vd|th|pb|im|px|sp)_/i.test(clean)) return null;
    if (/^\d+$/.test(clean)) return null; // pure numeric = internal media ID, not a shortcode
    // Must contain both uppercase and lowercase letters
    if (!/[A-Z]/.test(clean) || !/[a-z]/.test(clean)) return null;
    if (/^(reels|posts|stories|profile|explore|tagged|highlights|Montserrat)$/i.test(clean)) return null;
    return clean;
  }

  /**
   * Polls the residential relay or edge fallback for the latest shortcode of a given IG username.
   */
  public async getLatestShortcode(username: string): Promise<{ shortcode: string; source: string } | null> {
    const relayBase = process.env.IG_RELAY_URL;
    const relayKey = process.env.IG_RELAY_SECRET || 'autopost-secret-key-2026';

    // 1. Try Residential Cloudflare Tunnel Relay (if configured)
    if (relayBase) {
      try {
        let baseUrl = relayBase.trim().replace(/\/$/, '');
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
        this.logger.log(`[IG Relay Client] Requesting shortcode from Residential Relay for @${username}...`);
        const res = await fetch(`${baseUrl}/latest?username=${username}`, {
          headers: { 'x-relay-key': relayKey }
        });
        if (res.ok) {
          const data = await res.json();
          const code = this.validateShortcode(data?.shortcode);
          if (code) {
            this.logger.log(`[IG Relay Client] ✅ Got verified shortcode [${code}] from Residential Relay!`);
            return { shortcode: code, source: 'IG_Residential_Relay' };
          }
        }
      } catch (e: any) {
        this.logger.warn(`[IG Relay Client] Residential Relay polling failed: ${e.message}`);
      }
    }

    // 2. Try Cloudflare Edge Worker (if configured and relay missed)
    const igWorkerUrl = process.env.IG_WORKER_URL;
    if (igWorkerUrl) {
      try {
        let baseUrl = igWorkerUrl.trim().replace(/\/$/, '');
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
        this.logger.log(`[IG Relay Client] Falling back to Edge Worker for @${username}...`);
        const res = await fetch(`${baseUrl}?username=${username}`);
        if (res.ok) {
          const data = await res.json();
          const code = this.validateShortcode(data?.shortcode);
          if (code) {
            this.logger.log(`[IG Relay Client] ✅ Got verified shortcode [${code}] from Edge Worker!`);
            return { shortcode: code, source: `Edge_Worker_${data?.source || ''}` };
          }
        }
      } catch (e: any) {
        this.logger.warn(`[IG Relay Client] Edge Worker fallback failed: ${e.message}`);
      }
    }

    // 3. Try DuckDuckGo Unblockable Index directly from Backend
    try {
      this.logger.log(`[IG Relay Client] Exploring DuckDuckGo index for @${username}...`);
      const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent('site:instagram.com/reel/ OR site:instagram.com/p/ ' + username)}`;
      const res = await fetch(ddgUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
      });
      if (res.ok) {
        const html = await res.text();
        const regex = /instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]{10,11})/gi;
        let m;
        while ((m = regex.exec(html)) !== null) {
          const code = this.validateShortcode(m[1]);
          if (code) {
            this.logger.log(`[IG Relay Client] ✅ Got verified shortcode [${code}] via direct DuckDuckGo search index!`);
            return { shortcode: code, source: 'DDG_Search_Index' };
          }
        }
      }
    } catch (e: any) {
      this.logger.warn(`[IG Relay Client] DDG Index fallback failed: ${e.message}`);
    }

    return null;
  }

  /**
   * Resolves direct playable MP4 URL for a valid shortcode via Relay or Edge fallback.
   */
  public async resolveMp4(shortcode: string): Promise<{ mp4Url: string; source: string } | null> {
    const validCode = this.validateShortcode(shortcode);
    if (!validCode) {
      this.logger.error(`[IG Relay Client] Aborting MP4 resolution for invalid shortcode candidate: ${shortcode}`);
      return null;
    }

    const relayBase = process.env.IG_RELAY_URL;
    const relayKey = process.env.IG_RELAY_SECRET || 'autopost-secret-key-2026';

    // 1. Try Residential Relay
    if (relayBase) {
      try {
        let baseUrl = relayBase.trim().replace(/\/$/, '');
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
        this.logger.log(`[IG Relay Client] Resolving MP4 via Residential Relay for [${validCode}]...`);
        const res = await fetch(`${baseUrl}/resolve?shortcode=${validCode}`, {
          headers: { 'x-relay-key': relayKey }
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.mp4_url) {
            this.logger.log(`[IG Relay Client] ✅ Got direct MP4 stream from Residential Relay!`);
            return { mp4Url: data.mp4_url, source: 'IG_Residential_Relay' };
          }
        }
      } catch (e: any) {
        this.logger.warn(`[IG Relay Client] Residential Relay MP4 resolution failed: ${e.message}`);
      }
    }

    // 2. Try Direct Mirrors (kkinstagram / ddinstagram rotation)
    const mirrors = [
      { name: 'kkinstagram', url: `https://kkinstagram.com/reel/${validCode}/` },
      { name: 'ddinstagram', url: `https://ddinstagram.com/reel/${validCode}/` },
      { name: 'g.ddinstagram', url: `https://g.ddinstagram.com/reel/${validCode}/` }
    ];

    for (const m of mirrors) {
      try {
        this.logger.log(`[IG Relay Client] Trying MP4 resolution via ${m.name}...`);
        const r = await fetch(m.url, {
          redirect: 'follow',
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)' }
        });
        if (r.ok) {
          if (r.url.includes('.mp4') || r.url.includes('cdninstagram.com') || r.headers.get('content-type')?.includes('video/')) {
            this.logger.log(`[IG Relay Client] ✅ Direct video redirect stream obtained from ${m.name}!`);
            return { mp4Url: r.url, source: m.name };
          }
        }
      } catch (e: any) {
        this.logger.warn(`[IG Relay Client] Mirror ${m.name} failed: ${e.message}`);
      }
    }

    // 3. Try Cloudflare Edge Worker
    const igWorkerUrl = process.env.IG_WORKER_URL;
    if (igWorkerUrl) {
      try {
        let baseUrl = igWorkerUrl.trim().replace(/\/$/, '');
        if (!baseUrl.startsWith('http')) baseUrl = `https://${baseUrl}`;
        this.logger.log(`[IG Relay Client] Requesting MP4 from Edge Worker for [${validCode}]...`);
        const res = await fetch(`${baseUrl}?shortcode=${validCode}`);
        if (res.ok) {
          const data = await res.json();
          if (data?.mp4_url) {
            this.logger.log(`[IG Relay Client] ✅ Extracted MP4 via Edge Worker fallback!`);
            return { mp4Url: data.mp4_url, source: `Edge_Worker_${data?.source || ''}` };
          }
        }
      } catch (e: any) {
        this.logger.warn(`[IG Relay Client] Edge Worker MP4 resolution failed: ${e.message}`);
      }
    }

    return null;
  }
}
