# -*- mode: python ; coding: utf-8 -*-

"""PyInstaller build for the desktop channel: `pyinstaller weatherapp.spec`.

Produces one windowed executable in dist/. The static frontend is bundled as
data and unpacked at run time under sys._MEIPASS, which server.py resolves its
static folder against.
"""

from pathlib import Path

APP_DIR = Path(SPECPATH) / "weather_app"

a = Analysis(
    [str(APP_DIR / "desktop.py")],
    # The modules import each other flatly (`from server import app`), the way
    # they do when server.py is run as a script, so the package directory has to
    # be on the analysis path for those names to resolve.
    pathex=[str(APP_DIR)],
    binaries=[],
    datas=[(str(APP_DIR / "static"), "static")],
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
