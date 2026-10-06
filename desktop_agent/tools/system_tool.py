"""
Universal System Automation Tool for Windows PC (2026 Edition)
Handles:
- Direct launch of Web Services (YouTube, Google, Facebook, WhatsApp, TikTok...)
- Urdu/Arabic/English Speech-to-Text variations (e.g. یوٹیوب, یوتوب, کرو کو یوتوب)
- Windows Desktop Applications (Chrome, Calculator, Notepad, Explorer, Settings...)
- In-Service Search Queries (e.g. YouTube search, Google search)
- Screenshots, Reminders, and Notes
"""

import os
import re
import subprocess
import threading
import time
import urllib.parse
import webbrowser
from datetime import datetime
from PIL import ImageGrab

SCREENSHOT_DIR = os.path.join(os.path.expanduser("~"), "Pictures", "AgentScreenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

TARGET_REGISTRY = {
    "youtube": {
        "name": "YouTube",
        "type": "web",
        "url": "https://www.youtube.com",
        "search_url": "https://www.youtube.com/results?search_query={query}",
        "aliases": [
            "youtube", "yt", "you tube", "utube", "u tube", "yotob",
            "یوٹیوب", "یوتوب", "یوٹوب", "یو ٹیوب", "یو ٹوب", "یُو ٹِیُوب", "یوٹیوب ڈاٹ کام"
        ]
    },
    "google": {
        "name": "Google",
        "type": "web",
        "url": "https://www.google.com",
        "search_url": "https://www.google.com/search?q={query}",
        "aliases": [
            "google", "googl", "goggle", "گوگل", "گو گل"
        ]
    },
    "facebook": {
        "name": "Facebook",
        "type": "web",
        "url": "https://www.facebook.com",
        "aliases": [
            "facebook", "fb", "face book", "فیس بک", "فیسبوک", "فیس بُک"
        ]
    },
    "whatsapp": {
        "name": "WhatsApp",
        "type": "web",
        "url": "https://web.whatsapp.com",
        "aliases": [
            "whatsapp", "whats app", "واٹس ایپ", "واٹسایپ", "وٹساپ", "واتساب", "واٹساپ"
        ]
    },
    "tiktok": {
        "name": "TikTok",
        "type": "web",
        "url": "https://www.tiktok.com",
        "search_url": "https://www.tiktok.com/search?q={query}",
        "aliases": [
            "tiktok", "tik tok", "ٹک ٹاک", "ٹکٹاک", "تک توک", "تکتوک"
        ]
    },
    "instagram": {
        "name": "Instagram",
        "type": "web",
        "url": "https://www.instagram.com",
        "aliases": [
            "instagram", "insta", "انسٹاگرام", "انسٹا گرام", "انسٹا"
        ]
    },
    "chatgpt": {
        "name": "ChatGPT",
        "type": "web",
        "url": "https://chatgpt.com",
        "aliases": [
            "chatgpt", "gpt", "chat gpt", "چٹ جی پی ٹی", "چیٹ جی پی ٹی"
        ]
    },
    "twitter": {
        "name": "X (Twitter)",
        "type": "web",
        "url": "https://x.com",
        "aliases": [
            "twitter", "x", "ٹویٹر", "تویتر"
        ]
    },
    "gmail": {
        "name": "Gmail",
        "type": "web",
        "url": "https://mail.google.com",
        "aliases": [
            "gmail", "email", "ای میل", "میل", "جی میل"
        ]
    },
    "github": {
        "name": "GitHub",
        "type": "web",
        "url": "https://github.com",
        "aliases": [
            "github", "گٹ ہب"
        ]
    },
    "netflix": {
        "name": "Netflix",
        "type": "web",
        "url": "https://www.netflix.com",
        "aliases": [
            "netflix", "نیٹ فلکس"
        ]
    },
    "daraz": {
        "name": "Daraz",
        "type": "web",
        "url": "https://www.daraz.pk",
        "search_url": "https://www.daraz.pk/catalog/?q={query}",
        "aliases": [
            "daraz", "دراز"
        ]
    },
    "spotify": {
        "name": "Spotify",
        "type": "web",
        "url": "https://open.spotify.com",
        "aliases": [
            "spotify", "سپوٹیفائی"
        ]
    },
    # Desktop Applications
    "chrome": {
        "name": "Google Chrome",
        "type": "app",
        "cmd": "start chrome",
        "aliases": [
            "chrome", "google chrome", "کروم", "گوگل کروم"
        ]
    },
    "calculator": {
        "name": "Calculator",
        "type": "app",
        "cmd": "calc",
        "aliases": [
            "calculator", "calc", "کیلکولیٹر", "کلکولیٹر"
        ]
    },
    "notepad": {
        "name": "Notepad",
        "type": "app",
        "cmd": "notepad",
        "aliases": [
            "notepad", "نوٹ پیڈ", "نوٹپیڈ"
        ]
    },
    "explorer": {
        "name": "File Explorer",
        "type": "app",
        "cmd": "explorer",
        "aliases": [
            "explorer", "file explorer", "files", "my computer", "فائلز", "مائی کمپیوٹر"
        ]
    },
    "taskmgr": {
        "name": "Task Manager",
        "type": "app",
        "cmd": "taskmgr",
        "aliases": [
            "task manager", "taskmgr", "ٹاسک مینیجر"
        ]
    },
    "settings": {
        "name": "Windows Settings",
        "type": "app",
        "cmd": "start ms-settings:",
        "aliases": [
            "settings", "سیٹنگز", "سیٹنگ"
        ]
    },
    "paint": {
        "name": "MS Paint",
        "type": "app",
        "cmd": "mspaint",
        "aliases": [
            "paint", "mspaint", "پینٹ"
        ]
    },
    "cmd": {
        "name": "Command Prompt",
        "type": "app",
        "cmd": "start cmd",
        "aliases": [
            "cmd", "command prompt", "terminal", "powershell"
        ]
    },
    "vscode": {
        "name": "Visual Studio Code",
        "type": "app",
        "cmd": "code",
        "aliases": [
            "vscode", "vs code", "code", "وی ایس کوڈ"
        ]
    },
    "vlc": {
        "name": "VLC Media Player",
        "type": "app",
        "cmd": "start vlc",
        "aliases": [
            "vlc", "وی ایل سی"
        ]
    }
}

class SystemTool:
    def __init__(self):
        self.reminders = []
        self.registry = TARGET_REGISTRY

    def resolve_and_execute(self, prompt: str) -> dict:
        """
        Intelligently resolves user instruction to web service or PC app.
        Handles speech-to-text variations (e.g. 'کرو کو یوتوب', 'یوٹیوب اوپن کرو', 'youtube open karo').
        Never triggers raw Windows cmd error popups.
        """
        p_clean = prompt.strip()
        p_lower = p_clean.lower()

        # 1. Match against registered Web Services and PC Apps
        for key, target in self.registry.items():
            for alias in target["aliases"]:
                if alias in p_lower or alias in p_clean:
                    # Target matched!
                    target_name = target["name"]

                    if target["type"] == "web":
                        # Check if user asked to search for something specific inside this service
                        sub_query = p_clean
                        sub_query = re.sub(re.escape(alias), '', sub_query, flags=re.IGNORECASE)
                        # Strip common command & filler words
                        sub_query = re.sub(
                            r'(open|kholo|khol do|kholna|launch|chalao|chalana|start|run|play|karo|kar do|par|pe|search|dhoondo|dhundo|video|videos|gana|gane|songs|please|bhai|bhi|ko|se|کا|کی|کے|کو|پر|سے|کھولو|کھول دو|کھولیں|کھول|چلاؤ|چلا دو|چلا|چلائیں|اوپن|شروع|دکھاؤ|لگاؤ|کرو|کر دو|کریں|سرچ|ڈھونڈو)',
                            '',
                            sub_query,
                            flags=re.IGNORECASE
                        ).strip()

                        # If there is a legitimate search keyword (e.g. 'atif aslam', 'naat')
                        if len(sub_query) > 2 and target.get("search_url"):
                            encoded = urllib.parse.quote(sub_query)
                            s_url = target["search_url"].format(query=encoded)
                            try:
                                webbrowser.open(s_url)
                                return {
                                    "success": True,
                                    "message": f"🎬 {target_name} par **'{sub_query}'** search kar ke open kar diya gaya hai!"
                                }
                            except Exception as e:
                                return {"success": False, "error": str(e)}

                        # Direct website open
                        try:
                            webbrowser.open(target["url"])
                            return {
                                "success": True,
                                "message": f"🌐 **{target_name}** ({target['url']}) aapke browser mein open kar diya gaya hai!"
                            }
                        except Exception as e:
                            return {"success": False, "error": str(e)}

                    elif target["type"] == "app":
                        # Launch desktop application
                        try:
                            subprocess.Popen(target["cmd"], shell=True)
                            return {
                                "success": True,
                                "message": f"🚀 **{target_name}** open kar diya gaya hai!"
                            }
                        except Exception as e:
                            return {"success": False, "error": str(e)}

        # 2. Check for Direct URL or Domain (e.g. www.google.com, github.com)
        if any(ext in p_lower for ext in [".com", ".org", ".net", ".pk", ".io", ".co", "http://", "https://"]):
            url = p_clean if p_clean.startswith("http") else f"https://{p_clean}"
            try:
                webbrowser.open(url)
                return {
                    "success": True,
                    "message": f"🌐 Website `{url}` browser mein open kar di gayi hai!"
                }
            except Exception as e:
                return {"success": False, "error": str(e)}

        # 3. If user said 'search ...' or asked to search the web
        search_triggers = ["search", "google search", "dhoondo", "dhundo", "سرچ", "ڈھونڈو"]
        if any(st in p_lower or st in p_clean for st in search_triggers):
            clean_s = re.sub(r'(search|google search|google|par|pe|dhoondo|dhundo|karo|kar do|please|سرچ|ڈھونڈو|کرو)', '', p_clean, flags=re.IGNORECASE).strip()
            if clean_s:
                s_url = f"https://www.google.com/search?q={urllib.parse.quote(clean_s)}"
                webbrowser.open(s_url)
                return {
                    "success": True,
                    "message": f"🔍 Google par **'{clean_s}'** search kar diya gaya hai!"
                }

        # 4. Safe fallback: Only try Windows start if it's a clean single ASCII word
        clean_word = re.sub(r'(open|kholo|khol do|launch|chalao|start|run|please|karo)', '', p_lower).strip()
        if clean_word and clean_word.isalnum() and len(clean_word) <= 20 and not any(ord(c) > 127 for c in clean_word):
            try:
                subprocess.Popen(f"start {clean_word}", shell=True)
                return {
                    "success": True,
                    "message": f"🚀 Application `{clean_word}` launch kar di gayi hai!"
                }
            except Exception:
                pass

        return {
            "success": False,
            "error": f"Application ya website samajh nahi aayi. Baraye meherbani naam wazeh batayein (maslan 'YouTube', 'Chrome', 'WhatsApp')."
        }

    def open_target(self, target: str) -> dict:
        """Backwards compatibility wrapper"""
        return self.resolve_and_execute(target)

    def open_application(self, app_name: str) -> dict:
        """Backwards compatibility wrapper"""
        return self.resolve_and_execute(app_name)

    def take_screenshot(self, filename: str = None) -> dict:
        """Capture the entire PC screen and save to disk."""
        try:
            if not filename:
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                filename = f"screenshot_{timestamp}.png"
            path = os.path.join(SCREENSHOT_DIR, filename)
            img = ImageGrab.grab()
            img.save(path, format="PNG")
            return {
                "success": True,
                "file_path": path,
                "message": f"Screenshot saved successfully at: {path}",
                "image": img
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def set_reminder(self, text: str, seconds: int) -> dict:
        """Set a countdown reminder on Windows PC."""
        def reminder_thread():
            time.sleep(seconds)
            ps_cmd = f"""
            [reflection.assembly]::loadwithpartialname('System.Windows.Forms') | Out-Null
            [System.Windows.Forms.MessageBox]::Show('{text}', '⏰ AI Agent Reminder', [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information)
            """
            try:
                subprocess.Popen(["powershell", "-Command", ps_cmd])
            except Exception:
                pass

        threading.Thread(target=reminder_thread, daemon=True).start()
        mins = seconds // 60
        secs = seconds % 60
        time_str = f"{mins}m {secs}s" if mins > 0 else f"{secs} seconds"
        return {"success": True, "message": f"Reminder set for '{text}' in {time_str}."}

    def write_note(self, title: str, content: str) -> dict:
        """Create a text file/note on Desktop."""
        desktop = os.path.join(os.path.expanduser("~"), "Desktop")
        clean_title = "".join(c for c in title if c.isalnum() or c in (" ", "_", "-")).strip()
        if not clean_title:
            clean_title = "Agent_Note"
        filepath = os.path.join(desktop, f"{clean_title}.txt")
        try:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            return {"success": True, "file_path": filepath, "message": f"Note saved to Desktop: {clean_title}.txt"}
        except Exception as e:
            return {"success": False, "error": str(e)}

system_tool = SystemTool()
