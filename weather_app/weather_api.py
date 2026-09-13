import requests

API_URL = "https://wttr.in/"


def get_weather(city):
    """Fetch weather JSON for a city (empty string auto-detects by IP). Returns None on failure."""
    try:
        response = requests.get(f"{API_URL}{city}?format=j1")
        if response.status_code == 200:
            return response.json()
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None
