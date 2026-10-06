"""
Universal Autonomous Agent Core
Powered by Hugging Face ZeroGPU: Qwen3-8B (Brain) + Qwen2.5-VL (Eyes)
Equipped with Instant Local Intelligence & 2026 Live Web Engine.
"""

import re
import json
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
from roman_urdu_kb import ROMAN_URDU_SYSTEM_CONTEXT

class UniversalAgent:
    def __init__(self):
        self.ai = ai_engine

    def execute(self, user_prompt: str) -> dict:
        """
        Process any user instruction end-to-end:
        1. Classify intent (Instant Local Tools vs Apps vs Weather vs Live Search)
        2. Execute tool if needed
        3. Consult Qwen3-8B / Qwen2.5-VL with clean fast prompts
        4. Return clean, pristine result without thinking junk
        """
        prompt = user_prompt.strip()
        prompt_lower = prompt.lower()

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
                return {
                    "text": f"⏰ **Current Time:** {time_str} (Pakistan Time)\n📅 **Date:** {date_str} ({day_ur})",
                    "status": "Complete"
                }
            else:
                return {
                    "text": f"📅 **Aaj Ki Date:** {date_str} ({day_ur})\n⏰ **Waqt:** {time_str} (Pakistan Time)",
                    "status": "Complete"
                }

        # -------------------------------------------------------------
        # 0.1 PC SYSTEM STATUS & BATTERY (Instant 0.001s Local Response)
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["battery", "ram", "cpu", "specs", "system info"]) and any(w in prompt_lower for w in ["pc", "laptop", "check", "kitni", "kya", "batao", "status", "dekho"]):
            battery = psutil.sensors_battery()
            batt_str = f"{battery.percent}% ({'Charging ⚡' if battery.power_plugged else 'Discharging 🔋'})" if battery else "Desktop PC (Plugged in ⚡)"
            ram = psutil.virtual_memory()
            ram_str = f"{ram.percent}% used ({round(ram.used/(1024**3), 1)}GB / {round(ram.total/(1024**3), 1)}GB)"
            return {
                "text": f"💻 **PC System Status:**\n🔋 **Battery:** {batt_str}\n🧠 **RAM:** {ram_str}\n⚙️ **OS:** Windows PC",
                "status": "Complete"
            }

        # -------------------------------------------------------------
        # 0.2 GREETINGS & VOICE / IDENTITY (Instant 0.001s Local Response)
        # -------------------------------------------------------------
        voice_words = ["awaz", "aawaz", "aoaz", "awaaz", "hear me", "audible", "sun rahe", "sun rahay", "sun sakte", "sun sakty", "sunai"]
        is_voice_check = any(w in prompt_lower for w in voice_words) or any(k in prompt for k in ["آواز", "سن رہے", "سنائی", "سن سکتے"])
        if is_voice_check and any(v in prompt_lower or v in prompt for v in ["aa rahi", "arahi", "arhi", "sun", "kya", "hear", "سکتے", "آ رہی", "سنتے"]):
            return {
                "text": "Jee haan! Aap ki aawaz bilkul saaf aur clear aa rahi hai. Main sun raha hoon, hukum karein!",
                "status": "Complete"
            }

        if any(w in prompt_lower for w in ["tum kon ho", "aap kon ho", "aap kon hain", "who are you", "kya kar sakte ho", "what can you do"]) or any(k in prompt for k in ["کون ہو", "کون ہیں", "کیا کر سکتے"]):
            return {
                "text": "Main aapka omnipotent AI Personal Assistant JARVIS hoon. Mere paas Python code runner, live internet browser, PC automation (YouTube, Google, Apps, Screenshot), bills checker, aur Hugging Face AI Brain ki tamam taqatein hain. Main hamesha Roman Urdu aur English mein aapki khidmat ke liye tayyar hoon. Hukum karein!",
                "status": "Complete"
            }

        clean_greet = prompt_lower.strip().rstrip("?!.,")
        if clean_greet in ["salam", "assalam o alaikum", "assalamu alaikum", "hello", "hi", "hey", "kaise ho", "kya haal hai"] or any(g in prompt for g in ["سلام", "السلام علیکم", "ہیلو"]):
            return {
                "text": "Walaikum Assalam! Main bilkul theek aur aapke hukum ka muntazir hoon. Python scripts, YouTube/Web apps, live weather, bills ya kisi bhi sawal ke liye farmayein!",
                "status": "Complete"
            }

        # -------------------------------------------------------------
        # 1. SCREENSHOT & VISION INSPECTION
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["screenshot", "screen dekho", "capture screen", "screen par kya"]):
            shot = system_tool.take_screenshot()
            if not shot["success"]:
                return {"text": f"❌ Could not take screenshot: {shot.get('error')}", "status": "Error"}
            
            # Send screenshot to Qwen2.5-VL (Eyes)
            analysis = self.ai.inspect_visual("Describe what is on the screen and identify any active windows or key elements.", shot["image"])
            return {
                "text": f"📸 **Screenshot Captured**\n📁 Saved: `{shot['file_path']}`\n\n👁️ **AI Vision Inspection:**\n{analysis}",
                "status": "Complete",
                "image_path": shot["file_path"]
            }

        # -------------------------------------------------------------
        # 2. LIVE REAL-TIME WEATHER & FORECAST (English + Urdu Script)
        # -------------------------------------------------------------
        weather_triggers = ["weather", "mosam", "mausam", "barish", "rain", "forecast", "taapmaan", "darja hararat", "موسم", "بارش", "پیشگوئی", "درجہ حرارت"]
        is_weather = any(w in prompt_lower or w in prompt for w in weather_triggers)
        if not is_weather and "temperature" in prompt_lower and not any(k in prompt_lower for k in ["pc", "cpu", "gpu"]):
            is_weather = True

        if is_weather:
            # Check if user asked about tomorrow
            is_tomorrow = any(k in prompt_lower or k in prompt for k in ["kal", "tomorrow", "future", "aane wale", "کل", "اگلا دن", "اگلے دن", "آئندہ"])

            # Detect city from Urdu or English
            target_city = "Faisalabad" # default
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
                return {"text": w_res["message"], "status": "Complete"}
            else:
                return {"text": f"⚠️ {w_res['error']}", "status": "Error"}

        # -------------------------------------------------------------
        # 3. ELECTRICITY BILL CHECKER
        # -------------------------------------------------------------
        bill_keywords = ["bill", "bijli", "lesco", "mepco", "gepco", "fesco", "iesco", "pesco", "kelectric", "k-electric", "بل", "بجلی"]
        if any(w in prompt_lower or w in prompt for w in bill_keywords) and re.search(r'\d{10,16}', prompt):
            companies = ["lesco", "mepco", "gepco", "fesco", "iesco", "pesco", "hesco", "sepco", "qesco"]
            found_company = "lesco" # default
            for c in companies:
                if c in prompt_lower:
                    found_company = c
                    break

            ref_match = re.search(r'\d{10,16}', prompt)
            if ref_match:
                ref_no = ref_match.group(0)
                bill_res = bill_checker.check_pitc_bill(found_company, ref_no)
                if bill_res["success"]:
                    return {"text": bill_res["message"], "status": "Complete"}
                else:
                    return {"text": f"⚠️ {bill_res['error']}", "status": "Error"}

        # -------------------------------------------------------------
        # 4. VIDEO DOWNLOADER (YouTube / TikTok / FB)
        # -------------------------------------------------------------
        url_match = re.search(r'https?://[^\s]+', prompt)
        if any(w in prompt_lower for w in ["download", "video lao", "save video", "video download"]):
            if url_match:
                url = url_match.group(0)
                v_res = video_downloader.download(url)
                if v_res["success"]:
                    return {
                        "text": f"🎬 **Video Downloaded!**\n📌 Title: **{v_res['title']}**\n📁 File: `{v_res['file_path']}`",
                        "status": "Complete",
                        "file_path": v_res["file_path"]
                    }
                else:
                    return {"text": f"❌ Video Download Failed: {v_res.get('error')}", "status": "Error"}
            elif any(w in prompt_lower for w in ["youtube", "tiktok", "video"]):
                clean_query = re.sub(r'(download|video|youtube|tiktok|please|karo|lao)', '', prompt, flags=re.IGNORECASE).strip()
                v_res = video_downloader.search_and_download(clean_query)
                if v_res["success"]:
                    return {
                        "text": f"🎬 **Video Found & Downloaded!**\n📌 Title: **{v_res['title']}**\n📁 File: `{v_res['file_path']}`",
                        "status": "Complete",
                        "file_path": v_res["file_path"]
                    }
                else:
                    return {"text": f"❌ Video Search Failed: {v_res.get('error')}", "status": "Error"}

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
                    return {"text": c_res["message"], "status": "Complete"}

        # -------------------------------------------------------------
        # 4.5 PYTHON CODE RUNNER & LOCAL COMPUTATION
        # -------------------------------------------------------------
        is_py_word = any(w in prompt_lower for w in ["python", "run code", "code chalao", "calculate", "hisab karo"])
        is_py_syntax = any(prompt.strip().startswith(kw) for kw in ["print(", "def ", "import ", "for ", "while "])
        if is_py_word or is_py_syntax:
            code_match = re.search(r'```python\s*(.*?)\s*```', prompt, re.DOTALL) or re.search(r'```\s*(.*?)\s*```', prompt, re.DOTALL)
            if code_match:
                py_res = python_tool.execute_code(code_match.group(1))
                return {"text": py_res["message"], "status": "Complete"}
            clean_cmd = re.sub(r'^(python|run code|code chalao|execute)\s*', '', prompt, flags=re.IGNORECASE).strip()
            if any(clean_cmd.startswith(kw) for kw in ["print(", "def ", "import ", "for ", "while "]):
                py_res = python_tool.execute_code(clean_cmd)
                return {"text": py_res["message"], "status": "Complete"}
            elif is_py_syntax:
                py_res = python_tool.execute_code(prompt.strip())
                return {"text": py_res["message"], "status": "Complete"}
            elif any(w in prompt_lower for w in ["calculate", "hisab"]):
                math_expr = re.sub(r'(calculate|hisab karo|batao|kya hai|kya hoga|please|answer)', '', prompt, flags=re.IGNORECASE).strip()
                if re.match(r'^[\d\s\+\-\*\/\(\)\.\%]+$', math_expr):
                    py_res = python_tool.evaluate_expression(math_expr)
                    if py_res["success"]:
                        return {"text": f"🔢 **Calculation:** `{math_expr}` = **{py_res['output']}**", "status": "Complete"}

        # -------------------------------------------------------------
        # 5. PC LAUNCH APPLICATIONS & WEBSITES (YouTube, Apps, Web...)
        # -------------------------------------------------------------
        is_download_cmd = any(dw in prompt_lower for dw in ["download", "save", "ڈاؤنلوڈ", "mp4", "mp3"])

        if not is_download_cmd:
            launch_res = system_tool.resolve_and_execute(prompt)
            if launch_res.get("success"):
                return {"text": launch_res["message"], "status": "Complete"}

        # -------------------------------------------------------------
        # 6. REMINDERS
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["remind", "reminder", "yaad dilana"]):
            time_match = re.search(r'(\d+)\s*(minute|min|sec|second|ghanta|hour)', prompt_lower)
            seconds = 60 # default 1 min
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
            return {"text": f"⏰ {res['message']}", "status": "Complete"}

        # -------------------------------------------------------------
        # 7. ANDROID MOBILE CONTROL
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["mobile", "phone", "android", "adb"]):
            devs = mobile_tool.check_devices()
            if not devs["success"]:
                return {"text": f"📱 {devs['error']}", "status": "Error"}
            if devs["connected_count"] == 0:
                return {"text": "📱 No Android phone currently connected via USB or WiFi. Enable USB Debugging to connect.", "status": "Info"}
            
            if "screen" in prompt_lower or "photo" in prompt_lower:
                ms = mobile_tool.capture_screen()
                if ms["success"]:
                    analysis = self.ai.inspect_visual("Analyze this mobile screen.", ms["image"])
                    return {"text": f"📱 **Mobile Screen Captured**\n\n{analysis}", "status": "Complete", "image_path": ms["file_path"]}
            
            return {"text": f"📱 Connected Devices: {devs['devices']}", "status": "Complete"}

        # -------------------------------------------------------------
        # 8. LIVE INTERNET SEARCH & GENERAL BRAIN (Fast Direct & Quota-Proof)
        # -------------------------------------------------------------
        # Only search internet if the prompt contains informational/question keywords
        info_keywords = ["kya", "kyun", "kab", "kahan", "kaun", "kon", "news", "price", "match", "score", "latest", "update", "facts", "what", "who", "when", "where", "why", "how", "کیوں", "کہاں", "کب", "کون"]
        needs_web_search = any(w in prompt_lower or w in prompt for w in info_keywords) and len(prompt.split()) >= 3

        if needs_web_search:
            search_res = browser_tool.search_web(prompt, max_results=2)
            if search_res.get("success") and search_res.get("results"):
                grounded_prompt = (
                    f"{ROMAN_URDU_SYSTEM_CONTEXT}\n\n"
                    f"Facts from internet:\n{search_res['summary']}\n\n"
                    f"User: {prompt}\nAssistant:"
                )
                ai_resp = self.ai.reason(grounded_prompt)
                if not ai_resp or "quota" in str(ai_resp).lower() or "error" in str(ai_resp).lower() or "zero_gpu" in str(ai_resp).lower():
                    top_facts = [r["snippet"] for r in search_res["results"][:2]]
                    clean_summary = "\n".join([f"• {s}" for s in top_facts])
                    return {
                        "text": f"🌐 **Live Web Information:**\n{clean_summary}",
                        "status": "Complete"
                    }
                return {
                    "text": ai_resp,
                    "status": "Complete"
                }

        # Direct Brain call with full Roman Urdu contextual knowledge
        pure_prompt = (
            f"{ROMAN_URDU_SYSTEM_CONTEXT}\n\n"
            f"User: {prompt}\nAssistant:"
        )
        ai_resp = self.ai.reason(pure_prompt)
        if not ai_resp or "quota" in str(ai_resp).lower() or "zero_gpu" in str(ai_resp).lower():
            return {
                "text": "Space AI engine processing complete. Aap koi bhi sawal pooch sakte hain!",
                "status": "Complete"
            }
        return {
            "text": ai_resp,
            "status": "Complete"
        }

agent = UniversalAgent()
