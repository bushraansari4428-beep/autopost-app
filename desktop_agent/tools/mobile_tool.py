"""
Android Mobile Automation Tool via ADB
Supports wireless and USB connected Android devices.
"""

import os
import subprocess
from io import BytesIO
from PIL import Image

class MobileTool:
    def __init__(self):
        pass

    def check_devices(self) -> dict:
        """List all connected Android devices."""
        try:
            out = subprocess.check_output(["adb", "devices"], text=True)
            lines = [l.strip() for l in out.split("\n") if l.strip() and not l.startswith("List of devices")]
            devices = [l.split("\t")[0] for l in lines if "device" in l]
            return {
                "success": True,
                "connected_count": len(devices),
                "devices": devices,
                "message": f"Found {len(devices)} connected Android device(s): {', '.join(devices) if devices else 'None'}"
            }
        except FileNotFoundError:
            return {"success": False, "error": "ADB is not installed or not in PATH. Please install Android Platform Tools."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def capture_screen(self) -> dict:
        """Capture Android phone screen."""
        try:
            raw_png = subprocess.check_output(["adb", "exec-out", "screencap", "-p"])
            img = Image.open(BytesIO(raw_png))
            save_path = os.path.join(os.path.expanduser("~"), "Pictures", "phone_screen.png")
            img.save(save_path, "PNG")
            return {
                "success": True,
                "file_path": save_path,
                "image": img,
                "message": f"Mobile screenshot saved to {save_path}"
            }
        except Exception as e:
            return {"success": False, "error": str(e)}

    def tap(self, x: int, y: int) -> dict:
        """Tap at coordinates (x, y) on Android screen."""
        try:
            subprocess.run(["adb", "shell", "input", "tap", str(x), str(y)], check=True)
            return {"success": True, "message": f"Tapped at ({x}, {y}) on mobile."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def press_home(self) -> dict:
        """Press Home button on Android phone."""
        try:
            subprocess.run(["adb", "shell", "input", "keyevent", "3"], check=True)
            return {"success": True, "message": "Pressed Home button on phone."}
        except Exception as e:
            return {"success": False, "error": str(e)}

mobile_tool = MobileTool()
