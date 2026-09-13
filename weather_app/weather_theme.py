# Icon filenames are resolved by the frontend against /icons/<filename>.
# The actual image files are not included here -- drop them into static/icons/.
WEATHER_ICONS = {
    "sun": "sun.png",
    "clear": "sun.png",
    "cloud": "cloud.png",
    "overcast": "cloud.png",
    "rain": "rain.png",
    "drizzle": "rain.png",
    "shower": "rain.png",
    "thunderstorm": "thunderstorm.png",
    "lightning": "thunderstorm.png",
    "snow": "snow.png",
    "wind": "wind.png",
    "tornado": "tornado.png",
    "dust": "tornado.png",
    "sand": "sand.png",
    "blizzard": "blizzard.png",
}

WEATHER_COLORS = {
    "sun": "#FFFACD",
    "clear": "#FFFACD",
    "cloud": "#D3D3D3",
    "overcast": "#D3D3D3",
    "rain": "#ADD8E6",
    "drizzle": "#ADD8E6",
    "shower": "#ADD8E6",
    "thunderstorm": "#B0C4DE",
    "lightning": "#B0C4DE",
    "snow": "#F0F8FF",
    "wind": "#E0FFFF",
    "tornado": "#FFE4E1",
    "dust": "#FFE4E1",
    "sand": "#F4A460",
    "blizzard": "#F0F8FF",
}


def icon_for(desc_lower):
    for keyword, filename in WEATHER_ICONS.items():
        if keyword in desc_lower:
            return filename
    return None


def color_hex_for(desc_lower):
    for keyword, color_val in WEATHER_COLORS.items():
        if keyword in desc_lower:
            return color_val
    return "#FFFFFF"
