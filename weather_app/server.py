from datetime import date, datetime

from flask import Flask, jsonify, request, send_from_directory

from moon import upcoming_phases
from weather_api import get_weather
from weather_theme import icon_for, color_hex_for

app = Flask(__name__, static_folder="static", static_url_path="")


def _local_today(weather_data):
    """The calendar date where the weather is, not where this server runs."""
    observed = weather_data.get("current_condition", [{}])[0].get("localObsDateTime", "")
    try:
        return datetime.strptime(observed, "%Y-%m-%d %I:%M %p").date()
    except ValueError:
        pass
    # Fall back to the first forecast day, which wttr.in always reports as "today".
    try:
        return date.fromisoformat(weather_data["weather"][0]["date"])
    except (KeyError, IndexError, ValueError):
        return date.today()


def _day_label(day_date, today):
    """Human day name: Today, Tomorrow, then the weekday (Tuesday, Wednesday...)."""
    offset = (day_date - today).days
    if offset == 0:
        return "Today"
    if offset == 1:
        return "Tomorrow"
    return day_date.strftime("%A")


def _day_summary(day, today):
    """Pick a representative condition from a wttr.in forecast day's hourly entries."""
    hourly = day.get("hourly", [])
    midday = hourly[len(hourly) // 2] if hourly else {}
    desc = midday.get("weatherDesc", [{"value": "Unknown"}])[0]["value"]

    raw_date = day.get("date")
    try:
        label = _day_label(date.fromisoformat(raw_date), today)
    except (TypeError, ValueError):
        label = raw_date or "Unknown"

    return {
        "date": raw_date,
        "day_label": label,
        "max_temp_c": float(day["maxtempC"]),
        "min_temp_c": float(day["mintempC"]),
        "condition": desc,
        "icon": icon_for(midday.get("weatherCode", 0)),
    }


def _almanac(weather_data, today):
    """Sunrise/sunset for today and tomorrow, plus moon phase data for the
    Almanac screen. Every field here comes from data wttr.in already returned
    for the forecast, except the four upcoming phase dates, which are not in
    its response and are computed locally (see moon.py).
    """
    days = []
    for day in weather_data.get("weather", [])[:2]:
        try:
            astronomy = day["astronomy"][0]
            label = _day_label(date.fromisoformat(day["date"]), today)
        except (KeyError, IndexError, TypeError, ValueError):
            continue
        days.append({
            "day_label": label,
            "sunrise": astronomy.get("sunrise", "--"),
            "sunset": astronomy.get("sunset", "--"),
        })

    current_astronomy = weather_data.get("weather", [{}])[0].get("astronomy", [{}])[0]

    return {
        "days": days,
        "moon_phase": current_astronomy.get("moon_phase", "Unknown"),
        "moon_illumination": current_astronomy.get("moon_illumination", "0"),
        "upcoming_phases": upcoming_phases(today),
    }


def _observations(current):
    """Footer data-bar fields, straight off the current conditions block."""
    return {
        "visibility_miles": current.get("visibilityMiles", "--"),
        "pressure_inches": current.get("pressureInches", "--"),
        "wind_dir": current.get("winddir16Point", "--"),
        "wind_mph": current.get("windspeedMiles", "--"),
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
    today = _local_today(weather_data)

    return jsonify({
        "city": city_name,
        "temp_c": float(current["temp_C"]),
        "condition": condition,
        "icon": icon_for(weather_code),
        "color_hex": color_hex_for(weather_code),
        "forecast": [_day_summary(day, today) for day in weather_data.get("weather", [])[:3]],
        "almanac": _almanac(weather_data, today),
        "observations": _observations(current),
    })


if __name__ == "__main__":
    app.run(debug=True)
