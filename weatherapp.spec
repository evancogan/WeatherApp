# -*- mode: python ; coding: utf-8 -*-

"""PyInstaller build for the desktop channel: `pyinstaller weatherapp.spec`.

Produces one windowed executable in dist/. The static frontend is bundled as
data and unpacked at run time under sys._MEIPASS, which server.py resolves its
static folder against.

The one exception is static/music/, which is deliberately not bundled: the app
plays whatever is in a music folder sitting next to the .exe. See _music_dir()
in server.py.
"""

from pathlib import Path

APP_DIR = Path(SPECPATH) / "weather_app"
STATIC_DIR = APP_DIR / "static"

# Listed file by file rather than as one folder so music/ can be excluded. The
# packaged app reads its soundtrack from a music folder beside the .exe, so no
# audio is frozen into the binary and it can be changed without a rebuild.
STATIC_DATAS = [
    (str(path), str(path.parent.relative_to(APP_DIR)))
    for path in sorted(STATIC_DIR.rglob("*"))
    if path.is_file() and "music" not in path.relative_to(STATIC_DIR).parts
]

a = Analysis(
    [str(APP_DIR / "desktop.py")],
    # The modules import each other flatly (`from server import app`), the way
    # they do when server.py is run as a script, so the package directory has to
    # be on the analysis path for those names to resolve.
    pathex=[str(APP_DIR)],
    binaries=[],
    datas=STATIC_DATAS,
    hiddenimports=[],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name="WeatherChannel",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
