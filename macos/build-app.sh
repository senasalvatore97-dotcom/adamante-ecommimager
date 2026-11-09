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
for ARCH in arm64 x86_64; do
  swiftc -parse-as-library "$ROOT/AdamantePhotoStudio.swift" \
    -o "$BIN.$ARCH" \
    -sdk "$SDK" \
    -target "$ARCH-apple-macos14.0" \
    -framework SwiftUI -framework AppKit -framework ApplicationServices -framework CoreGraphics \
    -O
done

lipo -create -output "$BIN" "$BIN.arm64" "$BIN.x86_64"
rm "$BIN.arm64" "$BIN.x86_64"

chmod +x "$BIN"
codesign --force --deep --sign - "$APP"
echo "Applicazione generata: $APP"
