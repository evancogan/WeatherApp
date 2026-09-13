## Weather App

A retro "weather channel" style weather app: a Flask backend proxies [wttr.in](https://wttr.in) and a static frontend renders current conditions and a 3-day forecast in a classic TV-broadcast look.

### Running it

```
pip install -r requirements.txt
python weather_app/server.py
```

Then open http://localhost:5000 in a browser.

### Weather icons

Condition icons are referenced by filename (e.g. `sun.png`, `cloud.png`, `rain.png`) from `weather_app/static/icons/`, but the image files themselves are not included yet — add your own PNGs there. Until then, the icon `<img>` tags will show as broken images, which is expected.

It should be privated, it's so small and tiny

But. I'd like to share it with you anyway.

<img width="1200" height="1528" alt="image" src="https://github.com/user-attachments/assets/b962a71d-d218-43b4-99d6-1a2f4402fd04" />
