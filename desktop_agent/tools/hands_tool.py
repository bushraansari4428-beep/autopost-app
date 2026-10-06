"""
Hands Tool for Autonomous Computer Use
Provides real mouse, keyboard, and screen interaction capabilities via PyAutoGUI.
Allows the AI Agent to click, type, press shortcuts, navigate, and perform screen actions.
"""

import time
import pyautogui

# Safety failsafe: moving mouse to corner aborts
pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.3

class HandsTool:
    def __init__(self):
        self.screen_width, self.screen_height = pyautogui.size()

    def click(self, x: int = None, y: int = None) -> dict:
        """Click at specific coordinates (or current mouse position)."""
        try:
            if x is not None and y is not None:
                pyautogui.click(x=x, y=y)
                msg = f"Mouse clicked at ({x}, {y})."
            else:
                pyautogui.click()
                msg = "Mouse clicked at current position."
            return {"success": True, "message": msg}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def double_click(self, x: int = None, y: int = None) -> dict:
        """Double click at coordinates."""
        try:
            if x is not None and y is not None:
                pyautogui.doubleClick(x=x, y=y)
            else:
                pyautogui.doubleClick()
            return {"success": True, "message": f"Double clicked at ({x}, {y})."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def type_text(self, text: str, press_enter: bool = False) -> dict:
        """Type text into active field on screen."""
        try:
            # write with slight interval for natural typing
            pyautogui.write(text, interval=0.03)
            if press_enter:
                time.sleep(0.2)
                pyautogui.press('enter')
            return {"success": True, "message": f"Typed text: '{text}'"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def press_key(self, key: str) -> dict:
        """Press a single key (e.g., 'enter', 'tab', 'esc', 'backspace', 'down', 'up')."""
        try:
            pyautogui.press(key.lower())
            return {"success": True, "message": f"Pressed key: '{key}'"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def hotkey(self, *keys) -> dict:
        """Press keyboard shortcut (e.g., ['ctrl', 'c'], ['alt', 'tab'])."""
        try:
            pyautogui.hotkey(*keys)
            return {"success": True, "message": f"Pressed hotkey: {' + '.join(keys)}"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def scroll(self, amount: int) -> dict:
        """Scroll wheel (positive = up, negative = down)."""
        try:
            pyautogui.scroll(amount)
            direction = "up" if amount > 0 else "down"
            return {"success": True, "message": f"Scrolled {direction} ({abs(amount)} clicks)."}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def get_mouse_position(self) -> dict:
        """Get current mouse cursor coordinates."""
        x, y = pyautogui.position()
        return {"x": x, "y": y, "width": self.screen_width, "height": self.screen_height}

hands_tool = HandsTool()
