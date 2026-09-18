import sys
from datetime import date, datetime
from pathlib import Path

from flask import Flask, jsonify, request, send_from_directory

from horoscope import daily_horoscopes
from moon import upcoming_phases
from regional import regional_observations
from weather_api import get_weather
from weather_theme import icon_for, color_hex_for

# A PyInstaller build unpacks its bundled data under sys._MEIPASS rather than
# beside this file, and Flask resolves a relative static_folder against the
# module path, so the folder is spelled out here instead of as "static".
_BUNDLE_ROOT = Path(getattr(sys, "_MEIPASS", Path(__file__).parent))

app = Flask(__name__, static_folder=str(_BUNDLE_ROOT / "static"), static_url_path="")

# Everything the <audio> elements will play. Anything else in the folder is
# ignored rather than handed to the browser as a track.
MUSIC_EXTENSIONS = {".mp3", ".ogg", ".wav", ".m4a", ".flac"}

# A track by this name is the power-on sting rather than part of the rotation.
POWER_ON_STEMS = {"soundeffect", "power-on", "poweron"}

# Dropped into an empty music folder so a fresh install shows what goes there
# and how to name it. Empty on purpose -- the channel skips a track it cannot
# decode, so the placeholder is a signpost, not something that plays.
PLACEHOLDER_TRACK = "VintageWeatherTheme.mp3"

PLACEHOLDER_README = """\
Drop your music here.

Every audio file in this folder (.mp3 .ogg .wav .m4a .flac) becomes part of the
channel's rotation, played in alphabetical order and looped forever. Add as many
as you like -- there is nothing to configure.

Name one file "soundeffect.mp3" and it becomes the power-on sting instead: it
fires once when you click TUNE IN and is left out of the rotation.

VintageWeatherTheme.mp3 is an empty placeholder showing where a track goes.
Replace it with a real file, or delete it.
"""


def _music_dir():
    """Where the soundtrack lives: beside the .exe when frozen, in the repo
    otherwise. Not under sys._MEIPASS -- PyInstaller unpacks that tree fresh on
    every launch and deletes it on exit, so files added there do not survive.
    """
    if getattr(sys, "frozen", False):
        return Path(sys.executable).parent / "music"
    return Path(__file__).parent / "static" / "music"


def _music_files():
    """Playable files in the music folder, sorted, or nothing if it is missing."""
    try:
        return sorted(
            (p for p in _music_dir().iterdir()
             if p.is_file() and p.suffix.lower() in MUSIC_EXTENSIONS),
            key=lambda p: p.name.lower(),
        )
    except OSError:
        return []


def _ensure_music_dir():
    """Create the music folder and seed it, on the first run of a fresh install.

    Failures are swallowed so an install in a read-only location still starts;
    it just runs silent.
    """
    music_dir = _music_dir()
    try:
        music_dir.mkdir(parents=True, exist_ok=True)
        if _music_files():
            return
        (music_dir / PLACEHOLDER_TRACK).touch()
        (music_dir / "README.txt").write_text(PLACEHOLDER_README, encoding="utf-8")
    except OSError as err:
        print(f"Could not prepare the music folder at {music_dir}: {err}")


_ensure_music_dir()


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
    """Footer data-bar fields, straight off the current conditions block.

    Wider than the three readings the bar used to print, because the bar now
    cycles through them one at a time rather than showing a fixed row: the
    more genuinely current readings there are, the longer it goes before it
    repeats itself.
    """
    return {
        "visibility_miles": current.get("visibilityMiles", "--"),
        "pressure_inches": current.get("pressureInches", "--"),
        "wind_dir": current.get("winddir16Point", "--"),
        "wind_mph": current.get("windspeedMiles", "--"),
        "humidity": current.get("humidity", "--"),
        "feels_like_c": current.get("FeelsLikeC", "--"),
        "cloud_cover": current.get("cloudcover", "--"),
        "precip_inches": current.get("precipInches", "--"),
        "uv_index": current.get("uvIndex", "--"),
    }


@app.route("/")
def index():
    return send_from_directory(app.static_folder, "index.html")


@app.route("/api/music")
def api_music():
    """What is in the music folder right now, for the page to build a playlist.

    Read on every request rather than cached at startup, so dropping a track in
    and reloading the page is enough to hear it -- no restart.
    """
    power_on = None
    tracks = []
    for path in _music_files():
        if path.stem.lower() in POWER_ON_STEMS and power_on is None:
            power_on = path.name
        else:
            tracks.append(path.name)
    return jsonify({"power_on": power_on, "tracks": tracks})


@app.route("/music/<path:filename>")
def music_file(filename):
    """Serves the external music folder.

    This route exists because static_url_path="" mounts the bundled static tree
    at the web root, and the music folder deliberately is not in that tree.
    Werkzeug matches this rule ahead of the static catch-all, so /music/... comes
    from beside the executable rather than from inside it.
    """
    return send_from_directory(_music_dir(), filename)


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
        "horoscope": daily_horoscopes(today),
        "regional": regional_observations(),
        "observations": _observations(current),
    })


if __name__ == "__main__":
    app.run(debug=True)
