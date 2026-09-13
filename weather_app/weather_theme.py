# Keyed by wttr.in's weatherCode. Filenames match the icon pack's own
# numbering, so the pack drops into static/icons/ unmodified.
WEATHER_ICONS = {
    113: "32.svg",  # Sunny / Clear
    116: "30.svg",  # Partly cloudy
    119: "26.svg",  # Cloudy
    122: "26.svg",  # Overcast
    143: "20.svg",  # Mist
    176: "39.svg",  # Patchy rain possible
    179: "41.svg",  # Patchy snow possible
    182: "18.svg",  # Patchy sleet possible
    185: "08.svg",  # Patchy freezing drizzle possible
    200: "38.svg",  # Thundery outbreaks possible
    227: "15.svg",  # Blowing snow
    230: "43.svg",  # Blizzard
    248: "20.svg",  # Fog
    260: "20.svg",  # Freezing fog
    263: "09.svg",  # Patchy light drizzle
    266: "09.svg",  # Light drizzle
    281: "08.svg",  # Freezing drizzle
    284: "08.svg",  # Heavy freezing drizzle
    293: "11.svg",  # Patchy light rain
    296: "12.svg",  # Light rain
    299: "12.svg",  # Moderate rain at times
    302: "12.svg",  # Moderate rain
    305: "40.svg",  # Heavy rain at times
    308: "40.svg",  # Heavy rain
    311: "10.svg",  # Light freezing rain
    314: "10.svg",  # Moderate or heavy freezing rain
    317: "18.svg",  # Light sleet
    320: "18.svg",  # Moderate or heavy sleet
    323: "14.svg",  # Patchy light snow
    326: "14.svg",  # Light snow
    329: "16.svg",  # Patchy moderate snow
    332: "16.svg",  # Moderate snow
    335: "42.svg",  # Patchy heavy snow
    338: "42.svg",  # Heavy snow
    350: "17.svg",  # Ice pellets
    353: "11.svg",  # Light rain shower
    356: "11.svg",  # Moderate or heavy rain shower
    359: "40.svg",  # Torrential rain shower
    362: "18.svg",  # Light sleet showers
    365: "18.svg",  # Moderate or heavy sleet showers
    368: "14.svg",  # Light snow showers
    371: "14.svg",  # Moderate or heavy snow showers
    374: "17.svg",  # Light showers of ice pellets
    377: "17.svg",  # Moderate or heavy showers of ice pellets
    386: "37.svg",  # Patchy light rain with thunder
    389: "04.svg",  # Moderate or heavy rain with thunder
    392: "04.svg",  # Patchy light snow with thunder
    395: "04.svg",  # Moderate or heavy snow with thunder
}

WEATHER_COLORS = {
    113: "#FFFACD",
    116: "#E6F0F5",
    119: "#D3D3D3",
    122: "#D3D3D3",
    143: "#DCDCDC",
    176: "#ADD8E6",
    179: "#F0F8FF",
    182: "#D6E6F2",
    185: "#D6E6F2",
    200: "#B0C4DE",
    227: "#E8F4F8",
    230: "#F0F8FF",
    248: "#DCDCDC",
    260: "#DCDCDC",
    263: "#ADD8E6",
    266: "#ADD8E6",
    281: "#D6E6F2",
    284: "#D6E6F2",
    293: "#ADD8E6",
    296: "#ADD8E6",
    299: "#ADD8E6",
    302: "#ADD8E6",
    305: "#9FC5D8",
    308: "#9FC5D8",
    311: "#D6E6F2",
    314: "#D6E6F2",
    317: "#D6E6F2",
    320: "#D6E6F2",
    323: "#F0F8FF",
    326: "#F0F8FF",
    329: "#F0F8FF",
    332: "#F0F8FF",
    335: "#E8F4F8",
    338: "#E8F4F8",
    350: "#CFD8DC",
    353: "#ADD8E6",
    356: "#ADD8E6",
    359: "#9FC5D8",
    362: "#D6E6F2",
    365: "#D6E6F2",
    368: "#F0F8FF",
    371: "#F0F8FF",
    374: "#CFD8DC",
    377: "#CFD8DC",
    386: "#B0C4DE",
    389: "#B0C4DE",
    392: "#B0C4DE",
    395: "#B0C4DE",
}


def icon_for(weather_code):
    return WEATHER_ICONS.get(int(weather_code), "44.svg")


def color_hex_for(weather_code):
    return WEATHER_COLORS.get(int(weather_code), "#FFFFFF")
