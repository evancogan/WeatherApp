# Channel Audio

Drop audio files in this folder. Every one of them (`.mp3 .ogg .wav .m4a
.flac`) joins the channel's rotation, played in alphabetical order and looped
when it reaches the end. There is nothing to configure and no filename to match.

One name is reserved: a file called `soundeffect.mp3` becomes the power-on
sting. It fires once when you click **TUNE IN** and is left out of the rotation.
(`power-on` and `poweron` work too.)

## Where the folder is

It depends on how the app is running, because the packaged build deliberately
does not carry any audio inside it:

| Running | Folder |
| --- | --- |
| `python weather_app/server.py` | `weather_app/static/music/` — this folder |
| The packaged `.exe` | `music/`, sitting next to the executable |

`_music_dir()` in `server.py` picks between them. The frozen build resolves it
against the executable rather than against `sys._MEIPASS`, since that unpacked
temp directory is rebuilt on every launch — anything dropped there would be gone
by the next run.

The app creates the folder on first launch if it isn't there, and leaves an
empty `VintageWeatherTheme.mp3` and a `README.txt` in it to show what goes where.
Replace the placeholder with a real track or delete it; the channel skips it
either way, because an empty file is not decodable audio.

## Notes

- Audio here is git-ignored on purpose. Only this README and `.gitkeep` are
  tracked, so your music never ends up in the repo — or in a build you hand to
  someone else.
- Keep `soundeffect.mp3` short, a second or two. It's meant to land on the same
  beat as the picture coming up, not to play over the theme.
- The page reads the folder once, at load. Adding a track and reloading is
  enough to hear it; no restart.
- An empty folder is fine. The channel powers on and runs silent.
- Clicking **TUNE IN** is what starts playback. Browsers block audio until you
  interact with the page, which is exactly what that standby screen is for. The
  mute key silences the music and the sting together.
