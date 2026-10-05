"""
System Tool for Windows PC Automation
Handles screenshots, launching apps, reminders, and file operations.
"""

import os
import subprocess
import threading
import time
from datetime import datetime
from PIL import ImageGrab

SCREENSHOT_DIR = os.path.join(os.path.expanduser("~"), "Pictures", "AgentScreenshots")
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

class SystemTool:
    def __init__(self):
        self.reminders = []

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

    def open_application(self, app_name: str) -> dict:
        """Launch common Windows applications or URLs."""
        app_name_clean = app_name.lower().strip()
        common_apps = {
            "chrome": "start chrome",
            "google chrome": "start chrome",
            "notepad": "notepad",
            "calculator": "calc",
            "calc": "calc",
            "explorer": "explorer",
            "file explorer": "explorer",
            "cmd": "start cmd",
            "terminal": "start wt",
            "vscode": "code",
            "vs code": "code",
            "vlc": "start vlc"
        }
        cmd = common_apps.get(app_name_clean, f"start {app_name}")
        try:
            subprocess.Popen(cmd, shell=True)
            return {"success": True, "message": f"Launched application: {app_name}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

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
