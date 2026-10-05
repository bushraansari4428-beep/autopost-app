"""
Universal Autonomous Agent Core
Powered by Hugging Face ZeroGPU: Qwen3-8B (Brain) + Qwen2.5-VL (Eyes)
"""

import re
import json
from hf_client import ai_engine
from tools.system_tool import system_tool
from tools.video_downloader import video_downloader
from tools.bill_checker import bill_checker
from tools.browser_tool import browser_tool
from tools.mobile_tool import mobile_tool

class UniversalAgent:
    def __init__(self):
        self.ai = ai_engine

    def execute(self, user_prompt: str) -> dict:
        """
        Process any user instruction end-to-end:
        1. Classify intent (Tool vs Reasoning)
        2. Execute tool if needed
        3. Consult Qwen3-8B / Qwen2.5-VL
        4. Return unified result
        """
        prompt = user_prompt.strip()
        prompt_lower = prompt.lower()

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
        # 2. ELECTRICITY BILL CHECKER
        # -------------------------------------------------------------
        bill_keywords = ["bill", "bijli", "lesco", "mepco", "gepco", "fesco", "iesco", "pesco", "kelectric", "k-electric"]
        if any(w in prompt_lower for w in bill_keywords) and re.search(r'\d{10,16}', prompt):
            # Extract company and reference number
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
        # 3. VIDEO DOWNLOADER (YouTube / TikTok / FB)
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
                # Search and download top video
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
        # 4. WEB SEARCH / BROWSING
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["search", "google", "dhoondo", "find info", "browse", "talaash"]):
            search_query = re.sub(r'(search|google|karo|dhoondo|find|please|about)', '', prompt, flags=re.IGNORECASE).strip()
            web_res = browser_tool.search_web(search_query)
            if web_res["success"] and web_res["results"]:
                # Synthesize with Qwen3-8B
                synth_prompt = f"Summarize the following search results for the user query '{search_query}':\n{web_res['summary']}"
                summary = self.ai.reason(synth_prompt)
                return {
                    "text": f"🌐 **Search Results for:** *{search_query}*\n\n{summary}\n\n**Sources:**\n{web_res['summary']}",
                    "status": "Complete"
                }

        # -------------------------------------------------------------
        # 5. PC LAUNCH APPLICATIONS
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["open", "kholo", "launch", "chalao"]):
            for app in ["chrome", "notepad", "calculator", "calc", "explorer", "cmd", "vscode", "terminal", "vlc"]:
                if app in prompt_lower:
                    res = system_tool.open_application(app)
                    return {"text": f"🚀 {res['message']}", "status": "Complete"}

        # -------------------------------------------------------------
        # 6. REMINDERS
        # -------------------------------------------------------------
        if any(w in prompt_lower for w in ["remind", "reminder", "yaad dilana"]):
            # Look for minutes / seconds
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
        # 8. GENERAL AI REASONING / BRAIN (Qwen3-8B)
        # -------------------------------------------------------------
        ai_resp = self.ai.reason(prompt)
        return {
            "text": ai_resp,
            "status": "Complete"
        }

agent = UniversalAgent()
