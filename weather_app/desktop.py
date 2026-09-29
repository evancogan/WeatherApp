"""Desktop entry point: the channel in a native window instead of a browser tab.

`python weather_app/server.py` runs Flask's development server and leaves finding
it to the viewer. This module hands the same Flask app to pywebview, which serves
it on a loopback port and points an embedded browser at it, so the packaged
build opens as one window with no console and no address bar. See
weatherapp.spec for turning this file into a single executable.
"""

import ctypes
import sys

import webview

from server import app

# Wide enough for the 760px screen plus its bezel, and tall enough for the
# 420px screen with the footer data bar under it (see static/style.css).
WINDOW_SIZE = (960, 720)
MIN_WINDOW_SIZE = (640, 520)

WELCOME_TITLE = "WX-1 Weather Channel"

WELCOME_TEXT = """\
Thanks for checking out WX-1.

This app can use your camera for exactly one thing: a blurred reflection of the \
room in the CRT glass, the way a real tube picks up the light in front of it. \
The image stays on your machine. Nothing is recorded, saved, or sent anywhere.

You'll be asked for camera permission after you click TUNE IN. Decline it and \
everything else works exactly the same -- the lens button in the top corner \
turns the reflection on and off at any time.

A few things worth knowing:

    The Left and Right arrow keys change the screen, and so do the two arrows \
on screen. There are five screens in the rotation.

    Drop .mp3 files into the "music" folder next to this app to give the \
channel a soundtrack.

Click OK to turn the set on."""

# MB_ICONINFORMATION | MB_SETFOREGROUND | MB_TOPMOST. The last two stop the
# dialog opening behind another window, which would look like a hang since no
# window of ours exists yet.
MB_FLAGS = 0x40 | 0x10000 | 0x40000


def show_welcome():
    """Explain the camera before anything opens, and block until dismissed.

    MessageBoxW does not return until the dialog is answered, so the window
    cannot open behind it. The return value is ignored: OK and the close box are
    both treated as "continue". Only the packaged build reaches this; running
    server.py in a browser does not.
    """
    if sys.platform != "win32":
        # No tkinter fallback: it would pull an entire GUI toolkit into the
        # bundle for one dialog, on a platform this is not built for anyway.
        print(f"{WELCOME_TITLE}\n\n{WELCOME_TEXT}")
        return
    ctypes.windll.user32.MessageBoxW(None, WELCOME_TEXT, WELCOME_TITLE, MB_FLAGS)


class Api:
    """Exposed to the page as window.pywebview.api."""

    def toggle_fullscreen(self):
        webview.windows[0].toggle_fullscreen()


def main():
    show_welcome()
    webview.create_window(
        "Weather Channel",
        app,
        width=WINDOW_SIZE[0],
        height=WINDOW_SIZE[1],
        min_size=MIN_WINDOW_SIZE,
        # The standby screen is black, so matching it keeps the window from
        # flashing white in the moment before the page paints.
        background_color="#000000",
        js_api=Api(),
    )
    # private_mode is on by default and would discard localStorage on exit,
    # which is where the mute and city preferences live.
    webview.start(private_mode=False)


if __name__ == "__main__":
    main()
