# relay-server.py — Python Residential Relay Server (Zero dependencies required!)
import http.server
import urllib.parse
import urllib.request
import json
import re
import sys

PORT = 8787
APP_ID = '936619743392459'
SHARED_SECRET = 'autopost-secret-key-2026'

def validate_shortcode(code):
    if not code:
        return None
    code = code.strip()
    if not re.match(r'^[A-Za-z0-9_-]{10,11}$', code):
        return None
    if re.match(r'^(pt|vd|th|pb|im|px|sp)_', code, re.I):
        return None
    if re.match(r'^\d+$', code):
        return None
    if not (re.search(r'[A-Z]', code) and re.search(r'[a-z]', code)):
        return None
    if re.match(r'^(reels|posts|stories|profile|explore|tagged|highlights|Montserrat)$', code, re.I):
        return None
    return code

def poll_via_graphql(username):
    url = 'https://www.instagram.com/graphql/query'
    headers = {
        'X-IG-App-ID': APP_ID,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': '*/*'
    }
    data = urllib.parse.urlencode({
        'doc_id': '9310670392322965',
        'variables': json.dumps({'username': username, 'first': 1})
    }).encode('utf-8')
    try:
        req = urllib.request.Request(url, data=data, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as res:
            json_data = json.loads(res.read().decode('utf-8', errors='ignore'))
            edges = json_data.get('data', {}).get('user', {}).get('edge_owner_to_timeline_media', {}).get('edges', [])
            if edges:
                return validate_shortcode(edges[0].get('node', {}).get('shortcode'))
    except Exception as e:
        pass
    return None

def poll_via_ddg(username):
    query = f'site:instagram.com/reel/ OR site:instagram.com/p/ {username}'
    url = f"https://html.duckduckgo.com/html/?q={urllib.parse.quote(query)}"
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9'
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as res:
            html = res.read().decode('utf-8', errors='ignore')
            matches = re.findall(r'instagram\.com/(?:reel|p)/([A-Za-z0-9_-]{10,11})', html, re.I)
            for m in matches:
                code = validate_shortcode(m)
                if code:
                    print(f"[RELAY INFO] DuckDuckGo discovered shortcode: {code}")
                    return code
    except Exception as e:
        print(f"[RELAY WARN] DDG search failed: {e}")
    return None

def poll_via_embed(username):
    url = f'https://www.instagram.com/{username}/embed/'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'X-IG-App-ID': APP_ID,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=8) as res:
            html = res.read().decode('utf-8', errors='ignore')
            match = re.search(r'property="og:url"\s+content="https://www\.instagram\.com/(?:reel|p)/([^"/]+)/?"', html, re.I)
            code = validate_shortcode(match.group(1)) if match else None
            if not code:
                # Also check any 11-char strings in links
                for m in re.findall(r'/(?:p|reel|tv)/([A-Za-z0-9_-]{11})/', html):
                    c = validate_shortcode(m)
                    if c: return c
            return code
    except Exception as e:
        pass
    return None

def resolve_mp4(shortcode):
    code = validate_shortcode(shortcode)
    if not code:
        return None
    mirrors = [
        f'https://kkinstagram.com/reel/{code}/',
        f'https://ddinstagram.com/reel/{code}/',
        f'https://g.ddinstagram.com/reel/{code}/'
    ]
    headers = {'User-Agent': 'Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordapp.com)'}
    for url in mirrors:
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=10) as res:
                final_url = res.geturl()
                if '.mp4' in final_url or 'cdninstagram.com' in final_url or 'video/' in res.headers.get('content-type', ''):
                    print(f"[RELAY SUCCESS] Direct video stream from {url} -> {final_url[:50]}...")
                    return final_url
                html = res.read().decode('utf-8', errors='ignore')
                match = re.search(r'property="og:video(?::secure_url)?"\s+content="([^"]+)"', html)
                if not match:
                    match = re.search(r'<video[^>]+src="([^"]+)"', html)
                if match and match.group(1):
                    mp4 = match.group(1).replace('&amp;', '&')
                    print(f"[RELAY SUCCESS] Extracted og:video from {url}")
                    return mp4
        except Exception as e:
            print(f"[RELAY WARN] Mirror {url} failed: {e}")
    return None

class RelayHandler(http.server.BaseHTTPRequestHandler):
    def send_json(self, status, data):
        self.send_response(status)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(json.dumps(data).encode('utf-8'))

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        
        # Check authorization header
        auth_header = self.headers.get('x-relay-key') or (params.get('key', [None])[0])
        if auth_header and auth_header != SHARED_SECRET:
            print("[RELAY WARN] Unauthorized access attempt blocked.")
            self.send_response(403)
            self.end_headers()
            return

        if parsed.path == '/latest':
            username = params.get('username', [''])[0]
            if not username:
                return self.send_json(400, {'error': 'username_required'})
            print(f"[RELAY INFO] Polling latest Reel shortcode for @{username} via Residential IP & DDG Index...")
            shortcode = poll_via_ddg(username) or poll_via_graphql(username) or poll_via_embed(username)
            if shortcode:
                print(f"[RELAY SUCCESS] Found verified shortcode for @{username}: {shortcode}")
                return self.send_json(200, {'shortcode': shortcode})
            else:
                print(f"[RELAY ERROR] No shortcode found for @{username}.")
                return self.send_json(502, {'error': 'no_shortcode_found'})

        elif parsed.path == '/resolve':
            shortcode = params.get('shortcode', [''])[0]
            if not shortcode:
                return self.send_json(400, {'error': 'shortcode_required'})
            print(f"[RELAY INFO] Resolving MP4 stream for shortcode [{shortcode}]...")
            mp4_url = resolve_mp4(shortcode)
            if mp4_url:
                return self.send_json(200, {'mp4_url': mp4_url})
            else:
                return self.send_json(502, {'error': 'mp4_not_found'})
        else:
            self.send_json(404, {'error': 'endpoint_not_found'})

    def log_message(self, format, *args):
        # Clean logging
        sys.stdout.write(f"[{self.log_date_time_string()}] {format % args}\n")

if __name__ == '__main__':
    server_address = ('', PORT)
    httpd = http.server.HTTPServer(server_address, RelayHandler)
    print(f"============================================================")
    print(f"[START] Python IG Residential Relay listening on port :{PORT}")
    print(f"        Zero dependencies required! Ready for Cloudflare Tunnel.")
    print(f"============================================================")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down relay server...")
        httpd.server_close()
