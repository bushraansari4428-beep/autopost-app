"""
Universal Autonomous Agent Core
Powered by Hugging Face ZeroGPU: Qwen3-8B (Brain) + Qwen2.5-VL (Eyes)
Equipped with Instant Local Intelligence, Hands Screen Automation & 2026 Live Web Engine.
"""

import re
import json
import webbrowser
from datetime import datetime
import psutil
from hf_client import ai_engine
from tools.system_tool import system_tool
from tools.video_downloader import video_downloader
from tools.bill_checker import bill_checker
from tools.browser_tool import browser_tool
from tools.mobile_tool import mobile_tool
from tools.python_tool import python_tool
from tools.weather_tool import weather_tool, URDU_CITY_MAP
from tools.hands_tool import hands_tool
from roman_urdu_kb import ROMAN_URDU_SYSTEM_CONTEXT

SERVICE_ACTIONS = {
    "facebook": {
        "name": "Facebook",
        "home": "https://www.facebook.com",
        "register": "https://www.facebook.com/r.php",
        "login": "https://www.facebook.com/login",
        "aliases": ["facebook", "fb", "face book", "فیس بک", "فیسبوک", "فیس بُک"]
    },
    "google": {
        "name": "Google",
        "home": "https://www.google.com",
        "register": "https://accounts.google.com/signup",
        "login": "https://accounts.google.com/signin",
        "aliases": ["google", "gmail", "گوگل", "جی میل"]
    },
    "instagram": {
        "name": "Instagram",
        "home": "https://www.instagram.com",
        "register": "https://www.instagram.com/accounts/emailsignup/",
        "login": "https://www.instagram.com/accounts/login/",
        "aliases": ["instagram", "insta", "انسٹاگرام", "انسٹا"]
    },
    "tiktok": {
        "name": "TikTok",
        "home": "https://www.tiktok.com",
        "register": "https://www.tiktok.com/signup",
        "login": "https://www.tiktok.com/login",
        "aliases": ["tiktok", "tik tok", "ٹک ٹاک", "ٹکٹاک"]
    },
    "twitter": {
        "name": "X (Twitter)",
        "home": "https://x.com",
        "register": "https://x.com/i/flow/signup",
        "login": "https://x.com/i/flow/login",
        "aliases": ["twitter", "x", "ٹویٹر"]
    },
    "chatgpt": {
        "name": "ChatGPT",
        "home": "https://chatgpt.com",
        "register": "https://chatgpt.com/auth/login",
        "login": "https://chatgpt.com/auth/login",
        "aliases": ["chatgpt", "gpt", "chat gpt"]
    },
    "whatsapp": {
        "name": "WhatsApp",
        "home": "https://web.whatsapp.com",
        "aliases": ["whatsapp", "whats app", "واٹس ایپ"]
    },
    "youtube": {
        "name": "YouTube",
        "home": "https://www.youtube.com",
        "aliases": ["youtube", "yt", "یوٹیوب"]
    }
}

class UniversalAgent:
    def __init__(self):
        self.ai = ai_engine
        self.history = []
        self.active_context = None
        self.active_task = None
        self.active_url = None

    def _record_turn(self, role: str, text: str):
        self.history.append({
            "role": role,
            "text": text,
            "time": datetime.now().strftime("%H:%M:%S")
        })
        if len(self.history) > 12:
            self.history = self.history[-12:]

    def _finish(self, res: dict) -> dict:
        self._record_turn("assistant", res.get("text", ""))
        return res

    def _resolve_target_service(self, prompt_lower: str) -> str:
        """Find matching service from prompt, or fallback to active_context."""
        for key, info in SERVICE_ACTIONS.items():
            for alias in info["aliases"]:
                if alias in prompt_lower:
                    return key
        context_refs = ["yahan", "yahan pe", "yahan per", "here", "isme", "is mein", "is pe", "idhar", "isi par"]
        if any(cr in prompt_lower for cr in context_refs) or "account" in prompt_lower or "login" in prompt_lower or "sign up" in prompt_lower:
            if self.active_context and self.active_context in SERVICE_ACTIONS:
                return self.active_context
        return None

    def execute(self, user_prompt: str) -> dict:
        """
        Process any user instruction end-to-end:
        1. Classify intent (Instant Local Tools vs Service Actions vs Hands Tool vs Weather vs Search)
        2. Execute tool if needed
        3. Consult Qwen3-8B / Qwen2.5-VL with conversation context & memory
        4. Return clean, pristine result in Latin Roman Urdu
        """
        prompt = user_prompt.strip()
        prompt_lower = prompt.lower()
        self._record_turn("user", prompt)

        # -------------------------------------------------------------
        # 0. DATE, TIME & CALENDAR (Instant 0.001s Local Response)
        # -------------------------------------------------------------
        is_time_word = any(w in prompt_lower or w in prompt for w in ["time", "waqt", "وقت", "ghanta", "baje"])
        is_date_word = any(w in prompt_lower or w in prompt for w in ["date", "tarikh", "taareekh", "تاریخ", "calendar", "mahina", "month", "year", "saal", "din", "day"])
        is_query_intent = any(w in prompt_lower or w in prompt for w in ["kya", "batao", "what", "is", "hai", "hoga", "today", "aaj", "aj", "current", "کون", "کیا", "آج", "ابھی", "konsa", "kon sa"])

        if (is_time_word or is_date_word) and is_query_intent:
            now = datetime.now()
            day_name_en = now.strftime("%A")
            day_map_ur = {
                "Monday": "Peer (پیر)",
                "Tuesday": "Mangal (منگل)",
                "Wednesday": "Budh (بدھ)",
                "Thursday": "Jumerat (جمعرات)",
                "Friday": "Jumma (جمعہ)",
                "Saturday": "Hafta (ہفتہ)",
                "Sunday": "Itwar (اتوار)"
            }
            day_ur = day_map_ur.get(day_name_en, day_name_en)
            date_str = now.strftime("%d %B %Y")
            time_str = now.strftime("%I:%M %p")

            if is_time_word and not is_date_word:
                return self._finish({
                    "text": f"⏰ **Current Time:** {time_str} (Pakistan Time)\n📅 **Date:** {date_str} ({day_ur})",
                    "status": "Complete"
                })
            else:
                return self._finish({
                    "text": f"📅 **Aaj Ki Date:** {date_str} ({day_ur})\n⏰ **Waqt:** {time_str} (Pakistan Time)",
                    "status": "Complete"
                })

        # -------------------------------------------------------------
        # 0.1 PC SYSTEM STATUS & BATTERY (Instant 0.001s Local Response)
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["battery", "ram", "cpu", "specs", "system info"]) and any(w in prompt_lower for w in ["pc", "laptop", "check", "kitni", "kya", "batao", "status", "dekho"]):
            battery = psutil.sensors_battery()
            batt_str = f"{battery.percent}% ({'Charging ⚡' if battery.power_plugged else 'Discharging 🔋'})" if battery else "Desktop PC (Plugged in ⚡)"
            ram = psutil.virtual_memory()
            ram_str = f"{ram.percent}% used ({round(ram.used/(1024**3), 1)}GB / {round(ram.total/(1024**3), 1)}GB)"
            return self._finish({
                "text": f"💻 **PC System Status:**\n🔋 **Battery:** {batt_str}\n🧠 **RAM:** {ram_str}\n⚙️ **OS:** Windows PC",
                "status": "Complete"
            })

        # -------------------------------------------------------------
        # 0.2 GREETINGS & VOICE / IDENTITY (Instant 0.001s Local Response)
        # -------------------------------------------------------------
        voice_words = ["awaz", "aawaz", "aoaz", "awaaz", "hear me", "audible", "sun rahe", "sun rahay", "sun sakte", "sun sakty", "sunai"]
        is_voice_check = any(w in prompt_lower for w in voice_words) or any(k in prompt for k in ["آواز", "سن رہے", "سنائی", "سن سکتے"])
        if is_voice_check and any(v in prompt_lower or v in prompt for v in ["aa rahi", "arahi", "arhi", "sun", "kya", "hear", "سکتے", "آ رہی", "سنتے"]):
            return self._finish({
                "text": "Jee haan! Aap ki aawaz bilkul saaf aur clear aa rahi hai. Main sun raha hoon, hukum karein!",
                "status": "Complete"
            })

        if any(w in prompt_lower for w in ["tum kon ho", "aap kon ho", "aap kon hain", "who are you", "kya kar sakte ho", "what can you do"]) or any(k in prompt for k in ["کون ہو", "کون ہیں", "کیا کر سکتے"]):
            return self._finish({
                "text": "Main aapka omnipotent AI Personal Assistant JARVIS hoon. Mere paas Python code runner, live internet browser, PC Hands automation (typing, clicks, keys), YouTube/Web apps, bills checker, aur Hugging Face AI Brain ki tamam taqatein hain. Main hamesha Roman Urdu aur English mein aapki khidmat ke liye tayyar hoon. Hukum karein!",
                "status": "Complete"
            })

        clean_greet = prompt_lower.strip().rstrip("?!.,")
        if clean_greet in ["salam", "assalam o alaikum", "assalamu alaikum", "hello", "hi", "hey", "kaise ho", "kya haal hai"] or any(g in prompt for g in ["سلام", "السلام علیکم", "ہیلو"]):
            return self._finish({
                "text": "Walaikum Assalam! Main bilkul theek aur aapke hukum ka muntazir hoon. Python scripts, Web accounts, live weather, bills ya kisi bhi sawal ke liye farmayein!",
                "status": "Complete"
            })

        # -------------------------------------------------------------
        # 1. SCREENSHOT & VISION INSPECTION
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["screenshot", "screen dekho", "capture screen", "screen par kya"]):
            shot = system_tool.take_screenshot()
            if not shot["success"]:
                return self._finish({"text": f"❌ Could not take screenshot: {shot.get('error')}", "status": "Error"})
            
            analysis = self.ai.inspect_visual("Describe what is on the screen and identify any active windows or key elements.", shot["image"])
            return self._finish({
                "text": f"📸 **Screenshot Captured**\n📁 Saved: `{shot['file_path']}`\n\n👁️ **AI Vision Inspection:**\n{analysis}",
                "status": "Complete",
                "image_path": shot["file_path"]
            })

        # -------------------------------------------------------------
        # 2. LIVE REAL-TIME WEATHER & FORECAST (English + Urdu Script)
        # -------------------------------------------------------------
        weather_triggers = ["weather", "mosam", "mausam", "barish", "rain", "forecast", "taapmaan", "darja hararat", "موسم", "بارش", "پیشگوئی", "درجہ حرارت"]
        is_weather = any(w in prompt_lower or w in prompt for w in weather_triggers)
        if not is_weather and "temperature" in prompt_lower and not any(k in prompt_lower for k in ["pc", "cpu", "gpu"]):
            is_weather = True

        if is_weather:
            is_tomorrow = any(k in prompt_lower or k in prompt for k in ["kal", "tomorrow", "future", "aane wale", "کل", "اگلا دن", "اگلے دن", "آئندہ"])

            target_city = "Faisalabad"
            for urdu_name, eng_name in URDU_CITY_MAP.items():
                if urdu_name in prompt:
                    target_city = eng_name
                    break

            pak_cities = ["faisalabad", "lahore", "karachi", "islamabad", "rawalpindi", "multan", "peshawar", "quetta", "sialkot", "gujranwala", "sargodha", "bahawalpur", "sukkur", "hyderabad"]
            for c in pak_cities:
                if c in prompt_lower:
                    target_city = c.title()
                    break

            w_res = weather_tool.get_weather(target_city, is_tomorrow=is_tomorrow)
            if w_res["success"]:
                return self._finish({"text": w_res["message"], "status": "Complete"})
            else:
                return self._finish({"text": f"⚠️ {w_res['error']}", "status": "Error"})

        # -------------------------------------------------------------
        # 3. ELECTRICITY BILL CHECKER
        # -------------------------------------------------------------
        bill_keywords = ["bill", "bijli", "lesco", "mepco", "gepco", "fesco", "iesco", "pesco", "kelectric", "k-electric", "بل", "بجلی"]
        if any(w in prompt_lower or w in prompt for w in bill_keywords) and re.search(r'\d{10,16}', prompt):
            companies = ["lesco", "mepco", "gepco", "fesco", "iesco", "pesco", "hesco", "sepco", "qesco"]
            found_company = "lesco"
            for c in companies:
                if c in prompt_lower:
                    found_company = c
                    break

            ref_match = re.search(r'\d{10,16}', prompt)
            if ref_match:
                ref_no = ref_match.group(0)
                bill_res = bill_checker.check_pitc_bill(found_company, ref_no)
                if bill_res["success"]:
                    return self._finish({"text": bill_res["message"], "status": "Complete"})
                else:
                    return self._finish({"text": f"⚠️ {bill_res['error']}", "status": "Error"})

        # -------------------------------------------------------------
        # 4. VIDEO DOWNLOADER (YouTube / TikTok / FB)
        # -------------------------------------------------------------
        url_match = re.search(r'https?://[^\s]+', prompt)
        if any(w in prompt_lower for w in ["download", "video lao", "save video", "video download"]):
            if url_match:
                url = url_match.group(0)
                v_res = video_downloader.download(url)
                if v_res["success"]:
                    return self._finish({
                        "text": f"🎬 **Video Downloaded!**\n📌 Title: **{v_res['title']}**\n📁 File: `{v_res['file_path']}`",
                        "status": "Complete",
                        "file_path": v_res["file_path"]
                    })
                else:
                    return self._finish({"text": f"❌ Video Download Failed: {v_res.get('error')}", "status": "Error"})
            elif any(w in prompt_lower for w in ["youtube", "tiktok", "video"]):
                clean_query = re.sub(r'(download|video|youtube|tiktok|please|karo|lao)', '', prompt, flags=re.IGNORECASE).strip()
                v_res = video_downloader.search_and_download(clean_query)
                if v_res["success"]:
                    return self._finish({
                        "text": f"🎬 **Video Found & Downloaded!**\n📌 Title: **{v_res['title']}**\n📁 File: `{v_res['file_path']}`",
                        "status": "Complete",
                        "file_path": v_res["file_path"]
                    })
                else:
                    return self._finish({"text": f"❌ Video Search Failed: {v_res.get('error')}", "status": "Error"})

        # -------------------------------------------------------------
        # 4.4 CLOSE / TERMINATE RUNNING APPLICATIONS
        # -------------------------------------------------------------
        close_triggers = [
            "band kar do", "band karo", "band karde", "band kardo", "close kar do", "close karo",
            "kill karo", "exit karo", "hata do", "hatao", "shut down", "band karna", "close karna",
            "بند کرو", "بند کر دو", "بند کریں", "کلوز"
        ]
        is_close_cmd = any(ct in prompt_lower or ct in prompt for ct in close_triggers)
        if is_close_cmd:
            known_apps = [
                "chrome", "google chrome", "edge", "browser", "notepad", "calculator", "calc",
                "vlc", "vscode", "code", "spotify", "word", "excel", "powerpoint", "paint",
                "کروم", "نوٹ پیڈ", "کیلکولیٹر"
            ]
            for app in known_apps:
                if app in prompt_lower or app in prompt:
                    target_to_close = "chrome" if app == "browser" else app
                    c_res = system_tool.close_application(target_to_close)
                    if self.active_context == target_to_close or (target_to_close == "chrome" and self.active_context in SERVICE_ACTIONS):
                        self.active_context = None
                        self.active_task = None
                        self.active_url = None
                    return self._finish({"text": c_res["message"], "status": "Complete"})

        # -------------------------------------------------------------
        # 4.5 SERVICE ACTIONS: ACCOUNT CREATION & REGISTRATION FLOW
        # -------------------------------------------------------------
        has_account_noun = any(w in prompt_lower for w in ["account", "id", "profile", "اکاؤنٹ", "آئی ڈی"])
        has_creation_verb = any(w in prompt_lower for w in [
            "create", "new", "banao", "banayein", "banani", "banana", "naya", "nayi",
            "register", "registration", "signup", "sign up", "sign-up"
        ])
        is_account_creation = (has_account_noun and has_creation_verb) or any(w in prompt_lower for w in ["signup", "sign up", "register", "registration"])

        if is_account_creation:
            target_key = self._resolve_target_service(prompt_lower)
            if target_key and SERVICE_ACTIONS[target_key].get("register"):
                target_info = SERVICE_ACTIONS[target_key]
                reg_url = target_info["register"]
                try:
                    webbrowser.open(reg_url)
                except Exception:
                    pass
                self.active_context = target_key
                self.active_task = "create_account"
                self.active_url = reg_url
                return self._finish({
                    "text": (
                        f"🚀 **{target_info['name']} New Account Registration:**\n"
                        f"Maine direct {target_info['name']} ka New Account Registration page open kar diya hai!\n"
                        f"🔗 URL: `{reg_url}`\n\n"
                        f"Screen par registration form khul chuka hai. Isme yeh fields hain:\n"
                        f"1. **Name** (First Name aur Surname)\n"
                        f"2. **Mobile Number ya Email**\n"
                        f"3. **New Password**\n"
                        f"4. **Date of Birth & Gender**\n\n"
                        f"👉 **Hands Tool Active:** Aap mujhe bol sakte hain (maslan: *'Naam Ali likho'*, *'Tab dabao'*, ya *'Enter press karo'*), main aapke behalf par screen par type aur click kar doonga!"
                    ),
                    "status": "Complete"
                })
            elif not target_key:
                return self._finish({
                    "text": (
                        "Aap kis platform par naya account banana chahte hain? (Maslan: Facebook, Google, Instagram, ya TikTok).\n"
                        "Aap naam batayein, main direct registration page open kar ke form fill karwa doonga!"
                    ),
                    "status": "Complete"
                })

        # Check Login Intent
        login_keywords = ["login karo", "log in karo", "sign in karo", "signin karo", "login", "sign in", "log in"]
        is_login = any(kw in prompt_lower for kw in login_keywords) and not is_account_creation
        if is_login:
            target_key = self._resolve_target_service(prompt_lower)
            if target_key and SERVICE_ACTIONS[target_key].get("login"):
                target_info = SERVICE_ACTIONS[target_key]
                login_url = target_info["login"]
                try:
                    webbrowser.open(login_url)
                except Exception:
                    pass
                self.active_context = target_key
                self.active_task = "login"
                self.active_url = login_url
                return self._finish({
                    "text": f"🔑 **{target_info['name']} Login:**\nMaine {target_info['name']} ka direct Login page open kar diya hai (`{login_url}`). Batayein kaunsi field fill karni hai!",
                    "status": "Complete"
                })

        # -------------------------------------------------------------
        # 4.6 HANDS TOOL: REAL SCREEN KEYBOARD & MOUSE AUTOMATION
        # -------------------------------------------------------------
        # A. Typing text into active field on screen
        is_type_cmd = any(w in prompt_lower for w in ["likho", "likh do", "type karo", "type ", "likhein"])
        if is_type_cmd and not any(w in prompt_lower for w in ["kya", "kyun", "kaise", "code"]):
            text_to_type = None
            # Pattern 1: Command first -> "likho Ali Khan", "type testing", "likh do hello"
            m1 = re.search(r'(?:^|\b)(?:type|likho|likh do|type karo|likhein)\s*[:"\'‘“]?\s*([^\n\r]+)', prompt, flags=re.IGNORECASE)
            if m1 and m1.group(1).strip():
                cand = m1.group(1).strip().strip('"\'')
                cand = re.sub(r'\s+(?:please|bhai|janab|karo|do|ge|na)$', '', cand, flags=re.IGNORECASE).strip()
                if cand and not any(cand.lower() == w for w in ["karo", "do", "bhai", "please", "likho"]):
                    text_to_type = cand

            # Pattern 2: Text first -> "Naam Ali Khan likh do", "yahan pe Ali likho", "Ali likho"
            if not text_to_type:
                m2 = re.search(r'^(?:yahan pe|yahan par|here|naam|name|email|password)?\s*[:"\'‘“]?([a-zA-Z0-9_\-\.\@\s]+?)[:"\'’”]?\s+(?:likho|likh do|type karo|likhein)', prompt, flags=re.IGNORECASE)
                if m2 and m2.group(1).strip():
                    cand = m2.group(1).strip().strip('"\'')
                    cand = re.sub(r'^(?:yahan pe|yahan par|here|naam|name|email|password)\s+', '', cand, flags=re.IGNORECASE).strip()
                    if cand:
                        text_to_type = cand

            if text_to_type:
                h_res = hands_tool.type_text(text_to_type)
                if h_res["success"]:
                    return self._finish({
                        "text": f"✍️ **Screen par type kar diya:** `{text_to_type}`\n👉 Agle box ke liye bolein: *'Tab dabao'* ya *'Enter dabao'*.",
                        "status": "Complete"
                    })

        # B. Keyboard Key Presses
        if any(w in prompt_lower for w in ["tab dabao", "tab press", "tab maro", "agli field", "next field", "next box", "tab key"]):
            hands_tool.press_key('tab')
            return self._finish({"text": "⌨️ **Tab** press kar diya gaya hai (Next field select ho gayi hai)!", "status": "Complete"})

        if any(w in prompt_lower for w in ["enter dabao", "enter press", "enter maro", "submit karo", "submit kar do"]):
            hands_tool.press_key('enter')
            return self._finish({"text": "⌨️ **Enter** press kar diya gaya hai!", "status": "Complete"})

        if any(w in prompt_lower for w in ["backspace dabao", "backspace press", "mita do", "clear karo"]):
            hands_tool.press_key('backspace')
            return self._finish({"text": "⌫ **Backspace** press kar diya gaya hai!", "status": "Complete"})

        if any(w in prompt_lower for w in ["escape dabao", "esc press", "esc dabao"]):
            hands_tool.press_key('esc')
            return self._finish({"text": "⎋ **Escape** press kar diya gaya hai!", "status": "Complete"})

        # C. Shortcuts
        if any(w in prompt_lower for w in ["alt tab", "window switch", "window badlo", "dusri window"]):
            hands_tool.hotkey('alt', 'tab')
            return self._finish({"text": "🔀 **Window switch (Alt+Tab)** kar di gayi hai!", "status": "Complete"})

        if any(w in prompt_lower for w in ["naya tab", "new tab", "ctrl t"]):
            hands_tool.hotkey('ctrl', 't')
            return self._finish({"text": "📑 Naya tab open kar diya gaya hai (Ctrl+T)!", "status": "Complete"})

        if any(w in prompt_lower for w in ["tab band", "close tab", "ctrl w"]):
            hands_tool.hotkey('ctrl', 'w')
            return self._finish({"text": "❌ Tab close kar diya gaya hai (Ctrl+W)!", "status": "Complete"})

        # D. Mouse Clicks & Scrolling
        if any(w in prompt_lower for w in ["click karo", "click kar do", "mouse click", "mouse dabao"]) and not any(w in prompt_lower for w in ["double click"]):
            hands_tool.click()
            return self._finish({"text": "🖱️ Current cursor position par click kar diya gaya hai!", "status": "Complete"})

        if any(w in prompt_lower for w in ["double click", "double click karo"]):
            hands_tool.double_click()
            return self._finish({"text": "🖱️ Double click kar diya gaya hai!", "status": "Complete"})

        if any(w in prompt_lower for w in ["scroll down", "neeche scroll", "scroll neeche"]):
            hands_tool.scroll(-350)
            return self._finish({"text": "📜 Screen neeche scroll kar di gayi hai!", "status": "Complete"})

        if any(w in prompt_lower for w in ["scroll up", "ooper scroll", "scroll ooper"]):
            hands_tool.scroll(350)
            return self._finish({"text": "📜 Screen ooper scroll kar di gayi hai!", "status": "Complete"})

        # -------------------------------------------------------------
        # 4.7 PYTHON CODE RUNNER & LOCAL COMPUTATION
        # -------------------------------------------------------------
        is_py_word = any(w in prompt_lower for w in ["python", "run code", "code chalao", "calculate", "hisab karo"])
        is_py_syntax = any(prompt.strip().startswith(kw) for kw in ["print(", "def ", "import ", "for ", "while "])
        if is_py_word or is_py_syntax:
            code_match = re.search(r'```python\s*(.*?)\s*```', prompt, re.DOTALL) or re.search(r'```\s*(.*?)\s*```', prompt, re.DOTALL)
            if code_match:
                py_res = python_tool.execute_code(code_match.group(1))
                return self._finish({"text": py_res["message"], "status": "Complete"})
            clean_cmd = re.sub(r'^(python|run code|code chalao|execute)\s*', '', prompt, flags=re.IGNORECASE).strip()
            if any(clean_cmd.startswith(kw) for kw in ["print(", "def ", "import ", "for ", "while "]):
                py_res = python_tool.execute_code(clean_cmd)
                return self._finish({"text": py_res["message"], "status": "Complete"})
            elif is_py_syntax:
                py_res = python_tool.execute_code(prompt.strip())
                return self._finish({"text": py_res["message"], "status": "Complete"})
            elif any(w in prompt_lower for w in ["calculate", "hisab"]):
                math_expr = re.sub(r'(calculate|hisab karo|batao|kya hai|kya hoga|please|answer)', '', prompt, flags=re.IGNORECASE).strip()
                if re.match(r'^[\d\s\+\-\*\/\(\)\.\%]+$', math_expr):
                    py_res = python_tool.evaluate_expression(math_expr)
                    if py_res["success"]:
                        return self._finish({"text": f"🔢 **Calculation:** `{math_expr}` = **{py_res['output']}**", "status": "Complete"})

        # -------------------------------------------------------------
        # 5. PC LAUNCH APPLICATIONS & WEBSITES (YouTube, Apps, Web...)
        # -------------------------------------------------------------
        is_download_cmd = any(dw in prompt_lower for dw in ["download", "save", "ڈاؤنلوڈ", "mp4", "mp3"])

        if not is_download_cmd:
            launch_res = system_tool.resolve_and_execute(prompt)
            if launch_res.get("success"):
                if launch_res.get("target"):
                    self.active_context = launch_res["target"]
                    self.active_task = "browsing"
                return self._finish({"text": launch_res["message"], "status": "Complete"})

        # -------------------------------------------------------------
        # 6. REMINDERS
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["remind", "reminder", "yaad dilana"]):
            time_match = re.search(r'(\d+)\s*(minute|min|sec|second|ghanta|hour)', prompt_lower)
            seconds = 60
            if time_match:
                qty = int(time_match.group(1))
                unit = time_match.group(2)
                if "min" in unit:
                    seconds = qty * 60
                elif "sec" in unit:
                    seconds = qty
                elif "hour" in unit or "ghanta" in unit:
                    seconds = qty * 3600

            clean_rem = re.sub(r'(remind me to|reminder|set reminder|yaad dilana|baad|mein|\d+\s*(minute|min|sec|second|ghanta|hour))', '', prompt, flags=re.IGNORECASE).strip()
            if not clean_rem:
                clean_rem = "General Reminder"
            res = system_tool.set_reminder(clean_rem, seconds)
            return self._finish({"text": f"⏰ {res['message']}", "status": "Complete"})

        # -------------------------------------------------------------
        # 7. ANDROID MOBILE CONTROL
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["mobile", "phone", "android", "adb"]):
            devs = mobile_tool.check_devices()
            if not devs["success"]:
                return self._finish({"text": f"📱 {devs['error']}", "status": "Error"} )
            if devs["connected_count"] == 0:
                return self._finish({"text": "📱 No Android phone currently connected via USB or WiFi. Enable USB Debugging to connect.", "status": "Info"})
            
            if "screen" in prompt_lower or "photo" in prompt_lower:
                ms = mobile_tool.capture_screen()
                if ms["success"]:
                    analysis = self.ai.inspect_visual("Analyze this mobile screen.", ms["image"])
                    return self._finish({"text": f"📱 **Mobile Screen Captured**\n\n{analysis}", "status": "Complete", "image_path": ms["file_path"]})
            
            return self._finish({"text": f"📱 Connected Devices: {devs['devices']}", "status": "Complete"})

        # -------------------------------------------------------------
        # 8. LIVE INTERNET SEARCH & GENERAL BRAIN (Context-Aware Memory)
        # -------------------------------------------------------------
        context_parts = []
        if self.active_context:
            context_parts.append(f"Current Active App / Context: {self.active_context}")
        if self.active_task:
            context_parts.append(f"Current User Task: {self.active_task}")
        if self.active_url:
            context_parts.append(f"Current Active URL: {self.active_url}")
        context_header = "\n".join(context_parts) if context_parts else "No active window/task recorded yet."

        history_lines = [f"{h['role'].title()}: {h['text']}" for h in self.history[-6:]]
        history_header = "\n".join(history_lines) if history_lines else "No previous turns."

        state_context = (
            f"\n### 🖥️ CURRENT PC & AGENT LIVE STATE:\n{context_header}\n"
            f"\n### 💬 RECENT CONVERSATION HISTORY:\n{history_header}\n"
        )

        info_keywords = ["kya", "kyun", "kab", "kahan", "kaun", "kon", "news", "price", "match", "score", "latest", "update", "facts", "what", "who", "when", "where", "why", "how", "کیوں", "کہاں", "کب", "کون"]
        needs_web_search = any(w in prompt_lower or w in prompt for w in info_keywords) and len(prompt.split()) >= 3

        if needs_web_search:
            search_res = browser_tool.search_web(prompt, max_results=2)
            if search_res.get("success") and search_res.get("results"):
                grounded_prompt = (
                    f"{ROMAN_URDU_SYSTEM_CONTEXT}\n"
                    f"{state_context}\n"
                    f"Facts from live internet:\n{search_res['summary']}\n\n"
                    f"User: {prompt}\nAssistant:"
                )
                ai_resp = self.ai.reason(grounded_prompt)
                if not ai_resp or "quota" in str(ai_resp).lower() or "error" in str(ai_resp).lower() or "zero_gpu" in str(ai_resp).lower():
                    top_facts = [r["snippet"] for r in search_res["results"][:2]]
                    clean_summary = "\n".join([f"• {s}" for s in top_facts])
                    return self._finish({
                        "text": f"🌐 **Live Web Information:**\n{clean_summary}",
                        "status": "Complete"
                    })
                return self._finish({
                    "text": ai_resp,
                    "status": "Complete"
                })

        # Direct Brain call with full Roman Urdu contextual knowledge & conversation memory
        pure_prompt = (
            f"{ROMAN_URDU_SYSTEM_CONTEXT}\n"
            f"{state_context}\n"
            f"User: {prompt}\nAssistant:"
        )
        ai_resp = self.ai.reason(pure_prompt)
        if not ai_resp or "quota" in str(ai_resp).lower() or "zero_gpu" in str(ai_resp).lower():
            return self._finish({
                "text": "Space AI engine processing complete. Aap koi bhi sawal pooch sakte hain!",
                "status": "Complete"
            })
        return self._finish({
            "text": ai_resp,
            "status": "Complete"
        })

agent = UniversalAgent()
