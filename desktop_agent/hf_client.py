"""
Hugging Face Dual AI Engine Client (ZeroGPU Nvidia A100)
Connects directly to https://bushraa2-my-ai-brain.hf.space
"""

import json
import base64
import os
import requests
from io import BytesIO
from PIL import Image

CONFIG_FILE = os.path.join(os.path.dirname(__file__), "config.json")

def load_config():
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "hf_space_url": "https://bushraa2-my-ai-brain.hf.space",
        "hf_token": ""
    }

class HfAiEngine:
    def __init__(self):
        cfg = load_config()
        self.base_url = cfg.get("hf_space_url", "https://bushraa2-my-ai-brain.hf.space").rstrip("/")
        self.token = cfg.get("hf_token", "").strip()
        self.endpoint = f"{self.base_url}/gradio_api/call/process_ai_request"

    def ask(self, prompt: str, mode: str = "⚡ Auto", image=None) -> str:
        """
        Query the dual AI engine:
        - mode: '🧠 Brain (Qwen3-8B)', '👁️ Eyes (Qwen2.5-VL)', or '⚡ Auto'
        - image: PIL.Image, file path, or None
        """
        headers = {}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"

        image_data = None
        if image is not None:
            if isinstance(image, str) and os.path.exists(image):
                with open(image, "rb") as f:
                    b64 = base64.b64encode(f.read()).decode("utf-8")
                    image_data = f"data:image/png;base64,{b64}"
            elif hasattr(image, "save"):
                buffered = BytesIO()
                image.save(buffered, format="PNG")
                b64 = base64.b64encode(buffered.getvalue()).decode("utf-8")
                image_data = f"data:image/png;base64,{b64}"

        payload = {
            "data": [
                mode,
                image_data,
                prompt
            ]
        }

        try:
            # 1. Start Job
            res = requests.post(self.endpoint, json=payload, headers=headers, timeout=20)
            if res.status_code != 200:
                return f"⚠️ HF API Error ({res.status_code}): {res.text}"

            event_id = res.json().get("event_id")
            if not event_id:
                return "⚠️ Error: No event ID received from Hugging Face."

            # 2. Stream Result
            stream_url = f"{self.endpoint}/{event_id}"
            with requests.get(stream_url, headers=headers, stream=True, timeout=120) as stream_res:
                for line in stream_res.iter_lines():
                    if not line:
                        continue
                    decoded = line.decode("utf-8", errors="ignore")
                    if decoded.startswith("data:"):
                        raw_json = decoded[5:].strip()
                        try:
                            data = json.loads(raw_json)
                            if isinstance(data, list) and len(data) > 0:
                                return str(data[0])
                            elif isinstance(data, dict) and data.get("error"):
                                err_msg = data["error"]
                                if "quota" in str(err_msg).lower():
                                    return f"⚠️ ZeroGPU Quota Notice: Please add your free HF Token to config.json (https://huggingface.co/settings/tokens) for high-limit access.\nDetails: {err_msg}"
                                return f"⚠️ Hugging Face Error: {err_msg}"
                        except Exception:
                            pass
                    elif decoded.startswith("event: error"):
                        last_event = "error"

            return "⚠️ Notice: Hugging Face response stream finished without data."

        except requests.exceptions.RequestException as e:
            return f"⚠️ Network Connection Error: {str(e)}"
        except Exception as e:
            return f"⚠️ Unexpected Error: {str(e)}"

    def reason(self, prompt: str) -> str:
        """Direct call to Brain (Qwen3-8B)"""
        return self.ask(prompt=prompt, mode="🧠 Brain (Qwen3-8B)")

    def inspect_visual(self, prompt: str, image) -> str:
        """Direct call to Eyes (Qwen2.5-VL)"""
        return self.ask(prompt=prompt, mode="👁️ Eyes (Qwen2.5-VL)", image=image)

# Singleton instance
ai_engine = HfAiEngine()
