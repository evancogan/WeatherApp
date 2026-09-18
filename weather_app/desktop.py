"""Desktop entry point: the channel in a native window instead of a browser tab.

`python weather_app/server.py` runs Flask's development server and leaves finding
it to the viewer. This module hands the same Flask app to pywebview, which serves
it on a loopback port and points an embedded browser at it, so the packaged
build opens as one window with no console and no address bar. See
weatherapp.spec for turning this file into a single executable.
"""

import webview

from server import app

# Wide enough for the 760px screen plus its bezel, and tall enough for the
# 420px screen with the footer data bar under it (see static/style.css).
WINDOW_SIZE = (960, 720)
MIN_WINDOW_SIZE = (640, 520)


def main():
    webview.create_window(
        "Weather Channel",
        app,
        width=WINDOW_SIZE[0],
        height=WINDOW_SIZE[1],
        min_size=MIN_WINDOW_SIZE,
        # The standby screen is black, so matching it keeps the window from
        # flashing white in the moment before the page paints.
        background_color="#000000",
    )
    # private_mode is on by default and would discard localStorage on exit,
    # which is where the mute and city preferences live.
    webview.start(private_mode=False)


if __name__ == "__main__":
    main()
