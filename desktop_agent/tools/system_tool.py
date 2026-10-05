"""
System Tool for Windows PC Automation
Handles screenshots, launching apps & websites, reminders, and file operations.
"""

import os
import subprocess
import threading
import time
import webbrowser
from datetime import datetime
from PIL import ImageGrab

SCREENSHOT_DIR = os.path.join(os.path.expanduser("~"), "Pictures", "AgentScreenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

WEB_SERVICES = {
    "youtube": "https://www.youtube.com",
    "yt": "https://www.youtube.com",
    "یوٹیوب": "https://www.youtube.com",
    "google": "https://www.google.com",
    "گوگل": "https://www.google.com",
    "facebook": "https://www.facebook.com",
    "fb": "https://www.facebook.com",
    "فیس بک": "https://www.facebook.com",
    "instagram": "https://www.instagram.com",
    "insta": "https://www.instagram.com",
    "انسٹاگرام": "https://www.instagram.com",
    "tiktok": "https://www.tiktok.com",
    "ٹک ٹاک": "https://www.tiktok.com",
    "whatsapp": "https://web.whatsapp.com",
    "واٹس ایپ": "https://web.whatsapp.com",
    "chatgpt": "https://chatgpt.com",
    "gpt": "https://chatgpt.com",
    "چٹ جی پی ٹی": "https://chatgpt.com",
    "twitter": "https://x.com",
    "x": "https://x.com",
    "ٹویٹر": "https://x.com",
    "gmail": "https://mail.google.com",
    "email": "https://mail.google.com",
    "میل": "https://mail.google.com",
    "github": "https://github.com",
    "netflix": "https://www.netflix.com",
    "daraz": "https://www.daraz.pk",
    "canva": "https://www.canva.com",
    "spotify": "https://open.spotify.com",
    "linkedin": "https://www.linkedin.com",
    "reddit": "https://www.reddit.com",
    "amazon": "https://www.amazon.com",
    "weather": "https://weather.com",
}

WINDOWS_APPS = {
    "chrome": "start chrome",
    "google chrome": "start chrome",
    "edge": "start msedge",
    "msedge": "start msedge",
    "notepad": "notepad",
    "نوٹ پیڈ": "notepad",
    "calculator": "calc",
    "calc": "calc",
    "کیلکولیٹر": "calc",
    "explorer": "explorer",
    "file explorer": "explorer",
    "files": "explorer",
    "my computer": "explorer",
    "cmd": "start cmd",
    "terminal": "start wt",
    "powershell": "start powershell",
    "vscode": "code",
    "vs code": "code",
    "vlc": "start vlc",
    "paint": "mspaint",
    "mspaint": "mspaint",
    "task manager": "taskmgr",
    "taskmgr": "taskmgr",
    "settings": "start ms-settings:",
    "word": "start winword",
    "excel": "start excel",
    "powerpoint": "start powerpnt",
}

class SystemTool:
    def __init__(self):
        self.reminders = []
        self.WEB_SERVICES = WEB_SERVICES
        self.WINDOWS_APPS = WINDOWS_APPS

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

    def open_target(self, target: str) -> dict:
        """Launch web service (YouTube, Google, FB...) or Windows application directly on user's PC."""
        target_clean = target.lower().strip()

        # 1. Match known web services (opens in default browser)
        for key, url in WEB_SERVICES.items():
            if key == target_clean or (len(key) >= 3 and key in target_clean):
                try:
                    webbrowser.open(url)
                    name_title = key.title() if not any(ord(c) > 127 for c in key) else "Website"
                    return {"success": True, "message": f"🌐 {name_title} ({url}) aapke browser mein open kar diya gaya hai!"}
                except Exception as e:
                    return {"success": False, "error": str(e)}

        # 2. Match known Windows desktop applications
        for key, cmd in WINDOWS_APPS.items():
            if key == target_clean or (len(key) >= 3 and key in target_clean):
                try:
                    subprocess.Popen(cmd, shell=True)
                    name_title = key.title() if not any(ord(c) > 127 for c in key) else "App"
                    return {"success": True, "message": f"🚀 {name_title} open kar diya gaya hai!"}
                except Exception as e:
                    return {"success": False, "error": str(e)}

        # 3. Direct URL or domain check (e.g., example.com, http...)
        if any(ext in target_clean for ext in [".com", ".org", ".net", ".pk", ".io", ".co", "http://", "https://"]):
            url = target_clean if target_clean.startswith("http") else f"https://{target_clean}"
            try:
                webbrowser.open(url)
                return {"success": True, "message": f"🌐 Website `{url}` browser mein open kar di gayi hai!"}
            except Exception as e:
                return {"success": False, "error": str(e)}

        # 4. Fallback: try Windows 'start <app>'
        try:
            subprocess.Popen(f"start {target_clean}", shell=True)
            return {"success": True, "message": f"🚀 Application `{target}` launch kar di gayi hai!"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def open_application(self, app_name: str) -> dict:
        """Backwards compatibility wrapper"""
        return self.open_target(app_name)

    def set_reminder(self, text: str, seconds: int) -> dict:
        """Set a countdown reminder on Windows PC."""
        def reminder_thread():
            time.sleep(seconds)
            # Trigger Windows notification / alert via powershell toast
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
