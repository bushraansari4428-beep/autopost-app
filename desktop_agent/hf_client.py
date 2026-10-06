"""
Dual AI Engine Client with Multi-Provider Redundancy
1. Google Gemini 2.0 / Flash (Free API Key in config.json)
2. Groq Llama-3.3-70B (Free API Key in config.json)
3. Hugging Face ZeroGPU: Qwen3-8B + Qwen2.5-VL (Default)
4. Automatic Smart Web Search Synthesizer Fallback
"""

import json
import base64
import os
import re
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
        "hf_token": "",
        "gemini_api_key": "",
        "groq_api_key": ""
    }

URDU_TO_ROMAN_MAP = {
    'ا': 'a', 'آ': 'aa', 'ب': 'b', 'پ': 'p', 'ت': 't', 'ٹ': 't', 'ث': 's',
    'ج': 'j', 'چ': 'ch', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ڈ': 'd', 'ذ': 'z',
    'ر': 'r', 'ڑ': 'r', 'ز': 'z', 'ژ': 'zh', 'س': 's', 'ش': 'sh', 'ص': 's',
    'ض': 'z', 'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh', 'ف': 'f', 'ق': 'q',
    'ک': 'k', 'گ': 'g', 'ل': 'l', 'م': 'm', 'ن': 'n', 'ں': 'n', 'و': 'o',
    'ہ': 'h', 'ھ': 'h', 'ی': 'i', 'ے': 'e', 'ۂ': 'h', 'ء': '', 'ئ': 'e',
    '،': ',', '؟': '?', '۔': '.'
}

COMMON_URDU_PHRASES = {
    'آپ کی آواز سمجھ نہیں آرہی ہے': 'Aap ki aawaz samajh nahi aa rahi hai',
    'آپ کی آواز سمجھ نہیں آ رہی ہے': 'Aap ki aawaz samajh nahi aa rahi hai',
    'آپ کی آواز سمجھ نہیں آرہی': 'Aap ki aawaz samajh nahi aa rahi',
    'آپ کی آواز سمجھ نہیں آ رہی': 'Aap ki aawaz samajh nahi aa rahi',
    'آپ کی آواز': 'Aap ki aawaz',
    'سمجھ نہیں آرہی': 'samajh nahi aa rahi',
    'سمجھ نہیں آ رہی': 'samajh nahi aa rahi',
    'دوبارہ بولیں': 'dobara bolein',
    'السلام علیکم': 'Assalam o Alaikum',
    'وعلیکم السلام': 'Walaikum Assalam',
    'کیا حال ہے': 'Kya haal hai',
    'میں آپ کی مدد کر سکتا ہوں': 'Main aap ki madad kar sakta hoon',
    'کوئی سوال پوچھیں': 'Koi sawal poochein',
    'شکریہ': 'Shukriya',
    'جی ہاں': 'Jee haan',
    'جی نہیں': 'Jee nahi'
}

def urdu_to_roman(text: str) -> str:
    """Converts any Arabic/Urdu script into clean, readable Roman Urdu."""
    if not text or not re.search(r'[\u0600-\u06FF]', text):
        return text

    # First replace common whole phrases
    for u_phrase, r_phrase in COMMON_URDU_PHRASES.items():
        text = text.replace(u_phrase, r_phrase)

    # Transliterate any remaining Arabic/Urdu characters
    res = []
    for ch in text:
        if ch in URDU_TO_ROMAN_MAP:
            res.append(URDU_TO_ROMAN_MAP[ch])
        elif ord(ch) >= 0x0600 and ord(ch) <= 0x06FF:
            continue
        else:
            res.append(ch)
    
    clean_str = ''.join(res)
    clean_str = re.sub(r'\s+', ' ', clean_str).strip()
    return clean_str

class HfAiEngine:
    def __init__(self):
        cfg = load_config()
        self.base_url = cfg.get("hf_space_url", "https://bushraa2-my-ai-brain.hf.space").rstrip("/")
        self.token = cfg.get("hf_token", "").strip()
        self.gemini_key = cfg.get("gemini_api_key", "").strip()
        self.groq_key = cfg.get("groq_api_key", "").strip()
        self.endpoint = f"{self.base_url}/gradio_api/call/process_ai_request"

    def _clean_output(self, raw_text: str) -> str:
        """Strip internal think blocks, Gradio headings, and guarantee Roman Urdu output"""
        if not raw_text:
            return ""
        # 1. Remove Gradio mode headings
        text = re.sub(r'^(?:🧠|👁️)\s*\[.*?\]\s*:\s*', '', raw_text.strip(), flags=re.MULTILINE)

        # 2. If closed </think> tag exists, take ONLY the clean answer after </think>
        if "</think>" in text:
            parts = text.split("</think>")
            after_think = parts[-1].strip()
            if after_think:
                text = after_think

        # 3. If unclosed <think> exists (cut off mid-thinking)
        elif "<think>" in text:
            before_think = text.split("<think>")[0].strip()
            if before_think:
                text = before_think
            else:
                inside = text.replace("<think>", "").strip()
                matches = re.findall(r'(?:So|Therefore|The answer is|Answer|Jawab)[:\s]+([^\n\.]+[\.\!]?)', inside, re.IGNORECASE)
                if matches:
                    text = matches[-1].strip()
                else:
                    sentences = [s.strip() for s in re.split(r'[\n\.]+', inside) if s.strip()]
                    filtered = [
                        s for s in sentences
                        if len(s) > 10 and not any(s.lower().startswith(p) for p in ["okay", "let me", "i need to", "looking at", "wait", "the user", "since", "however"])
                    ]
                    if filtered:
                        text = filtered[-1] + "."
                    else:
                        text = "Sawal ka jawab tayyar nahi ho saka, baraye meherbani dobara poochein."

        # 4. Mandatory: If any Arabic/Urdu script is present, transliterate to clean Roman Urdu
        text = urdu_to_roman(text)
        return text.strip()

    def _query_gemini(self, prompt: str, image=None) -> str:
        """Free Google Gemini 2.0 / Flash API (1500 calls/day free forever)"""
        if not self.gemini_key:
            return None
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={self.gemini_key}"
            parts = [{"text": prompt}]
            if image is not None:
                if isinstance(image, str) and os.path.exists(image):
                    with open(image, "rb") as f:
                        b64 = base64.b64encode(f.read()).decode("utf-8")
                elif hasattr(image, "save"):
                    buf = BytesIO()
                    image.save(buf, format="PNG")
                    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
                parts.append({"inline_data": {"mime_type": "image/png", "data": b64}})

            payload = {"contents": [{"parts": parts}]}
            res = requests.post(url, json=payload, timeout=15)
            if res.status_code == 200:
                return res.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
        except Exception:
            pass
        return None

    def _query_groq(self, prompt: str) -> str:
        """Free Groq API (Llama-3.3-70B, 350 tokens/sec)"""
        if not self.groq_key:
            return None
        try:
            url = "https://api.groq.com/openai/v1/chat/completions"
            headers = {"Authorization": f"Bearer {self.groq_key}"}
            payload = {
                "model": "llama-3.3-70b-versatile",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 300
            }
            res = requests.post(url, headers=headers, json=payload, timeout=12)
            if res.status_code == 200:
                return res.json()["choices"][0]["message"]["content"].strip()
        except Exception:
            pass
        return None

    def ask(self, prompt: str, mode: str = "⚡ Auto", image=None) -> str:
        """
        Query AI engine:
        1. Gemini (if key present in config.json)
        2. Groq (if key present in config.json)
        3. Hugging Face ZeroGPU Space (default)
        """
        # Check Gemini Key first if available
        if self.gemini_key:
            gem_res = self._query_gemini(prompt, image)
            if gem_res:
                return self._clean_output(gem_res)

        # Check Groq Key if text-only
        if self.groq_key and image is None:
            groq_res = self._query_groq(prompt)
            if groq_res:
                return self._clean_output(groq_res)

        # Default: Hugging Face ZeroGPU Space
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
                                return self._clean_output(str(data[0]))
                            elif isinstance(data, dict) and data.get("error"):
                                err_msg = str(data["error"])
                                if "quota" in err_msg.lower():
                                    return "⚠️ ZERO_GPU_QUOTA_EXCEEDED"
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
        """Direct call to Brain (Qwen)"""
        return self.ask(prompt=prompt, mode="🧠 Brain (Qwen)")

    def inspect_visual(self, prompt: str, image) -> str:
        """Direct call to Eyes (Qwen-VL)"""
        return self.ask(prompt=prompt, mode="👁️ Eyes (Qwen-VL)", image=image)

# Singleton instance
ai_engine = HfAiEngine()
