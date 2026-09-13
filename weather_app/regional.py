"""Current conditions for a fixed roster of cities.

Feeds two screens from one fetch: the Latest Observations table and the
Regional Forecast map, which plots the same rows over static/basemap.svg.

The roster is deliberately fixed rather than derived from whatever city is being
viewed. wttr.in answers one city per request and reports no neighbours, so a
location-following table would mean geocoding plus a city database, where a
fixed list is twelve requests and no new data to maintain. Being fixed is also
what lets the map be a single pre-rendered basemap: the frame never moves, so
the geometry never has to be fetched or re-projected at runtime.

Those twelve requests are the reason for the cache below: without it every page
load and every city search would fan out to wttr.in again, which rate-limits.
The roster is the same for everyone, so one cached copy serves every viewer.
"""

import math
import time
from concurrent.futures import ThreadPoolExecutor

from weather_api import get_weather
from weather_theme import icon_for

# The map frame, in degrees. These four numbers must stay in step with the
# constants in tools/build_basemap.py that drew static/basemap.svg -- change
# one without redrawing the other and the cities slide off their coastlines.
WEST, EAST = -84.6, -67.4
SOUTH, NORTH = 39.9, 46.45

# (wttr.in lookup, label as printed on screen, latitude, longitude). The lookup
# is spelled the way wttr.in wants it, which is not always how the city should
# read on screen. The roster is the twelve cities that fall inside the frame
# above; the table prints them in this order, the map ignores it.
CITIES = [
    ("Albany", "Albany", 42.65, -73.76),
    ("Augusta,ME", "Augusta", 44.31, -69.78),
    ("Boston", "Boston", 42.36, -71.06),
    ("Burlington,VT", "Burlington", 44.48, -73.21),
    ("Buffalo", "Buffalo", 42.89, -78.88),
    ("Cleveland", "Cleveland", 41.50, -81.69),
    ("Detroit", "Detroit", 42.33, -83.05),
    ("Montreal", "Montreal", 45.51, -73.57),
    ("New York", "New York", 40.71, -74.01),
    ("Ottawa", "Ottawa", 45.42, -75.70),
    ("Syracuse", "Syracuse", 43.05, -76.15),
    ("Toronto", "Toronto", 43.65, -79.38),
]

# Long enough that the table is normally a cache hit, short enough that the
# observations are still current within the hour they are read.
CACHE_TTL_SECONDS = 600

# Keyed by wttr.in's weatherCode, the same key weather_theme.py uses. The
# broadcast abbreviations are what the column is for: the WEATHER column is one
# line on a 760px screen, so "Moderate or heavy rain shower" has to become
# SHOWERS or it pushes the wind column off the table.
SHORT_CONDITIONS = {
    113: "FAIR",
    116: "P CLOUDY",
    119: "M CLOUDY",
    122: "CLOUDY",
    143: "MIST",
    176: "LGT RAIN",
    179: "LGT SNOW",
    182: "SLEET",
    185: "FRZ DRZL",
    200: "T-STORM",
    227: "BLWG SNOW",
    230: "BLIZZARD",
    248: "FOG",
    260: "FRZ FOG",
    263: "DRIZZLE",
    266: "DRIZZLE",
    281: "FRZ DRZL",
    284: "FRZ DRZL",
    293: "LGT RAIN",
    296: "LGT RAIN",
    299: "RAIN",
    302: "RAIN",
    305: "HVY RAIN",
    308: "HVY RAIN",
    311: "FRZ RAIN",
    314: "FRZ RAIN",
    317: "SLEET",
    320: "SLEET",
    323: "LGT SNOW",
    326: "LGT SNOW",
    329: "SNOW",
    332: "SNOW",
    335: "HVY SNOW",
    338: "HVY SNOW",
    350: "ICE PLTS",
    353: "SHOWERS",
    356: "SHOWERS",
    359: "HVY RAIN",
    362: "SLEET",
    365: "SLEET",
    368: "SNOW SHWR",
    371: "SNOW SHWR",
    374: "ICE PLTS",
    377: "ICE PLTS",
    386: "T-STORM",
    389: "T-STORM",
    392: "T-STORM",
    395: "T-STORM",
}

_cache = {"fetched_at": 0.0, "rows": []}


def _short_condition(weather_code, description):
    """Broadcast-style abbreviation, falling back to a clipped description."""
    try:
        known = SHORT_CONDITIONS.get(int(weather_code))
    except (TypeError, ValueError):
        known = None
    if known:
        return known
    return (description or "").upper()[:10]


def _merc_y(lat):
    """Mercator northing, in the same degree units the longitudes use.

    Converting back to degrees is what keeps this on the same scale as the
    longitude arithmetic below; the raw logarithm is in radians and would
    squash the map to a sliver.
    """
    return math.degrees(math.log(math.tan(math.pi / 4 + math.radians(lat) / 2)))


_Y_TOP, _Y_BOTTOM = _merc_y(NORTH), _merc_y(SOUTH)


def _map_position(lat, lon):
    """Where this city sits on the basemap, as percentages from its top-left.

    Percentages rather than pixels because the map scales with the picture,
    and doing the projection here rather than in the browser keeps the frame
    constants in one file next to the roster they belong to.
    """
    return {
        "map_x": round((lon - WEST) / (EAST - WEST) * 100, 3),
        "map_y": round((_Y_TOP - _merc_y(lat)) / (_Y_TOP - _Y_BOTTOM) * 100, 3),
    }


def _observation(city):
    """One roster row, or None if wttr.in had nothing for this city."""
    lookup, label, lat, lon = city
    data = get_weather(lookup)
    if not data:
        return None

    try:
        current = data["current_condition"][0]
        weather_code = current.get("weatherCode", 0)
        row = {
            "city": label,
            "temp_c": float(current["temp_C"]),
            "condition": _short_condition(
                weather_code,
                current.get("weatherDesc", [{}])[0].get("value", ""),
            ),
            # Used by the map only; the table prints the abbreviation instead.
            "icon": icon_for(weather_code),
            "wind_dir": current.get("winddir16Point", "--"),
            "wind_mph": current.get("windspeedMiles", "--"),
        }
        row.update(_map_position(lat, lon))
        return row
    except (KeyError, IndexError, TypeError, ValueError):
        return None


def regional_observations():
    """The shared roster rows, cached for CACHE_TTL_SECONDS.

    Returns a list of row dicts. A city wttr.in could not answer for is dropped
    rather than printed blank, and a fetch that returns nothing at all leaves
    the previous rows in place, so one bad round of requests does not blank a
    table that was fine a minute ago. A dropped city simply goes missing from
    the map too, which reads as a gap rather than as a wrong reading.
    """
    now = time.monotonic()
    if _cache["rows"] and now - _cache["fetched_at"] < CACHE_TTL_SECONDS:
        return _cache["rows"]

    # Twelve sequential wttr.in calls would add several seconds to the weather
    # request that triggered them; in parallel they cost about one.
    with ThreadPoolExecutor(max_workers=len(CITIES)) as pool:
        results = list(pool.map(_observation, CITIES))

    rows = [row for row in results if row]
    if rows:
        _cache["rows"] = rows
        _cache["fetched_at"] = now
    return _cache["rows"]
