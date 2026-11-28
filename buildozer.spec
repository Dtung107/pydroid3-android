[app]

# (str) Title of your application
title = PydroidApp

# (str) Package name
package.name = pydroid_app

# (str) Package domain (needed for android/ios packaging)
package.domain = org.pydroid

# (str) Source code where the main.py lives
source.dir = .

# (list) Source files to include (let empty to include all the files)
source.include_exts = py,png,jpg,kv,atlas,json,txt,md,ttf,otf

# (list) Directories to exclude from the APK package
source.exclude_dirs = tests, bin, .venv, venv, .git, .github, __pycache__

# (str) Application versioning
version = 1.0.0

# (list) Application requirements
# Core requirements include kivy, pillow, certifi, and android for crash-free startup
requirements = python3,kivy,certifi,android

# (str) Supported orientation (one of landscape, sensorLandscape, portrait or all)
orientation = portrait

# (list) Permissions
android.permissions = INTERNET,VIBRATE

# (int) Target Android API
android.api = 33

# (int) Minimum API your APK will support.
android.minapi = 21

# (int) Android NDK API to use (matching minapi)
android.ndk_api = 21

# (str) Android NDK version to use
android.ndk = 25b

# (bool) If True, automatically accept SDK license agreements (mandatory for CI / GitHub Actions)
android.accept_sdk_license = True

# (bool) Use --private data storage (True) or --dir public storage (False)
android.private_storage = True

# (list) The Android architectures to build for.
# arm64-v8a is the modern 64-bit standard for Android 9 - 15, preventing 32-bit crashes.
android.archs = arm64-v8a

# (bool) Enable AndroidX support (required by modern Kivy / python-for-android)
android.enable_androidx = True

# (str) Lock python-for-android to stable tested release (Python 3.11 + NDK r25b)
p4a.branch = v2024.01.21

# (bool) enables Android auto backup feature (Android API >=23)
android.allow_backup = True

# (str) Android logcat filters to aid troubleshooting
android.logcat_filters = *:S python:D

[buildozer]

# (int) Log level (0 = error only, 1 = info, 2 = debug with command-line)
log_level = 2

# (int) Display warning if buildozer is run as root (0 = False, 1 = True)
warn_on_root = 0
