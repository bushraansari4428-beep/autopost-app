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
from tools.weather_tool import weather_tool, URDU_CITY_MAP

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
        # 0.2 GREETINGS & IDENTITY (Instant 0.001s Local Response)
        # -------------------------------------------------------------
        clean_greet = prompt_lower.strip().rstrip("?!.,")
        if clean_greet in ["salam", "assalam o alaikum", "assalamu alaikum", "hello", "hi", "hey", "kaise ho", "kya haal hai", "tum kon ho", "who are you"]:
            return {
                "text": "Walaikum Assalam! Main aapka personal AI assistant hoon. Main aapke hukam par LESCO/MEPCO bijli bills check kar sakta hoon, YouTube/TikTok videos download kar sakta hoon, PC apps/websites khol sakta hoon, live mosam bata sakta hoon, aur internet se sawalaat ke fori jawabaat de sakta hoon. Hukum karein!",
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
        weather_words = [
            "weather", "mosam", "mausam", "temperature", "taapmaan", "rain", "barish", "dhoop", "sardi", "garmi",
            "thand", "humidity", "forecast", "hawa",
            "موسم", "بارش", "درجہ حرارت", "گرمی", "سردی", "دھوپ", "طوفان", "بادل", "ٹھنڈ", "پیشگوئی", "ہوا"
        ]
        if any(w in prompt_lower or w in prompt for w in weather_words):
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
        # 5. PC LAUNCH APPLICATIONS & WEBSITES (YouTube, Apps, Web...)
        # -------------------------------------------------------------
        launch_triggers = [
            "open", "kholo", "khol do", "launch", "chalao", "chalana", "start", "run",
            "کھولو", "کھول دو", "چلاؤ", "اوپن"
        ]
        is_launch_cmd = any(w in prompt_lower or w in prompt for w in launch_triggers)
        is_download_cmd = any(dw in prompt_lower for dw in ["download", "save", "ڈاؤنلوڈ", "mp4", "mp3"])

        if not is_download_cmd:
            all_known = list(system_tool.WEB_SERVICES.keys()) + list(system_tool.WINDOWS_APPS.keys())
            for key in all_known:
                if key in prompt_lower or key in prompt:
                    if is_launch_cmd or prompt_lower.strip() == key or prompt.strip() == key:
                        res = system_tool.open_target(key)
                        if res["success"]:
                            return {"text": f"{res['message']}", "status": "Complete"}

            if is_launch_cmd:
                clean_target = re.sub(
                    r'(open|khol do|kholo|launch|chalao|start|run|please|bhai|bhi|kar do|karo|کھولو|کھول دو|چلاؤ|اوپن)',
                    '',
                    prompt,
                    flags=re.IGNORECASE
                ).strip()
                if clean_target and len(clean_target) > 2:
                    res = system_tool.open_target(clean_target)
                    if res["success"]:
                        return {"text": f"{res['message']}", "status": "Complete"}

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
        # 8. LIVE INTERNET SEARCH & GENERAL BRAIN (Qwen3-8B Fast Direct)
        # -------------------------------------------------------------
        # For general queries, perform fast live web search and return direct answer
        search_res = browser_tool.search_web(prompt, max_results=2)
        if search_res.get("success") and search_res.get("results"):
            grounded_prompt = (
                f"IMPORTANT: Answer directly and concisely in 1-2 sentences in Roman Urdu (or English/Urdu matching user).\n"
                f"CRITICAL: Do NOT output any <think> tags. Do NOT show reasoning steps. Output only the final clean answer.\n\n"
                f"Facts:\n{search_res['summary']}\n\n"
                f"Question: {prompt}"
            )
            ai_resp = self.ai.reason(grounded_prompt)
            return {
                "text": ai_resp,
                "status": "Complete"
            }
        else:
            # Direct Brain call
            pure_prompt = (
                f"IMPORTANT: Answer directly and concisely in 1-2 sentences in Roman Urdu (or English/Urdu matching user).\n"
                f"CRITICAL: Do NOT output any <think> tags. Do NOT show reasoning steps. Output only the final clean answer.\n\n"
                f"Question: {prompt}"
            )
            ai_resp = self.ai.reason(pure_prompt)
            return {
                "text": ai_resp,
                "status": "Complete"
            }

agent = UniversalAgent()
