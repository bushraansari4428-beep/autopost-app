"""
Web Browser & Live Search Tool
Uses modern TLS-impersonated Search Engine (DuckDuckGo via curl_cffi + Bing fallback)
for 100% reliable, unblocked, real-time live web searching.
"""

import json
import urllib.parse
import re
import html
try:
    from curl_cffi import requests as curl_requests
except ImportError:
    curl_requests = None
import requests

class BrowserTool:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
        }

    def search_web(self, query: str, max_results: int = 5) -> dict:
        """Search the live web for real-time snippets."""
        # 1. Try DuckDuckGo via curl_cffi (bypass Cloudflare/bot challenges)
        if curl_requests:
            try:
                encoded = urllib.parse.quote_plus(query)
                url = f"https://html.duckduckgo.com/html/?q={encoded}"
                res = curl_requests.get(url, impersonate="chrome120", timeout=12)
                if res.status_code == 200 and "challenge" not in res.text.lower():
                    raw_snippets = re.findall(r'<a class="result__snippet"[^>]*>(.*?)</a>', res.text, re.DOTALL)
                    snippets = []
                    for s in raw_snippets:
                        clean = html.unescape(re.sub(r'<[^>]+>', '', s)).strip()
                        if len(clean) > 20 and clean not in snippets:
                            snippets.append(clean)

                    if snippets:
                        top = snippets[:max_results]
                        return {
                            "success": True,
                            "query": query,
                            "results": [{"snippet": s} for s in top],
                            "summary": "\n".join([f"• {s}" for s in top])
                        }
            except Exception:
                pass

        # 2. Fallback to Bing Search
        try:
            encoded = urllib.parse.quote_plus(query)
            url = f"https://www.bing.com/search?q={encoded}"
            res = requests.get(url, headers=self.headers, timeout=12)
            
            snippets = []
            raw_p = re.findall(r'<p[^>]*>(.*?)</p>', res.text)
            for p in raw_p:
                clean = html.unescape(re.sub(r'<[^>]+>', '', p)).strip()
                if len(clean) > 30 and not clean.startswith("Copyright") and not clean.startswith("Feedback"):
                    if clean not in snippets:
                        snippets.append(clean)

            top = snippets[:max_results]
            return {
                "success": True if top else False,
                "query": query,
                "results": [{"snippet": s} for s in top],
                "summary": "\n".join([f"• {s}" for s in top]) if top else "No direct results found."
            }
        except Exception as e:
            return {"success": False, "error": str(e), "results": [], "summary": f"Search error: {e}"}

    def read_webpage(self, url: str) -> dict:
        """Fetch and extract readable text from any website."""
        try:
            if not url.startswith("http"):
                url = "https://" + url
            
            getter = curl_requests.get if curl_requests else requests.get
            kw = {"impersonate": "chrome120"} if curl_requests else {"headers": self.headers}
            res = getter(url, timeout=15, **kw)
            
            # Strip scripts, styles, and tags
            text = re.sub(r'<script[\s\S]*?</script>', '', res.text, flags=re.IGNORECASE)
            text = re.sub(r'<style[\s\S]*?</style>', '', text, flags=re.IGNORECASE)
            text = re.sub(r'<[^>]+>', ' ', text)
            clean_text = ' '.join(html.unescape(text).split())[:2000]

            return {
                "success": True,
                "url": url,
                "content": clean_text
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

browser_tool = BrowserTool()
