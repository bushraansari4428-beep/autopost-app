"""
Mobile Telegram Bot Bridge for Universal Agent
Allows remote control of PC from Telegram on Mobile.
"""

import json
import os
import time
import threading
import requests
from agent_core import agent

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

def get_token():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f).get("telegram_bot_token", "").strip()
        except Exception:
            pass
    return ""

class TelegramAgentBridge:
    def __init__(self, token: str):
        self.token = token
        self.base_url = f"https://api.telegram.org/bot{self.token}"
        self.offset = 0
        self.is_running = False

    def send_message(self, chat_id: int, text: str):
        url = f"{self.base_url}/sendMessage"
        # Telegram max length is 4096
        chunks = [text[i:i+4000] for i in range(0, len(text), 4000)]
        for chunk in chunks:
            try:
                requests.post(url, json={"chat_id": chat_id, "text": chunk}, timeout=15)
            except Exception:
                pass

    def send_photo(self, chat_id: int, photo_path: str, caption: str = ""):
        url = f"{self.base_url}/sendPhoto"
        try:
            with open(photo_path, "rb") as f:
                requests.post(url, data={"chat_id": chat_id, "caption": caption[:1024]}, files={"photo": f}, timeout=30)
        except Exception as e:
            self.send_message(chat_id, f"⚠️ Failed to send photo: {e}")

    def send_document(self, chat_id: int, file_path: str, caption: str = ""):
        url = f"{self.base_url}/sendDocument"
        try:
            with open(file_path, "rb") as f:
                requests.post(url, data={"chat_id": chat_id, "caption": caption[:1024]}, files={"document": f}, timeout=60)
        except Exception as e:
            self.send_message(chat_id, f"⚠️ Failed to send file: {e}")

    def handle_message(self, chat_id: int, text: str):
        if text.startswith("/start"):
            welcome = (
                "🤖 **Assalam o Alaikum! Main aapka Universal PC & AI Agent hoon.**\n\n"
                "Aap mobile se mujhe koi bhi task de sakte hain:\n"
                "• 📸 *'PC screen ka screenshot lo'*\n"
                "• ⚡ *'LESCO bill check karo 12345678901234'*\n"
                "• 🎬 *'YouTube se tech news video download karo'*\n"
                "• 🌐 *'Search karo latest AI updates'*\n"
                "• ⏰ *'5 minute baad reminder lagao'* \n\n"
                "Main foran aapke PC par kaam karke result bhejunga!"
            )
            self.send_message(chat_id, welcome)
            return

        self.send_message(chat_id, f"⏳ PC Agent task execute kar raha hai: '{text}'...")
        res = agent.execute(text)

        # Send text output
        msg_text = res.get("text", "Task completed.")
        self.send_message(chat_id, msg_text)

        # If screenshot was captured, send it
        if "image_path" in res and os.path.exists(res["image_path"]):
            self.send_photo(chat_id, res["image_path"], caption="📸 PC Screen Capture")

        # If file was downloaded, send it if small (< 50MB)
        if "file_path" in res and os.path.exists(res["file_path"]):
            size_mb = os.path.getsize(res["file_path"]) / (1024 * 1024)
            if size_mb < 50:
                self.send_document(chat_id, res["file_path"], caption=f"📁 {os.path.basename(res['file_path'])}")
            else:
                self.send_message(chat_id, f"📁 File saved on PC: {res['file_path']} (Too large to send via Telegram: {size_mb:.1f} MB)")

    def start_polling(self):
        self.is_running = True
        print("📱 Telegram Bot Bridge started! Listening for commands from mobile...")
        while self.is_running:
            try:
                url = f"{self.base_url}/getUpdates?offset={self.offset}&timeout=20"
                r = requests.get(url, timeout=25)
                if r.status_code == 200:
                    data = r.json()
                    for item in data.get("result", []):
                        self.offset = item["update_id"] + 1
                        msg = item.get("message", {})
                        chat_id = msg.get("chat", {}).get("id")
                        text = msg.get("text", "")

                        if chat_id and text:
                            threading.Thread(target=self.handle_message, args=(chat_id, text), daemon=True).start()

                elif r.status_code == 401 or r.status_code == 404:
                    print("⚠️ Invalid Telegram Bot Token. Please check config.json.")
                    time.sleep(10)
            except Exception as e:
                time.sleep(3)

def run_telegram_bot_background():
    token = get_token()
    if not token:
        print("ℹ️ Telegram bot token not set in config.json. Running Desktop Floating Bar only.")
        return None
    bridge = TelegramAgentBridge(token)
    t = threading.Thread(target=bridge.start_polling, daemon=True)
    t.start()
    return bridge

if __name__ == "__main__":
    t = get_token()
    if not t:
        print("Please set 'telegram_bot_token' in config.json first.")
    else:
        bridge = TelegramAgentBridge(t)
        bridge.start_polling()
