import tkinter as tk
import requests
from tkinter import font

# Define the main window
root = tk.Tk()
root.title("Weather App (No Key Required)")
root.geometry("400x500")  # Set a default starting size
root.minsize(300, 400)    # Prevent the window from getting too small

# Create a main frame for better scaling and layout
main_frame = tk.Frame(root)
main_frame.pack(expand=True, fill='both')

API_URL = "https://wttr.in/"

# Global state
current_unit = "F"
last_weather_data = None
BASE_WIDTH = 400  # The width we use as a reference for scaling
current_bg_color = (255, 255, 255)  # Initial background color (white)

# Helper functions for color animation
def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def rgb_to_hex(rgb):
    return '#%02x%02x%02x' % rgb

def fade_color(target_rgb, steps=20):
    """Smoothly transitions the background color to the target_rgb."""
    global current_bg_color
    
    if current_bg_color == target_rgb:
        return

    def animate(step):
        global current_bg_color
        if step >= steps:
            current_bg_color = target_rgb
            apply_color(current_bg_color)
            return

        # Interpolate
        new_color = tuple(
            int(current_bg_color[i] + (target_rgb[i] - current_bg_color[i]) * (step / steps))
            for i in range(3)
        )
        
        apply_color(new_color)
        root.after(30, lambda: animate(step + 1))

    animate(1)

def apply_color(rgb):
    """Applies the given RGB color to all relevant widgets."""
    hex_color = rgb_to_hex(rgb)
    root.configure(bg=hex_color)
    main_frame.configure(bg=hex_color)
    city_label.configure(bg=hex_color)
    temp_label.configure(bg=hex_color)
    desc_label.configure(bg=hex_color)

# Emoji mapping for weather keywords
WEATHER_EMOJIS = {
    "sun": "☀️",
    "clear": "☀️",
    "cloud": "☁️",
    "overcast": "☁️",
    "rain": "🌧️",
    "drizzle": "🌦️",
    "shower": "🌦️",
    "thunderstorm": "⛈️",
    "lightning": "⚡",
    "snow": "❄️",
    "wind": "💨",
    "tornado": "🌪️",
    "dust": "🌪️",
    "sand": "🏜️",
    "blizzard": "🌨️"
}

# Color mapping for weather keywords
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
    "blizzard": "#F0F8FF"
}


# Fetch weather data from wttr.in
def get_weather(city):
    global last_weather_data
    try:
        response = requests.get(f"{API_URL}{city}?format=j1")
        if response.status_code == 200:
            last_weather_data = response.json()
            return last_weather_data
        return None
    except Exception as e:
        print(f"Error: {e}")
        return None

# Update UI with fetched data
def update_ui(weather_data):
    global current_unit

    if weather_data:
        # Extract city name (works for both manual and auto‑detected)
        try:
            city_name = weather_data["nearest_area"][0]["areaName"][0]["value"]
        except:
            city_name = "Unknown"

        current = weather_data['current_condition'][0]
        temp_c = float(current['temp_C'])
        desc = current['weatherDesc'][0]['value']

        # Add emoji if keyword matches
        desc_lower = desc.lower()
        emoji = ""
        for keyword, symbol in WEATHER_EMOJIS.items():
            if keyword in desc_lower:
                emoji = symbol
                break
        
        display_desc = f"{emoji} {desc}" if emoji else desc

        # Update UI color based on weather description
        update_ui_color(desc_lower)

        # Convert units
        if current_unit == "F":
            temp_display = (temp_c * 9/5) + 32
            unit_symbol = "°F"
        else:
            temp_display = temp_c
            unit_symbol = "°C"

        city_label.config(text=f"City: {city_name}")
        temp_label.config(text=f"Temperature: {temp_display:.1f}{unit_symbol}")
        desc_label.config(text=f"Condition: {display_desc}")

    else:
        city_label.config(text="City: Error")
        temp_label.config(text="Temperature: Error")
        desc_label.config(text="Condition: City not found or connection error")


# Update UI color based on weather description
def update_ui_color(desc_lower):
    color_hex = "#FFFFFF"  # Default white
    for keyword, color_val in WEATHER_COLORS.items():
        if keyword in desc_lower:
            color_hex = color_val
            break
    
    target_rgb = hex_to_rgb(color_hex)
    fade_color(target_rgb)

# Fetch weather when button pressed
def fetch_weather():
    city = city_entry.get().strip()

    if city == 'City, State':
        city = ""

    weather_data = get_weather(city)
    update_ui(weather_data)


# Toggle between °F and °C
def toggle_unit():
    global current_unit
    current_unit = "C" if current_unit == "F" else "F"
    toggle_button.config(text=f"Switch to {'°F' if current_unit == 'C' else '°C'}")

    if last_weather_data:
        update_ui(last_weather_data)

def resize_fonts(event):
    """This function runs every time the window is resized."""
    # Calculate scale factor based on width
    # We use max(1, ...) to prevent division by zero or negative scaling
    scale = event.width / BASE_WIDTH
    
    # Cap the scale to prevent overly large fonts on huge screens
    scale = min(scale, 3.0)

    # Define new font sizes based on scale
    # We use int() because font sizes must be integers
    # We use max(8, ...) to ensure text doesn't become invisible
    size_large = max(int(24 * scale), 12)
    size_medium = max(int(16 * scale), 10)
    size_small = max(int(12 * scale), 8)

    # Apply the new font sizes to the UI elements
    city_label.config(font=("Arial", size_large))
    temp_label.config(font=("Arial", size_medium, "bold"))
    desc_label.config(font=("Arial", size_small))
    city_entry.config(font=("Arial", size_small))
    fetch_button.config(font=("Arial", size_small))
    toggle_button.config(font=("Arial", size_small))

# Define the UI element FIRST
city_entry = tk.Entry(main_frame, width=30, font=("Arial", 12), bg="white")

# Define the functions (these don't need city_entry to exist yet,
# because they only RUN when a click happens later)
def on_entry_click(event):
    if city_entry.get() == 'City, State':
        city_entry.delete(0, tk.END)
        city_entry.config(fg='black')

def on_focusout(event):
    if city_entry.get() == '':
        city_entry.insert(0, 'City, State')
        city_entry.config(fg='grey')

# NOW apply the logic to the existing widget
city_entry.insert(0, 'City, State')
city_entry.config(fg='grey')
city_entry.bind('<FocusIn>', on_entry_click)
city_entry.bind('<FocusOut>', on_focusout)

# UI Elements
temp_label = tk.Label(main_frame, text="Temperature: N/A", font=("Arial", 12, "bold"))
desc_label = tk.Label(main_frame, text="Weather Condition: N/A", font=("Arial", 10))
city_label = tk.Label(main_frame, text="City: N/A", font=("Arial", 12))

fetch_button = tk.Button(main_frame, text="Fetch Weather", command=fetch_weather, bg="white", fg="black")
toggle_button = tk.Button(main_frame, text="Switch to °C", command=toggle_unit, bg="white", fg="black")

# Layout
city_label.pack(pady=10, expand=True, fill='x')
temp_label.pack(pady=10, expand=True, fill='x')
desc_label.pack(pady=10, expand=True, fill='x')
city_entry.pack(pady=10, padx=40, expand=True, fill='x')
fetch_button.pack(pady=10, padx=40, expand=True, fill='x')
toggle_button.pack(pady=10, padx=40, expand=True, fill='x')

# Bind the resize event to the resize_fonts function
root.bind("<Configure>", resize_fonts)

# Start app
fetch_weather()   # run initial fetch to display current location weather
root.mainloop()

