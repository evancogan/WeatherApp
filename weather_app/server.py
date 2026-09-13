from flask import Flask, jsonify, request, send_from_directory

from weather_api import get_weather
from weather_theme import icon_for, color_hex_for

app = Flask(__name__, static_folder="static", static_url_path="")


def _day_summary(day):
    """Pick a representative condition from a wttr.in forecast day's hourly entries."""
    hourly = day.get("hourly", [])
    midday = hourly[len(hourly) // 2] if hourly else {}
    desc = midday.get("weatherDesc", [{"value": "Unknown"}])[0]["value"]
    return {
        "date": day.get("date"),
        "max_temp_c": float(day["maxtempC"]),
        "min_temp_c": float(day["mintempC"]),
        "condition": desc,
        "icon": icon_for(midday.get("weatherCode", 0)),
    }


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/weather")
def api_weather():
    city = request.args.get("city", "").strip()
    weather_data = get_weather(city)

    if not weather_data:
        return jsonify({"error": "City not found or connection error"}), 502

    try:
        city_name = weather_data["nearest_area"][0]["areaName"][0]["value"]
    except (KeyError, IndexError):
        city_name = "Unknown"

    current = weather_data["current_condition"][0]
    condition = current["weatherDesc"][0]["value"]
    weather_code = current.get("weatherCode", 0)

    return jsonify({
        "city": city_name,
        "temp_c": float(current["temp_C"]),
        "condition": condition,
        "icon": icon_for(weather_code),
        "color_hex": color_hex_for(weather_code),
        "forecast": [_day_summary(day) for day in weather_data.get("weather", [])[:3]],
    })


if __name__ == "__main__":
    app.run(debug=True)
