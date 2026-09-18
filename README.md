## Weather App

<img width="674" height="432" alt="image" src="https://github.com/user-attachments/assets/9ca4c663-679d-4ef1-834e-b0980ad72a88" />


A retro "weather channel" style weather app: a Flask backend proxies [wttr.in](https://wttr.in) and a static frontend renders current conditions and a 3-day forecast in a classic TV-broadcast look.

### Downloading it

In the releases tab, there is several stable builds, PLEASE NOTE: the application should be put in its own folder, since the music folder is required to avoid copyright infringement, and will spawn next to your application. 

### Running it

```
pip install -r requirements.txt
python weather_app/server.py
```

Then open http://localhost:5000 in a browser and click **TUNE IN** to power the channel on.

### Channel audio

Drop audio files into the music folder and they become the channel's rotation, played in order and looped. Name one `soundeffect.mp3` and it becomes the power-on sting instead, fired once when you click **TUNE IN**. Nothing to configure.

The folder is `weather_app/static/music/` when you run the server yourself, and a `music/` folder next to the executable in a packaged build. The `.exe` carries no audio inside it, so whoever you hand it to can change the soundtrack without a rebuild. The app creates the folder and leaves a placeholder in it on first launch.

Audio files are git-ignored, so your music stays out of the repo. An empty folder is fine; the channel powers on and runs silent. The mute button silences everything. See [weather_app/static/music/README.md](weather_app/static/music/README.md) for the details.

### Controls

| | |
| --- | --- |
| Left / Right arrows, or the on-screen arrows | Change screen (there are five) |
| Click the temperature | Switch °F / °C |
| Click the city name | Search a different city |
| Top-right keys | Hide the controls, toggle the screen reflection, mute |

Screens also advance on their own, roughly every ten seconds. The horoscope holds longer, since twelve readings take a while to type out and read.

### Weather icons

Condition icons live in `weather_app/static/icons/` as SVGs named by weather code (`00.svg` through `47.svg`, plus `na.svg`). `weather_app/weather_theme.py` maps each wttr.in `weatherCode` to an icon filename and an accent color.
