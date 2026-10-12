#!/usr/bin/env bash
# Build Tura Notes for the iOS Simulator, install it and launch it.
#
#   tools/ios-simulator.sh                  # on "iPhone 17"
#   tools/ios-simulator.sh "iPad mini (A17 Pro)"
#
# WHY THIS EXISTS INSTEAD OF `npm run tauri -- ios dev`: on Xcode 27 the Tauri CLI
# (cargo-mobile2, `Target::validate_sdk`) refuses every Simulator build when the
# installed Simulator runtime is older than the SDK, and it says so with
# "Xcode Simulator SDK 27.0 is not installed, please open Xcode". Measured on
# 12/10/2026: Xcode 27.0 (SDK iphonesimulator27.0) with only the iOS 26.5 runtime.
# The cure that needs no script is to install the matching runtime (Xcode,
# Settings, Components, or `xcodebuild -downloadPlatform iOS`) and then
# `npm run tauri -- ios dev` works; this script is for the days that has not
# been done. A DEVICE build is not affected: `tauri ios build --target aarch64`
# never reaches that check.
#
# What it does is what the generated Xcode project's "Build Rust Code" phase would
# do, minus the CLI server that phase insists on: the frontend, the Rust static
# library for aarch64-apple-ios-sim (with `tauri/custom-protocol`, so the frontend
# is embedded and the app does not look for a dev server), then xcodebuild with
# that phase replaced by a no-op `npm`.
#
# It signs ad hoc (`-`), which needs no identity and touches no keychain, and the
# result is a DEBUG build for the Simulator, never something to upload.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DEVICE="${1:-iPhone 17}"
VERSION="$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' "$ROOT/version.md" | head -1)"
APPLE="$ROOT/apps/notes-app/src-tauri/gen/apple"
OUT="$ROOT/target/ios-simulator"
BUNDLE_ID="br.com.samirhv.notes"

[ -d "$APPLE/notes-app.xcodeproj" ] || {
  echo "ios-simulator.sh: no Xcode project at $APPLE; run: (cd apps/notes-app && npm run tauri -- ios init)" >&2
  exit 1
}
command -v xcodebuild >/dev/null || { echo "ios-simulator.sh: Xcode is not installed" >&2; exit 1; }

echo "== frontend"
(cd "$ROOT/apps/notes-app" && npm run build >/dev/null)

echo "== Rust static library for aarch64-apple-ios-sim ($VERSION)"
# The version is stamped through the environment so the committed 0.0.0 stays
# committed (ADR-035): `tauri::generate_context!` reads TAURI_CONFIG at compile time.
(cd "$ROOT" &&
  IPHONEOS_DEPLOYMENT_TARGET=17.0 TAURI_CONFIG="{\"version\":\"$VERSION\"}" \
  cargo rustc --lib --crate-type staticlib --target aarch64-apple-ios-sim \
    -p notes-app --features tauri/custom-protocol)

# The project links `Externals/arm64/<configuration>/libapp.a`, and copies the
# `assets` folder as a resource; a fresh checkout has neither (git keeps no empty
# directory, and `Externals` is ignored).
mkdir -p "$APPLE/Externals/arm64/debug" "$APPLE/assets"
cp "$ROOT/target/aarch64-apple-ios-sim/debug/libnotes_app_lib.a" "$APPLE/Externals/arm64/debug/libapp.a"

echo "== xcodebuild"
SHIM="$(mktemp -d)"
trap 'rm -rf "$SHIM"' EXIT
printf '#!/bin/sh\necho "ios-simulator.sh: Rust was built beforehand, skipping: npm $*"\n' >"$SHIM/npm"
chmod +x "$SHIM/npm"
mkdir -p "$OUT"
(cd "$APPLE" &&
  PATH="$SHIM:$PATH" xcodebuild -project notes-app.xcodeproj -scheme notes-app_iOS \
    -configuration debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' \
    -derivedDataPath "$OUT" ARCHS=arm64 ONLY_ACTIVE_ARCH=YES \
    CODE_SIGN_IDENTITY=- CODE_SIGNING_REQUIRED=NO CODE_SIGNING_ALLOWED=YES \
    build >"$OUT/xcodebuild.log" 2>&1) || {
  grep -n "error:" "$OUT/xcodebuild.log" | head -20 >&2
  echo "ios-simulator.sh: xcodebuild failed, full log: $OUT/xcodebuild.log" >&2
  exit 1
}
APP="$OUT/Build/Products/debug-iphonesimulator/Tura Notes.app"

echo "== install and launch on \"$DEVICE\""
xcrun simctl boot "$DEVICE" 2>/dev/null || true   # already booted is fine
xcrun simctl bootstatus "$DEVICE" -b >/dev/null
xcrun simctl terminate "$DEVICE" "$BUNDLE_ID" 2>/dev/null || true
xcrun simctl install "$DEVICE" "$APP"
xcrun simctl launch "$DEVICE" "$BUNDLE_ID"
echo "screenshot: xcrun simctl io \"$DEVICE\" screenshot /tmp/tura.png"
