#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ANDROID_DIR="$SCRIPT_DIR/android"
APK_PATH="$ANDROID_DIR/app/build/outputs/apk/release/app-release.apk"
PACKAGE="com.bizarch.mobile"
ACTIVITY="com.bizarch.mobile.MainActivity"

export PATH="/opt/homebrew/share/android-commandlinetools/platform-tools:$PATH"

# Check device connected
echo "Checking for connected device..."
DEVICE=$(adb devices | grep -w "device" | head -1 | awk '{print $1}')
if [ -z "$DEVICE" ]; then
  echo "No device found. Make sure:"
  echo "  1. USB Debugging is enabled on your phone"
  echo "  2. Phone is connected via USB"
  echo "  3. You've tapped 'Allow' on the USB debugging prompt"
  exit 1
fi
echo "Found device: $DEVICE"

# Sync Capacitor assets
echo "Syncing Capacitor assets..."
cd "$SCRIPT_DIR"
npx cap sync android

# Build release APK
echo "Building release APK..."
cd "$ANDROID_DIR"
./gradlew assembleRelease -q

# Install on device
echo "Installing APK..."
adb install -r "$APK_PATH"

# Launch the app
echo "Launching app..."
adb shell am start -n "$PACKAGE/$ACTIVITY"

echo "Done! App is running on $DEVICE"
