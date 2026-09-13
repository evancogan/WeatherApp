# Channel Music

Drop your own background track in this folder, named **`theme.mp3`**.

```
weather_app/static/music/theme.mp3
```

That's it, no code changes needed. The Flask app mounts `static/` at the web
root (`static_url_path=""` in `server.py`), so the file is served at
`http://localhost:5000/music/theme.mp3` and `index.html` already points at it.

Click **TUNE IN** on the page to power the channel on; the track fades in and
loops forever.

## Notes

- Audio files in this folder are git-ignored on purpose. Only this README and
  `.gitkeep` are tracked, so your music never ends up in the repo.
- MP3 is the safe cross-browser default. If you'd rather use OGG or WAV, swap
  the single `src` on `#channel-audio` in `index.html` for `<source>` elements:

  ```html
  <audio id="channel-audio" loop preload="auto">
      <source src="music/theme.ogg" type="audio/ogg">
      <source src="music/theme.mp3" type="audio/mpeg">
  </audio>
  ```

- If no file is present the app still works. It just powers on silently.
