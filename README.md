## Weather App

<img width="674" height="432" alt="image" src="https://github.com/user-attachments/assets/9ca4c663-679d-4ef1-834e-b0980ad72a88" />

> **Work in progress.** Full write-up coming, check back later.

### Downloading it

In the releases tab, there is several stable builds, PLEASE NOTE: the application should be put in its own folder, since the music folder is required to avoid copyright infringement, and will spawn next to your application. Be warned, this is also textbook malware behavior, so Windows Smart Screen and Defender will both flag this as malware.

### Running it

```
pip install -r requirements.txt
python weather_app/server.py
```

Then open http://localhost:5000 and click **TUNE IN**.

### Music

| Running | Music folder |
| --- | --- |
| `python weather_app/server.py` | `weather_app/static/music/` |
| Packaged `.exe` | `music/` next to the executable |

Name a file `soundeffect.mp3` to use it as the power-on sound.

### Controls

| | |
| --- | --- |
| Left / Right arrows | Change screen |
| Click the temperature | Switch °F / °C |
| Click the city name | Search a different city |
| Top-right keys | Hide controls, screen reflection, mute |
| F11 | Fullscreen |
