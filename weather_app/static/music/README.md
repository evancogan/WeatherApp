# Channel Audio

Two files live here, both optional:

```
weather_app/static/music/theme.mp3        background track, loops forever
weather_app/static/music/soundeffect.mp3  plays once when the set powers on
```

That's it, no code changes needed. The Flask app mounts `static/` at the web
root (`static_url_path=""` in `server.py`), so the files are served at
`http://localhost:5000/music/theme.mp3` and
`http://localhost:5000/music/soundeffect.mp3`, and `index.html` already points
at both.

Click **TUNE IN** on the page to power the channel on. The sound effect fires
immediately at full volume while the theme fades in underneath it and loops.
The mute button silences both.

## Notes

- Audio files in this folder are git-ignored on purpose. Only this README and
  `.gitkeep` are tracked, so your audio never ends up in the repo.
- Keep `soundeffect.mp3` short, a second or two. It is meant to land on the
  same beat as the picture coming up, not to play over the theme.
- MP3 is the safe cross-browser default. If you'd rather use OGG or WAV, swap
  the single `src` on `#channel-audio` (or `#power-on-audio`) in `index.html`
  for `<source>` elements:

  ```html
  <audio id="channel-audio" loop preload="auto">
      <source src="music/theme.ogg" type="audio/ogg">
      <source src="music/theme.mp3" type="audio/mpeg">
  </audio>
  ```

- If either file is missing the app still works. It just powers on without that
  sound.
