"""
Web Browser & Search Tool
Provides web search, page reading, and live browser control.
"""

import json
import urllib.parse
import requests

class BrowserTool:
    def __init__(self):
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        }

    def search_web(self, query: str, max_results: int = 5) -> dict:
        """Search the web using DuckDuckGo Instant Answer and HTML search."""
        try:
            encoded = urllib.parse.quote_plus(query)
            url = f"https://html.duckduckgo.com/html/?q={encoded}"
            res = requests.get(url, headers=self.headers, timeout=12)
            
            import re
            results = []
            snippets = re.findall(r'<a class="result__snippet[^>]*>(.*?)</a>', res.text, re.DOTALL)
            titles = re.findall(r'<a class="result__url[^>]*href="([^"]+)"[^>]*>(.*?)</a>', res.text, re.DOTALL)
            
            for i in range(min(len(snippets), max_results)):
                clean_snippet = re.sub(r'<[^>]+>', '', snippets[i]).strip()
                results.append({
                    "title": f"Result {i+1}",
                    "snippet": clean_snippet
                })

            if not results:
                # Fallback to general API
                api_url = f"https://api.duckduckgo.com/?q={encoded}&format=json"
                r = requests.get(api_url, timeout=10).json()
                abstract = r.get("AbstractText", "")
                if abstract:
                    results.append({"title": r.get("Heading", "Answer"), "snippet": abstract})

            return {
                "success": True,
                "query": query,
                "results": results,
                "summary": "\n".join([f"- {r['snippet']}" for r in results[:4]]) if results else "No direct results found."
            }

        except Exception as e:
            return {"success": False, "error": str(e)}

    def read_webpage(self, url: str) -> dict:
        """Fetch and extract readable text from any website."""
        try:
            if not url.startswith("http"):
                url = "https://" + url
            res = requests.get(url, headers=self.headers, timeout=15)
            import re
            # Strip scripts, styles, and tags
            text = re.sub(r'<script[\s\S]*?</script>', '', res.text, flags=re.IGNORECASE)
            text = re.sub(r'<style[\s\S]*?</style>', '', text, flags=re.IGNORECASE)
            text = re.sub(r'<[^>]+>', ' ', text)
            clean_text = ' '.join(text.split())[:2000] # First 2000 chars

            return {
                "success": True,
                "url": url,
                "content": clean_text
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

browser_tool = BrowserTool()
