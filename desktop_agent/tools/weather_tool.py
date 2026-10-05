"""
Live Real-Time Weather Tool
Fetches instant live weather for any city in Pakistan or worldwide.
"""

import urllib.request
import urllib.parse
import json

class WeatherTool:
    def get_weather(self, city: str = "Faisalabad") -> dict:
        """Fetch live temperature, condition, humidity, and wind."""
        clean_city = city.strip().replace(" ", "+")
        if not clean_city:
            clean_city = "Faisalabad"

        url = f"https://wttr.in/{urllib.parse.quote(clean_city)}?format=j1"
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "curl/7.68.0"})
            with urllib.request.urlopen(req, timeout=10) as response:
                data = json.loads(response.read().decode("utf-8"))
                current = data.get("current_condition", [{}])[0]
                temp_c = current.get("temp_C", "N/A")
                feels_like = current.get("FeelsLikeC", temp_c)
                desc = current.get("weatherDesc", [{}])[0].get("value", "Clear")
                humidity = current.get("humidity", "N/A")
                wind_kmph = current.get("windspeedKmph", "N/A")

                msg = (
                    f"🌤️ **Live Weather for {city.title()}:**\n"
                    f"• **Condition**: {desc}\n"
                    f"• **Temperature**: {temp_c}°C (Feels like {feels_like}°C)\n"
                    f"• **Humidity**: {humidity}%\n"
                    f"• **Wind Speed**: {wind_kmph} km/h"
                )
                return {
                    "success": True,
                    "city": city.title(),
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
                        "city": city.title(),
                        "message": f"🌤️ **Live Weather for {city.title()}:**\n{res_str}"
                    }
            except Exception as e2:
                return {"success": False, "error": f"Could not fetch weather: {e2}"}

weather_tool = WeatherTool()
