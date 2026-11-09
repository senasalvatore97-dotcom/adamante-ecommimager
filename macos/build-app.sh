#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST="$ROOT/dist"
APP="$DIST/Adamante Photo Studio.app"
CONTENTS="$APP/Contents"
BIN="$CONTENTS/MacOS/AdamantePhotoStudio"

rm -rf "$APP"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources"
cp "$ROOT/Info.plist" "$CONTENTS/Info.plist"

SDK="$(xcrun --sdk macosx --show-sdk-path)"
swiftc "$ROOT/AdamantePhotoStudio.swift" \
  -o "$BIN" \
  -sdk "$SDK" \
  -target arm64-apple-macos14.0 \
  -framework SwiftUI -framework AppKit -framework ApplicationServices -framework CoreGraphics \
  -O

chmod +x "$BIN"
codesign --force --deep --sign - "$APP"
echo "Applicazione generata: $APP"
