"""
Live Real-Time Weather & Forecast Tool
Fetches instant live weather and tomorrow's forecast for any city.
Supports both English and Urdu city names.
"""

import urllib.request
import urllib.parse
import json

URDU_CITY_MAP = {
    "فیصل آباد": "Faisalabad",
    "فیصلاباد": "Faisalabad",
    "لاہور": "Lahore",
    "کراچی": "Karachi",
    "اسلام آباد": "Islamabad",
    "اسلاماباد": "Islamabad",
    "راولپنڈی": "Rawalpindi",
    "ملتان": "Multan",
    "پشاور": "Peshawar",
    "کوئٹہ": "Quetta",
    "سیالکوٹ": "Sialkot",
    "گوجرانوالہ": "Gujranwala",
    "سرگودھا": "Sargodha",
    "بہاولپور": "Bahawalpur",
    "سکھر": "Sukkur",
    "حیدرآباد": "Hyderabad"
}

class WeatherTool:
    def get_weather(self, city: str = "Faisalabad", is_tomorrow: bool = False) -> dict:
        """Fetch live temperature, condition, humidity, and wind (or tomorrow's forecast)."""
        # Map Urdu city names
        target_city = city.strip()
        for urdu_name, eng_name in URDU_CITY_MAP.items():
            if urdu_name in target_city:
                target_city = eng_name
                break

        clean_city = target_city.replace(" ", "+")
        if not clean_city:
            clean_city = "Faisalabad"

        url = f"https://wttr.in/{urllib.parse.quote(clean_city)}?format=j1"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "curl/7.68.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))
                
                if is_tomorrow and len(data.get("weather", [])) > 1:
                    # Tomorrow's Forecast
                    tomorrow = data["weather"][1]
                    date = tomorrow.get("date", "Tomorrow")
                    max_temp = tomorrow.get("maxtempC", "N/A")
                    min_temp = tomorrow.get("mintempC", "N/A")
                    hourly = tomorrow.get("hourly", [{}])
                    desc = hourly[4].get("weatherDesc", [{}])[0].get("value", "Clear") if len(hourly) > 4 else "Clear"
                    rain_chance = hourly[4].get("chanceofrain", "0") if len(hourly) > 4 else "0"

                    msg = (
                        f"🌤️ **{target_city.title()} Ka Kal Ka Mosam (Tomorrow's Forecast):**\n"
                        f"• **Date**: {date}\n"
                        f"• **Condition**: {desc}\n"
                        f"• **Maximum Temperature**: {max_temp}°C\n"
                        f"• **Minimum Temperature**: {min_temp}°C\n"
                        f"• **Barish Ka Imkan (Rain Chance)**: {rain_chance}%\n"
                    )
                    return {
                        "success": True,
                        "city": target_city.title(),
                        "is_tomorrow": True,
                        "message": msg
                    }
                else:
                    # Current Live Weather
                    current = data.get("current_condition", [{}])[0]
                    temp_c = current.get("temp_C", "N/A")
                    feels_like = current.get("FeelsLikeC", temp_c)
                    desc = current.get("weatherDesc", [{}])[0].get("value", "Clear")
                    humidity = current.get("humidity", "N/A")
                    wind_kmph = current.get("windspeedKmph", "N/A")

                    msg = (
                        f"🌤️ **Live Weather for {target_city.title()}:**\n"
                        f"• **Condition**: {desc}\n"
                        f"• **Temperature**: {temp_c}°C (Feels like {feels_like}°C)\n"
                        f"• **Humidity**: {humidity}%\n"
                        f"• **Wind Speed**: {wind_kmph} km/h"
                    )
                    return {
                        "success": True,
                        "city": target_city.title(),
                        "temp_c": temp_c,
                        "condition": desc,
                        "message": msg
                    }
        except Exception as e:
            # Fallback simple format
            try:
                simple_url = f"https://wttr.in/{urllib.parse.quote(clean_city)}?format=%C:+%t+(Feels+like+%f),+Wind:+%w,+Humidity:+%h"
                req = urllib.request.Request(simple_url, headers={"User-Agent": "curl/7.68.0"})
                with urllib.request.urlopen(req, timeout=8) as r:
                    res_str = r.read().decode("utf-8").strip()
                    return {
                        "success": True,
                        "city": target_city.title(),
                        "message": f"🌤️ **Live Weather for {target_city.title()}:**\n{res_str}"
                    }
            except Exception as e2:
                return {"success": False, "error": f"Could not fetch weather: {e2}"}

weather_tool = WeatherTool()
