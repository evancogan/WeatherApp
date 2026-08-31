import tkinter as tk
import requests

# Define the main window
root = tk.Tk()
root.title("Weather App (No Key Required)")

API_URL = "https://wttr.in/"

# Global state
current_unit = "F"
last_weather_data = None

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

        # Convert units
        if current_unit == "F":
            temp_display = (temp_c * 9/5) + 32
            unit_symbol = "°F"
        else:
            temp_display = temp_c
            unit_symbol = "°C"

        city_label.config(text=f"City: {city_name}")
        temp_label.config(text=f"Temperature: {temp_display:.1f}{unit_symbol}")
        desc_label.config(text=f"Condition: {desc}")

    else:
        city_label.config(text="City: Error")
        temp_label.config(text="Temperature: Error")
        desc_label.config(text="Condition: City not found or connection error")

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

# Define the UI element FIRST
city_entry = tk.Entry(root, width=30, font=("Arial", 12))

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
temp_label = tk.Label(root, text="Temperature: N/A", font=("Arial", 12, "bold"))
desc_label = tk.Label(root, text="Weather Condition: N/A", font=("Arial", 10))
city_label = tk.Label(root, text="City: N/A", font=("Arial", 12))
city_label.pack(pady=5)

fetch_button = tk.Button(root, text="Fetch Weather", command=fetch_weather, bg="#4CAF50", fg="white")
toggle_button = tk.Button(root, text="Switch to °C", command=toggle_unit)

# Layout
temp_label.pack(pady=10)
desc_label.pack(pady=10)
city_entry.pack(pady=10)
fetch_button.pack(pady=10)
toggle_button.pack(pady=5)

# Start app
fetch_weather()   # run initial fetch to display current location weather
root.mainloop()

