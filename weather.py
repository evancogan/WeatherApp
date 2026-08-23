import tkinter as tk
import requests

# Define the main window
root = tk.Tk()
root.title("Weather App (No Key Required)")

# wttr.in URL (we append ?format=j1 to get the JSON version)
API_URL = "https://wttr.in/"
# Function to fetch weather data from wttr.in
def get_weather(city):
    try:
        # We request the JSON format specifically using ?format=j1
        response = requests.get(f"{API_URL}{city}?format=j1")
    except Exception as e:
        print(f"Error: {e}")
        return None
    if response.status_code == 200:
        return response.json()
    else:
        return None
        print(f"Request Error: {e}")
        return None

# Function to update the UI with fetched data
def update_ui(weather_data):
    if weather_data:
        # wttr.in JSON structure is slightly different from OpenWeatherMap
        # Temperature is found in current_condition -> temp_C
        current = weather_data['current_condition'][0]
        temp = current['temp_C']
        desc = current['weatherDesc'][0]['value']
        # Update the labels
        temp_label.config(text=f"Temperature: {temp}°C")
        desc_label.config(text=f"Condition: {desc}")
    else:
        temp_label.config(text="Error fetching weather data")
        desc_label.config(text="City not found or connection error")

# Create labels to display temperature and weather condition
temp_label = tk.Label(root, text="Temperature: N/A", font=("Arial", 12, "bold"))
desc_label = tk.Label(root, text="Weather Condition: N/A", font=("Arial", 10))

# Pack the labels on the window
temp_label.pack(pady=10)
desc_label.pack(pady=10)

# Function to get user input and display weather data
def fetch_weather():
    city = city_entry.get().strip()
    if city:
        weather_data = get_weather(city)
        update_ui(weather_data)

# Create entry widget for user input and button
city_entry = tk.Entry(root, width=30, font=("Arial", 12))
fetch_button = tk.Button(root, text="Fetch Weather", command=fetch_weather, bg="#4CAF50", fg="white")

# Pack the widgets on the window
city_entry.pack(pady=10)
fetch_button.pack(pady=10)

# Start the application event loop
root.mainloop()