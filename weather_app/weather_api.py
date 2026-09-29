import requests

API_URL = "https://wttr.in/"
#---- API timeout settings ----#
# (connect_timeout, read_timeout)
# 3.05 is just over the default TCP packet retransmission window
# Boston took 128 ms, Syracuse took 119 ms, so the timeout will
# only be one second for the read timeout

# slowest of 7 measured, cold cities included: 140 ms
API_TIMEOUT = (3.05, 1)


def get_weather(city):
    """Fetch weather JSON for a city (empty string auto-detects by IP). Returns None on failure."""
    try:
        response = requests.get(f"{API_URL}{city}?format=j1", timeout=API_TIMEOUT)
        if response.status_code == 200:
            return response.json()
        return None
    # Covers timeouts, connection errors, and non-JSON bodies
    except requests.exceptions.RequestException as e:
        print(f"Error, weather fetch failed: {e}")
        return None
