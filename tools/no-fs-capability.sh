#!/usr/bin/env bash
# The webview holds no filesystem capability (docs/ARCHITECTURE.md §12).
#
# One script for the gate and CI, because the two copies it replaces had drifted
# into the same hole in two syntaxes (R6-29): `! grep -r … capabilities/` turns
# grep's "no such directory" (status 2) into success, so a moved or renamed
# directory printed `ok` while proving nothing. A step whose whole job is to
# prove a negative has to show first that it looked somewhere.
#
# It also reads the Tauri configs: Tauri 2 accepts capabilities inline in
# `app.security.capabilities`, which no directory move is needed to reach.
set -euo pipefail
cd "$(dirname "$0")/.."
dir=apps/notes-app/src-tauri/capabilities
pattern='"fs:[a-z-]+"'

[ -d "$dir" ] || { echo "no capabilities directory at $dir: nothing was checked" >&2; exit 1; }
files=$(find "$dir" -type f -name '*.json' | wc -l)
[ "$files" -gt 0 ] || { echo "no capability files under $dir: nothing was checked" >&2; exit 1; }

found=0
if grep -rnE "$pattern" "$dir"; then found=1; fi
for conf in apps/notes-app/src-tauri/tauri*.conf.json; do
  if grep -nE "$pattern" "$conf"; then found=1; fi
done
if [ "$found" -ne 0 ]; then
  echo "a filesystem permission is granted to the webview; see docs/ARCHITECTURE.md §12" >&2
  exit 1
fi
echo "no fs capability granted ($files capability files and the Tauri configs read)"
