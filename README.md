## Weather App

A retro "weather channel" style weather app: a Flask backend proxies [wttr.in](https://wttr.in) and a static frontend renders current conditions and a 3-day forecast in a classic TV-broadcast look.

### Running it

```
pip install -r requirements.txt
python weather_app/server.py
```

Then open http://localhost:5000 in a browser and click **TUNE IN** to power the channel on.

### Channel audio

Drop your own background track at `weather_app/static/music/theme.mp3` and a power-on sound effect at `weather_app/static/music/soundeffect.mp3`. No code changes needed. Clicking **TUNE IN** fires the effect immediately and fades the theme in underneath it, looping forever. The browser blocks audio until you interact with the page, which is exactly what that standby screen is for. The mute button silences both.

Audio files in `weather_app/static/music/` are git-ignored, so your audio stays out of the repo. If either file isn't there, the app powers on without that sound. See [weather_app/static/music/README.md](weather_app/static/music/README.md) for other formats.

### Weather icons

Condition icons live in `weather_app/static/icons/` as SVGs named by weather code (`00.svg` through `47.svg`, plus `na.svg`). `weather_app/weather_theme.py` maps each wttr.in `weatherCode` to an icon filename and an accent color.

It should be privated, it's so small and tiny

But. I'd like to share it with you anyway.

<img width="1200" height="1528" alt="image" src="https://github.com/user-attachments/assets/b962a71d-d218-43b4-99d6-1a2f4402fd04" />
