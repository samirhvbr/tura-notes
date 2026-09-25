#!/usr/bin/env bash
# build-local.sh — the macOS and Linux release pipeline for Tura Notes, run locally.
#
# THIS SCRIPT IS THE macOS PIPELINE, AND THAT IS DELIBERATE. `build.yml` builds
# Linux in CI and carries macOS behind `if: false` (ADR-024): the missing piece
# was never engineering, it was a Developer ID certificate, and that certificate
# lives in a keychain on a Mac rather than in a repository secret. So the Mac
# that has it is the machine that packages, signs, notarises and publishes —
# the same arrangement `shvia-desktop/build-local.sh` already uses across the
# fleet, and the reason this file reads like that one (ADR-070).
#
# Linux: .deb + .AppImage by default; --bundles deb,appimage,rpm selects targets.
# Run on Linux with --help for prerequisites and platform-specific options.
#
# USAGE (from the repository root):
#   ./build-local.sh                  # build, sign, notarise, staple
#   ./build-local.sh --no-sign        # test build: NOT signed, NOT publishable
#   ./build-local.sh --skip-npm-ci    # dependencies already installed
#   ./build-local.sh --skip-git-pull  # build this checkout, do not sync first
#   ./build-local.sh --force          # rebuild even if this version is on disk
#   ./build-local.sh --publish        # upload the DMG to samirhv.com.br
#   ./build-local.sh --publish --dest user@host  # publish somewhere else
#
# WHAT IT PRODUCES: `target/release/bundle/dmg/Tura Notes_<version>_<arch>.dmg`,
# a `.sha256` sidecar next to it, and — when a Developer ID is available — a
# notarisation ticket stapled into the image so it opens offline with no prompt.
#
# THE VERSION IS STAMPED, NOT COMMITTED. `version.md` is the single authority
# (ADR-011, ADR-035); `tools/stamp-version.sh` writes it into
# `tauri.conf.json` for the length of the build and the committed `0.0.0`
# placeholder is restored on exit, including on failure.
#
# SIGNING (macOS). Without a signature, a DMG that has been downloaded or
# AirDropped carries the quarantine attribute, and Gatekeeper offers to MOVE IT
# TO THE TRASH — the user is taught that the warning is noise, which is the
# exact lesson ADR-024 exists to avoid teaching. This script finds the
# `Developer ID Application` certificate in the keychain and exports
# `APPLE_SIGNING_IDENTITY`, so `tauri build` signs the `.app` with the hardened
# runtime. If a notarisation credential is also present, it exports
# `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` and `tauri build` notarises and
# staples on its own.
#
#   The app-specific password lives in the KEYCHAIN and never in the repository:
#     security add-generic-password -U -s tura-notarize -a YOUR_APPLE_ID -w
#   (it prompts for the password, hidden; generate one at appleid.apple.com ›
#   App-Specific Passwords).
#
#   `shvia-notarize` is accepted as a fallback, because the certificate in this
#   keychain is the same Apple team and forcing a second copy of one password
#   under a second name only creates a way for the two to drift apart.
#
#   No certificate → the build still runs and says, loudly, that it is unsigned.
#   Certificate but no notarisation credential → signed, not notarised, and it
#   says that too. Neither case is silent: "was that build signed?" must never
#   be a question you answer by inspecting the artefact afterwards.
#
# PUBLISHING (--publish). samirhv.com.br serves downloads from a PRIVATE disk
# through a counting endpoint (`/d/{file}`), so publishing is not a copy into a
# web root — the file has to be ingested by the application, which hashes it,
# records its size and creates the `ProjectFile` row. That is exactly what
# `php artisan files:add` does, so publication is four steps, in this order:
#
#   1. `ssh` one `test -f <app>/artisan` — does the download service exist here?
#   2. `scp` the DMG (and its `.sha256`) to a staging directory on the server;
#   3. `ssh` the sha256 back and compare it to the local one;
#   4. `ssh` a single `php artisan files:add … --project=tura-notes` call.
#
# Re-publishing the same filename UPDATES the existing row and keeps its
# download counter (FileIngestService), so a re-run after a partial upload is
# safe and does not duplicate the file on the downloads page.
#
# STEPS 1 AND 3 EXIST BECAUSE OF WHAT THE ORDER COSTS. A truncated `scp` leaves
# a file that exists, that `files:add` ingests happily and that the page then
# links — it fails only in the user's browser, so it has to be found here. This
# script found it one step too late until 1.1.14: it ingested first and verified
# afterwards, which publishes the broken image and *then* reports the failure.
# And `PUBLISH_APP` is a written-down guess that nothing checked, so a wrong
# path spent the whole upload to say `cd: no such file or directory`.
# `tools/build-linux.sh` verified before ingesting from the day it was written;
# the two sides agree now, preflight included.
#
# GIT PULL (fleet default): the script runs `git pull --ff-only` before anything
# else so an old checkout is not packaged by accident. It never fails the build
# — offline, dirty tree or a diverged branch only produce a warning. Skip it
# with --skip-git-pull.
#
# REUSING A BUILD: if a DMG for this exact version is already on disk and
# `tools/build-cache.py` still recognises it — same version, same architecture,
# same build mode, and a source fingerprint that matches the tree byte for byte
# — the script skips straight to publishing. Forgetting `--publish` must not
# cost a full rebuild to upload a file that already exists. The freshness check
# is what makes the shortcut safe: editing code without bumping the version
# would otherwise publish an old binary under a new version number, signed,
# silently. Override with --force.
#
# **It is a content fingerprint, not mtime.** `find -newer` was the first shape
# of this test and it asks the wrong question: a file restored with `cp -p`, or
# any checkout that preserves timestamps, is different from the DMG *and* older
# than it, so the test passed and the stale binary shipped. Linux had already
# moved to a fingerprint; macOS — the side that signs and notarises — was the
# one still deciding on timestamps. Both run the same check now, which is why
# the script implementing it no longer carries "linux" in its name.
#
# Norm: docs/runbook.md §4 · docs/decisions.md ADR-011, ADR-024, ADR-035, ADR-070
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

# Dispatch before macOS option parsing, keychain access or platform checks.
if [ "$(uname -s)" = Linux ]; then
  exec bash "$ROOT/tools/build-linux.sh" "$@"
fi

# ── Clock: total wall time, and time per step ────────────────────────────────
# `step`, `_summary` and `_clock_abort` live in `tools/build-clock.sh` because
# `tools/build-linux.sh` needs the same three, and a second copy of a table is a
# table the two platforms print differently within a release or two. Sourcing it
# starts the clock.
. "$ROOT/tools/build-clock.sh"

usage() { awk 'NR>1{ if($0=="set -euo pipefail") exit; sub(/^# ?/,""); print }' "$0"; }

_sha256() {
  if   command -v shasum   >/dev/null 2>&1; then shasum -a 256 "$1" | awk '{print $1}'
  elif command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"   | awk '{print $1}'
  else echo ""; fi
}

# ── Options ──────────────────────────────────────────────────────────────────
SKIP_NPM_CI=0
SKIP_GIT_PULL=0
NO_SIGN=0
FORCE_BUILD=0
PUBLISH=0

# Destination and public base are documented constants, overridable by
# environment or flag. Neither is a secret: the host is reachable only over the
# private network and the base is the address the downloads page already uses.
# The scp password is never a variable and never a file — scp asks for it, or
# `ssh-copy-id <host>` once makes it stop asking.
PUBLISH_HOST="${TURA_PUBLISH_HOST:-b3sys@100.64.100.125}"
PUBLISH_STAGE="${TURA_PUBLISH_STAGE:-/tmp}"
PUBLISH_APP="${TURA_PUBLISH_APP:-/srv/www/samirhv.com.br/samirhv}"
PUBLISH_SLUG="${TURA_PUBLISH_SLUG:-tura-notes}"
PUBLIC_BASE="${TURA_PUBLIC_BASE:-https://samirhv.com.br}"

while [ $# -gt 0 ]; do
  case "$1" in
    --skip-npm-ci)   SKIP_NPM_CI=1 ;;
    --skip-git-pull) SKIP_GIT_PULL=1 ;;
    --no-sign)       NO_SIGN=1 ;;
    --force|-f)      FORCE_BUILD=1 ;;
    --publish)       PUBLISH=1 ;;
    --dest)          shift; PUBLISH_HOST="${1:-}" ;;
    --base-url)      shift; PUBLIC_BASE="${1:-}" ;;
    -h|--help)       usage; exit 0 ;;
    *) echo "build-local.sh: unknown option: $1 (use --help)" >&2; exit 2 ;;
  esac
  shift
done

if [ "$(uname -s)" != "Darwin" ]; then
  echo "build-local.sh: supported build hosts are macOS and Linux." >&2
  exit 1
fi

# One EXIT trap, set once, doing both things it has to do — and reading `$?`
# FIRST. Chaining a second trap over the first was the obvious shape and the
# wrong one: whatever ran before the status was read would overwrite it, and a
# failed build would report the exit code of the cleanup instead of its own.
CONFIG_BACKUP=""
CONFIG_PATH=""
_on_exit() {
  local code=$?
  if [ -n "$CONFIG_BACKUP" ] && [ -f "$CONFIG_BACKUP" ]; then
    cp "$CONFIG_BACKUP" "$CONFIG_PATH"
    rm -f "$CONFIG_BACKUP"
    CONFIG_BACKUP=""
  fi
  if [ "$code" -ne 0 ]; then
    _clock_abort "$code"
  fi
}
# INT and TERM as well as EXIT: a Ctrl-C in the middle of a ten-minute
# notarisation is the ordinary way this script ends, and the shell does not run
# an EXIT trap when it dies on a signal. Without these two, the stamped
# `tauri.conf.json` stayed in the tree — and `tools/check.sh` rejects a stamped
# tree, so an interrupted build broke the next commit instead of just itself.
trap _on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

echo "==> Tura Notes — local macOS build"

# ── Per-machine credentials, once instead of once per build ──────────────────
# Without this, every release means re-exporting the same variables by hand, and
# forgetting one is something you find out at the end of a long build. Two
# locations are accepted, first one that exists wins:
#
#   1. ./signing.env             — inside the repository, gitignored.
#   2. ~/.config/tura-notes/build.env — outside it. Survives a fresh clone, a
#      `git clean -xdf`, and deleting the tree. Same address shape the rest of
#      the fleet uses (~/.config/shvia/build.env, ~/.config/sshvterm/build.env),
#      because the release machine is the same one and one habit is less to
#      remember than three.
#
# A third: $TURA_BUILD_ENV. It announces what it loaded and from where, on
# purpose — "did this build come out signed?" must not depend on an invisible
# file, and the first line of output should already say where the answer is.
CREDS_FILE=""
for _c in "${TURA_BUILD_ENV:-}" "./signing.env" "$HOME/.config/tura-notes/build.env"; do
  [ -n "$_c" ] && [ -f "$_c" ] && { CREDS_FILE="$_c"; break; }
done
if [ -n "$CREDS_FILE" ]; then
  # shellcheck source=/dev/null
  . "$CREDS_FILE"
  echo "    credentials: $CREDS_FILE loaded"
fi

# ── Preflight: check the toolchain before the slow steps ─────────────────────
# Fails in under a second with an actionable message instead of a cryptic
# `cargo metadata: No such file or directory` five seconds in, and collects
# everything that is missing in one pass rather than one per re-run.
preflight() {
  local missing=()

  command -v node >/dev/null 2>&1 || missing+=(
    "Node.js not found. Install Node 20+ (https://nodejs.org, 'brew install node' or nvm)."
  )
  command -v npm >/dev/null 2>&1 || missing+=(
    "npm not found (it ships with Node)."
  )

  # rustup installs into ~/.cargo/bin, and a terminal opened before that has no
  # such entry in PATH. Recovering it here beats telling someone to reopen a
  # shell they have work in.
  if ! command -v cargo >/dev/null 2>&1 && [ -x "$HOME/.cargo/bin/cargo" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
    echo "    (cargo found in ~/.cargo/bin — added to PATH for this run)"
  fi
  if ! command -v cargo >/dev/null 2>&1 || ! command -v rustc >/dev/null 2>&1; then
    missing+=(
"Rust (cargo) not found — it is what Tauri compiles with.
       Install:  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
       Then:     source \"\$HOME/.cargo/env\"   (or reopen the terminal)"
    )
  fi

  xcode-select -p >/dev/null 2>&1 || missing+=(
"Xcode Command Line Tools missing (macOS clang and linker).
       Install:  xcode-select --install"
  )

  if [ "${#missing[@]}" -gt 0 ]; then
    echo "" >&2
    echo "❌ missing prerequisites — fix these and run again:" >&2
    echo "" >&2
    local m
    for m in "${missing[@]}"; do echo "   • $m" >&2; echo "" >&2; done
    exit 1
  fi
}

# ── git pull before the build (fleet default) ────────────────────────────────
# Syncs before any other step so old code is not packaged by accident.
# Fast-forward only — it never creates a merge — and it never fails the build:
# offline, local changes or a diverged branch warn and carry on with what is
# checked out. A build that refuses to run because the network is down is worse
# than a build that tells you it used the local tree.
git_sync() {
  if [ "$SKIP_GIT_PULL" -eq 1 ]; then
    echo "    (skipped: --skip-git-pull)"
    return 0
  fi
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo "    (not a git checkout — nothing to sync)"
    return 0
  fi
  if git pull --ff-only 2>&1 | sed 's/^/    /'; then
    return 0
  fi
  echo "    ⚠️  could not fast-forward — building the local checkout as it is."
  return 0
}

# ── macOS: signing (Developer ID) + notarisation (app-specific password) ─────
# See the header. Both halves are independent: a certificate with no
# notarisation credential still produces a signed build, and the script says so
# rather than pretending the artefact is releasable.
NOTARY_SERVICES=("tura-notarize" "shvia-notarize")
SIGN_ENABLED=0
NOTARIZE_ENABLED=0

setup_macos_signing() {
  if [ "$NO_SIGN" -eq 1 ]; then
    echo "    (--no-sign: test build, NOT signed and NOT notarised)"
    return 0
  fi

  # 1) Signing identity: the first "Developer ID Application" in the keychain,
  #    unless APPLE_SIGNING_IDENTITY already came from the environment.
  if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
    APPLE_SIGNING_IDENTITY="$(security find-identity -v -p codesigning 2>/dev/null \
      | awk -F'"' '/Developer ID Application/{print $2; exit}' || true)"
  fi
  if [ -z "${APPLE_SIGNING_IDENTITY:-}" ]; then
    echo "    ⚠️  no 'Developer ID Application' certificate in the keychain — THE BUILD WILL BE UNSIGNED."
    echo "        (macOS will offer to move the downloaded app to the Trash; do not publish it — ADR-024)"
    return 0
  fi
  export APPLE_SIGNING_IDENTITY
  SIGN_ENABLED=1
  echo "    ✔ signing: $APPLE_SIGNING_IDENTITY"

  # Team ID: the (XXXXXXXXXX) at the end of the identity, unless already set.
  if [ -z "${APPLE_TEAM_ID:-}" ]; then
    APPLE_TEAM_ID="$(printf '%s' "$APPLE_SIGNING_IDENTITY" \
      | sed -n 's/.*(\([A-Z0-9]\{10\}\))$/\1/p')"
  fi

  # 2) Notarisation credential from the keychain, unless already in the
  #    environment. `tura-notarize` first, `shvia-notarize` as the documented
  #    fallback for the same Apple team.
  local svc
  for svc in "${NOTARY_SERVICES[@]}"; do
    [ -n "${APPLE_PASSWORD:-}" ] && break
    APPLE_PASSWORD="$(security find-generic-password -s "$svc" -w 2>/dev/null || true)"
    if [ -n "${APPLE_PASSWORD:-}" ] && [ -z "${APPLE_ID:-}" ]; then
      APPLE_ID="$(security find-generic-password -s "$svc" 2>/dev/null \
        | awk -F'"' '/"acct"/{print $4}' || true)"
      NOTARY_USED="$svc"
    fi
  done

  if [ -n "${APPLE_ID:-}" ] && [ -n "${APPLE_PASSWORD:-}" ] && [ -n "${APPLE_TEAM_ID:-}" ]; then
    export APPLE_ID APPLE_PASSWORD APPLE_TEAM_ID
    NOTARIZE_ENABLED=1
    echo "    ✔ notarisation: $APPLE_ID (team $APPLE_TEAM_ID, keychain ${NOTARY_USED:-env})"
    echo "      (notarisation uploads the app to Apple and WAITS — this can take minutes)"
  else
    echo "    ⚠️  will SIGN but NOT notarise (no credential). Store the app password once:"
    echo "        security add-generic-password -U -s tura-notarize -a YOUR_APPLE_ID -w"
    echo "        (unnotarised, the app opens but still needs approval in Settings › Privacy)"
  fi
}

# macOS: detach .dmg images from THIS repository left mounted by an earlier run.
# `bundle_dmg.sh` creates a temporary rw.*.dmg, mounts it, arranges the window
# over AppleScript and detaches. If that process is killed midway the image stays
# attached, and the next build runs `tell disk "Tura Notes"` with two volumes of
# that name mounted — ambiguous, so it errors, and Tauri reports only "failed to
# run bundle_dmg.sh". Filtered by image path inside our own bundle directory, so
# a DMG the user mounted from somewhere else is never ejected.
detach_stale_build_images() {
  command -v hdiutil >/dev/null 2>&1 || return 0
  local bundle_abs devs d
  bundle_abs="$ROOT/target/release/bundle"
  devs="$(hdiutil info 2>/dev/null | awk -v b="$bundle_abs" '
    /^image-path/            { p = (index($0, b) > 0) }
    p && /^\/dev\/disk[0-9]/ { print $1; p = 0 }
  ' || true)"
  for d in $devs; do
    echo "    image left mounted by an earlier build — ejecting $d"
    hdiutil detach "$d" >/dev/null 2>&1 || hdiutil detach -force "$d" >/dev/null 2>&1 || true
  done
}

# ── Is there a usable build of this version already on disk? ─────────────────
# "The file exists" is not proof — see the header. The test is: a DMG whose name
# carries this version, a `.sha256` sidecar that still matches its contents, and
# no source file newer than the DMG. The last clause is the one that matters:
# without it, editing code without bumping the version passes the first two and
# publishes an old binary as the new version, signed, with nothing to notice.
REUSE_DMG=""
REUSE_REASON=""
can_reuse_build() {
  local version="$1" dmg
  [ "$FORCE_BUILD" -eq 1 ] && { REUSE_REASON="--force"; return 1; }

  dmg="$(find "$ROOT/target/release/bundle/dmg" -maxdepth 1 -type f \
         -name "*_${version}_*.dmg" -print -quit 2>/dev/null || true)"
  [ -z "$dmg" ] && { REUSE_REASON="no DMG for $version on disk"; return 1; }

  # The DMG's own hash, its sidecar and the freshness of the sources are one
  # question, and `tools/build-cache.py check` is the single answer — the same
  # call `tools/build-linux.sh` makes. See the header for why this replaced
  # `find -newer`.
  if [ -z "$SOURCE_HASH" ] || [ -z "$HOST_TRIPLE" ]; then
    REUSE_REASON="cannot fingerprint the sources on this machine — rebuilding rather than guessing"
    return 1
  fi
  local why
  if ! why="$(python3 tools/build-cache.py check "$ROOT/target/release/bundle/dmg" \
                "$version" "$HOST_TRIPLE" "$SOURCE_HASH" "$NO_SIGN" 2>&1 >/dev/null)"; then
    REUSE_REASON="${why#Build required: }"
    return 1
  fi

  if [ "$NO_SIGN" -eq 0 ]; then
    python3 tools/updater-release.py verify --artifact "$ROOT/target/release/bundle/macos/TuraNotes.app.tar.gz" --version "$version" >/dev/null 2>&1 || {
      REUSE_REASON="updater payload is absent or unverifiable"; return 1;
    }
  fi
  REUSE_DMG="$dmg"
  return 0
}

# ── Post-build proof that Gatekeeper will accept it ──────────────────────────
# Keep both app and dmg bundles: the app becomes the updater archive, while
# the DMG needs its own notarization ticket for first-time installation.
verify_macos_signature() {
  local dmg="$1" app
  if [ "$SIGN_ENABLED" -ne 1 ]; then
    echo "    (unsigned build — nothing to verify)"
    return 0
  fi

  app="$(find "$ROOT/target/release/bundle/macos" -maxdepth 1 -name '*.app' 2>/dev/null | head -1 || true)"
  if [ -n "$app" ]; then
    echo "  • codesign --verify (deep, strict):"
    if codesign --verify --deep --strict --verbose=2 "$app" >/tmp/_tura_cs.txt 2>&1; then
      echo "      ✔ signature intact"
    else
      echo "      ❌ invalid signature:"; sed 's/^/        /' /tmp/_tura_cs.txt
    fi

    echo "  • authority + hardened runtime:"
    codesign -dvvv "$app" 2>&1 \
      | grep -E 'Authority=|TeamIdentifier=|Identifier=|flags=' | sed 's/^/      /' || true

    echo "  • Gatekeeper (spctl assess):"
    spctl -a -t exec -vvv "$app" 2>&1 | sed 's/^/      /' || true
  else
    echo "    (no standalone .app — DMG-only build; Tauri already cleaned it up)"
  fi

  [ -n "$dmg" ] || return 0
  if xcrun stapler validate "$dmg" >/dev/null 2>&1; then
    echo "      ✔ .dmg stapled (opens offline, no prompt)"
  elif [ "$NOTARIZE_ENABLED" -eq 1 ]; then
    echo "      • .dmg not stapled yet — notarising the image itself (submit + staple)…"
    if xcrun notarytool submit "$dmg" --apple-id "$APPLE_ID" --password "$APPLE_PASSWORD" \
           --team-id "$APPLE_TEAM_ID" --wait 2>&1 | sed 's/^/        /' \
       && xcrun stapler staple "$dmg" 2>&1 | sed 's/^/        /'; then
      echo "      ✔ .dmg notarised + stapled"
    else
      echo "      ⚠️  could not notarise the .dmg — but the .app inside it is already"
      echo "          notarised and stapled, so distributing the .dmg still works."
    fi
  else
    echo "      ⚠️  .dmg NOT stapled — notarisation did not run. Do not publish (ADR-024)."
  fi
}

# ── Publishing to samirhv.com.br ─────────────────────────────────────────────
# See the header for why this is an ingest and not a copy. Refuses to publish an
# unsigned or unstapled image: the whole reason macOS artefacts were withheld
# until now is that an unsigned one teaches the user to click past Gatekeeper.

# Quote a remote argument for the POSIX shell `ssh` runs it in. `--dest` and the
# five TURA_* variables all reach a remote shell, and `tools/build-linux.sh` has
# quoted them since 1.0.3 — this side interpolated them raw, which is the same
# bug one platform had already fixed.
_q() { python3 -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$1"; }

# THE DESTINATION IS CHECKED BEFORE THE UPLOAD, and until now it was not checked
# at all. `PUBLISH_APP` is a written-down guess: 1.1.0 shipped with "live
# publication awaits the correct application path on the private host" in the
# changelog, because the first thing that touched the path was a `cd` inside the
# ingest — after a 20 MB upload, reporting `cd: no such file or directory`,
# which is true and does not name the fix. One `test -f artisan` answers it in
# under a second, and the failure prints the command that finds the real path.
publish_preflight() {
  [[ "$PUBLISH_HOST" != -* && "$PUBLISH_HOST" =~ ^[a-zA-Z0-9_.@-]+$ ]] || {
    echo "  ✗ invalid publish host: $PUBLISH_HOST" >&2; return 1; }
  local path
  for path in "$PUBLISH_STAGE" "$PUBLISH_APP"; do
    [[ "$path" =~ ^/[a-zA-Z0-9_./-]+$ ]] || {
      echo "  ✗ remote paths must be absolute, without spaces or shell characters: $path" >&2
      return 1; }
  done

  local status=0
  ssh "$PUBLISH_HOST" "test -f $(_q "$PUBLISH_APP/artisan")" || status=$?
  [ "$status" -eq 0 ] && return 0

  if [ "$status" -eq 255 ]; then
    echo "  ✗ could not reach $PUBLISH_HOST over ssh." >&2
    echo "    The host is on the private network; check the address and that the key is installed" >&2
    echo "    (ssh-copy-id $PUBLISH_HOST). Override with --dest or TURA_PUBLISH_HOST." >&2
    return 1
  fi
  echo "  ✗ $PUBLISH_HOST has no download service at $PUBLISH_APP" >&2
  echo "    There is no artisan there, so 'php artisan files:add' cannot run and the" >&2
  echo "    upload would be ingested by nothing. Find the application and set the path:" >&2
  echo "      ssh $PUBLISH_HOST 'ls -d /srv/www/*/ /var/www/*/ 2>/dev/null'" >&2
  echo "      TURA_PUBLISH_APP=/the/path/it/prints ./build-local.sh --publish" >&2
  return 1
}

publish_release() {
  local dmg="$1" version="$2"
  local name sum remote staged

  name="$(basename "$dmg")"
  sum="$(_sha256 "$dmg")"

  if [ "$SIGN_ENABLED" -ne 1 ]; then
    echo "  ✗ refusing to publish an UNSIGNED build (ADR-024)." >&2
    echo "    Run without --no-sign, on a machine whose keychain holds the Developer ID." >&2
    return 1
  fi
  if ! xcrun stapler validate "$dmg" >/dev/null 2>&1; then
    echo "  ✗ refusing to publish a DMG with no notarisation ticket (ADR-024)." >&2
    echo "    Gatekeeper would still warn about it on a machine that is offline." >&2
    return 1
  fi

  echo "    host:    $PUBLISH_HOST"
  echo "    project: $PUBLISH_SLUG ($version)"
  echo "    file:    $name"
  echo "    sha256:  $sum"

  step "[publish] check the download service on the server"
  publish_preflight || return 1
  echo "    ✔ $PUBLISH_APP/artisan is there"

  staged="$PUBLISH_STAGE/$name"
  step "[publish] upload the image"
  scp "$dmg" "$dmg.sha256" "$PUBLISH_HOST:$PUBLISH_STAGE/"

  # ── Read the hash back BEFORE the ingest ────────────────────────────────────
  # A truncated scp leaves a file that exists, that `files:add` ingests happily,
  # and that the downloads page then links — the failure belongs to whoever
  # downloads it. Verifying afterwards, which is what this did until 1.1.14,
  # finds it only once it is already published, and leaves the broken image on
  # the page while the script exits non-zero. `tools/build-linux.sh` verified
  # first from the day it was written; both sides agree now.
  step "[publish] verify the uploaded file on the server"
  remote="$(ssh "$PUBLISH_HOST" "shasum -a 256 -- $(_q "$staged") 2>/dev/null \
            || sha256sum -- $(_q "$staged") 2>/dev/null" | awk '{print $1; exit}')" || remote=""
  if [ -z "$remote" ] || [ "$remote" != "$sum" ]; then
    echo "    ✗ the uploaded file does NOT match — nothing was ingested" >&2
    echo "      expected: $sum" >&2
    echo "      got:      ${remote:-<could not read it back>}" >&2
    ssh "$PUBLISH_HOST" "rm -f -- $(_q "$staged") $(_q "$staged.sha256")" || true
    return 1
  fi
  echo "    ✅ uploaded intact (${sum:0:16}…)"

  # Ingest. `files:add` hashes the file, writes it to the private downloads disk
  # under the project folder and creates or UPDATES the ProjectFile row — same
  # filename updates in place and keeps the download counter, so a re-run is
  # safe. Artisan runs as www-data because it writes into storage/.
  #
  # `-t`, AND IT IS NOT PIPED, and both halves are the same bug. `ssh host "cmd"`
  # allocates no terminal, so `sudo` cannot prompt and dies with "a terminal is
  # required to read the password" — after the build, the notarisation and a
  # verified upload, which is the most expensive place to learn it. The password
  # is never a variable and never a file here, exactly as the scp one is not
  # (see the header); `-t` is what lets sudo ask you for it.
  #
  # And the `| sed 's/^/      /'` that indented this output had to go, because a
  # password prompt carries no newline: sed reads a line at a time and would
  # hold "Password:" until something ended the line, so the build would sit
  # there looking hung with nothing on screen to type into. Six spaces of
  # indentation are not worth a prompt nobody can see.
  step "[publish] ingest into the download service"
  # With the server's helper installed and granted (docs/OWNER-ACTS.md §7)
  # there is no password to ask for, and the helper checks every argument.
  local helper=/usr/local/sbin/tura-publish
  if ! ssh -t "$PUBLISH_HOST" "if sudo -n -l -u www-data $helper check >/dev/null 2>&1; then \
      sudo -n -u www-data $helper download $(_q "$staged") $(_q "$version") macos-apple-silicon; \
      else cd $(_q "$PUBLISH_APP") && sudo -u www-data php artisan files:add \
      $(_q "$staged") --project=$(_q "$PUBLISH_SLUG") --file-version=$(_q "$version") \
      --label=$(_q "Tura Notes $version — macOS (Apple silicon)"); fi"; then
    echo "  ✗ the ingest failed; the uploaded file is still staged at $staged" >&2
    echo "    If it was sudo asking and you would rather it stopped, install the publish" >&2
    echo "    helper on the server: docs/OWNER-ACTS.md §7. Not a sudoers line with a" >&2
    echo "    wildcard: in sudoers '*' matches spaces, so 'files:add *' would ingest any" >&2
    echo "    file www-data can read." >&2
    return 1
  fi

  # The staging copy has been ingested into the downloads disk; leaving a second
  # copy of a 20 MB image in /tmp on every release is litter, not a backup.
  ssh "$PUBLISH_HOST" "rm -f -- $(_q "$staged") $(_q "$staged.sha256")" || true

  echo ""
  echo "    Published. It is listed at:"
  echo "      $PUBLIC_BASE/p/$PUBLISH_SLUG"
  echo "      $PUBLIC_BASE/downloads"
}


# ── Pipeline ─────────────────────────────────────────────────────────────────
step "[git] sync with the remote (git pull --ff-only)"
git_sync

version="$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' version.md | head -1)"
[ -n "$version" ] || { echo "build-local.sh: no version in version.md" >&2; exit 1; }
echo "    version: $version"

# The two facts `tools/build-cache.py` needs to recognise an existing build, and
# both are read before the reuse question rather than inside it: an empty one is
# a refusal to reuse, never a silent pass. `preflight` recovers ~/.cargo/bin
# later in the run, which is too late for a shell that was opened before rustup.
if ! command -v rustc >/dev/null 2>&1 && [ -x "$HOME/.cargo/bin/rustc" ]; then
  export PATH="$HOME/.cargo/bin:$PATH"
fi
HOST_TRIPLE="$(rustc -vV 2>/dev/null | sed -n 's/^host: //p' || true)"
SOURCE_HASH="$(python3 tools/build-cache.py fingerprint 2>/dev/null || true)"

step "[reuse] is there a build of this version on disk?"
if can_reuse_build "$version"; then
  echo "    ✅ yes — $(basename "$REUSE_DMG"), sha256 verified, no newer source."
  if _dt="$(date -r "$REUSE_DMG" '+%d/%m %H:%M' 2>/dev/null)"; then
    echo "       built at $_dt. Skipping npm ci and tauri build."
  fi
  echo "       To rebuild anyway: --force (or delete target/release/bundle/dmg)."
  dmg="$REUSE_DMG"
  # Reused builds were signed by the run that produced them; record that so the
  # publish gate reads the artefact rather than this run's keychain lookup.
  if codesign --verify --strict "$dmg" >/dev/null 2>&1 \
     || xcrun stapler validate "$dmg" >/dev/null 2>&1; then
    SIGN_ENABLED=1
  fi
else
  echo "    no — $REUSE_REASON"

  step "[prerequisites] check the toolchain (Node, Rust, Xcode CLT)"
  preflight

  step "[signing] Developer ID + notarisation credential"
  setup_macos_signing

  # The committed placeholder is restored on EXIT, including on failure: a
  # stamped tauri.conf.json in the tree is what tools/check.sh rejects, and
  # leaving one behind after a failed build turns one problem into two.
  # Handing the two paths to the trap that is already installed, rather than
  # installing a second one — see _on_exit.
  CONFIG_PATH="apps/notes-app/src-tauri/tauri.conf.json"
  grep -q '"version": "0.0.0"' "$CONFIG_PATH" || {
    echo "build-local.sh: $CONFIG_PATH is already stamped; refusing to back it up." >&2
    echo "  Another build is running against this tree, or one ended without restoring it." >&2
    exit 1
  }
  CONFIG_BACKUP="$(mktemp)"
  cp "$CONFIG_PATH" "$CONFIG_BACKUP"

  step "[1/3] stamp the version from version.md"
  tools/stamp-version.sh >/dev/null
  echo "    tauri.conf.json → $version (0.0.0 restored on exit)"

  step "[2/3] frontend dependencies (npm ci)"
  if [ "$SKIP_NPM_CI" -eq 1 ]; then
    echo "    (skipped: --skip-npm-ci)"
  else
    (cd apps/notes-app && npm ci)
  fi

  step "[3/3] tauri build (compile, bundle, sign, notarise, staple)"
  detach_stale_build_images
  if [ "$NO_SIGN" -eq 0 ]; then python3 tools/updater-release.py preflight; fi
  (cd apps/notes-app && npm run tauri build -- --bundles app,dmg)

  # The bundler names files after `productName`, and that name has a space in
  # it. `Tura Notes.app` keeps its — it is an installed identity — but the
  # downloadable file loses it, before anything hashes, signs or publishes the
  # name. See tools/name-bundles.sh.
  step "[name] canonical bundle filenames"
  tools/name-bundles.sh "$ROOT/target/release/bundle/dmg"

  # ── Unstamp BEFORE anything fingerprints the tree ───────────────────────────
  # `tauri.conf.json` lives under `apps/notes-app/src-tauri`, which is one of
  # `tools/build-cache.py`'s INPUTS, and `stamp-version.sh` rewrites it. So the
  # fingerprint taken below described a tree with `"version": "1.1.17"` in it
  # while `SOURCE_HASH` was taken before stamping, off `"version": "0.0.0"` —
  # two different files, two different hashes, every single time. The
  # "sources changed during the build" guard therefore fired on **every** macOS
  # build that actually compiled, after the notarisation round-trip, and the
  # build it refused to record was correct.
  #
  # Nobody saw it because the reuse path skips this whole block, and because a
  # macOS build has never been published. `tools/build-linux.sh` restores on the
  # line before its own check and always has; this is the same asymmetry as the
  # publish ordering 1.1.14 fixed, and it is fixed the same way — by doing what
  # the other platform already does.
  #
  # The trap still restores on failure; clearing CONFIG_BACKUP is what tells it
  # the work is already done.
  cp "$CONFIG_BACKUP" "$CONFIG_PATH"; rm -f "$CONFIG_BACKUP"; CONFIG_BACKUP=""
  echo "    tauri.conf.json → 0.0.0 restored"

  artifact_dir="target/release/bundle/dmg"
  dmg="$(find "$artifact_dir" -maxdepth 1 -type f -name "*_${version}_*.dmg" -print -quit)"
  if [ -z "$dmg" ]; then
    echo "build-local.sh: Tauri finished without a DMG for $version in $artifact_dir." >&2
    exit 1
  fi

  step "[verify] codesign / Gatekeeper / notarisation ticket"
  verify_macos_signature "$dmg"
  if [ "$NO_SIGN" -eq 0 ]; then
    payload="$ROOT/target/release/bundle/macos/TuraNotes.app.tar.gz"
    # COPYFILE_DISABLE, and it is not decoration. macOS `tar` writes a `._name`
    # AppleDouble sidecar for every entry carrying extended attributes, and no
    # macOS tool shows them back: `tar tzf` merges them into xattrs and lists
    # only the real files. So the payload looked clean for months while half of
    # its twenty entries were `._*`, and the desktop updater — whose Rust `tar`
    # does not merge — died on the first one with `failed to unpack
    # '._Tura Notes.app'`. Hand installs kept working, because they use macOS
    # `tar`, which is how the two paths disagreed without anyone noticing.
    # `updater-release.py prepare` refuses the archive if this ever regresses.
    COPYFILE_DISABLE=1 tar -czf "$payload" -C "$ROOT/target/release/bundle/macos" 'Tura Notes.app'
    case "$(uname -m)" in arm64) updater_arch=aarch64;; *) updater_arch="$(uname -m)";; esac
    python3 tools/updater-release.py prepare --artifact "$payload" --version "$version" --platform "darwin-$updater_arch-app"
  fi

  # ── The sidecar is written LAST, and that ordering is the whole point ───────
  # `xcrun stapler staple` REWRITES the image to embed the notarisation ticket,
  # so a hash taken before that step describes a file that no longer exists.
  # Written first, it made `can_reuse_build` reject every build it had just
  # produced — a harmless symptom of a harmful bug, because the same number is
  # what a user checks the download against, and it would never have matched.
  _sha256 "$dmg" | awk -v n="$(basename "$dmg")" '{print $1"  "n}' > "$dmg.sha256"

  # Record what these bytes were built from — and refuse if that answer changed
  # while we were building. A notarised build is long enough to edit a file in,
  # and a fingerprint taken before it would then describe sources this DMG does
  # not contain: the stale-publish hole again, one step further along. The
  # recording is last because `stapler staple` REWRITES the image, so anything
  # hashed before it describes a file that no longer exists.
  [ "$(python3 tools/build-cache.py fingerprint)" = "$SOURCE_HASH" ] || {
    echo "build-local.sh: sources changed during the build; retry before publishing." >&2
    exit 1
  }
  python3 tools/build-cache.py record "$ROOT/target/release/bundle/dmg" \
    "$version" "$HOST_TRIPLE" "$SOURCE_HASH" "$NO_SIGN" "$dmg"
fi

if [ "$PUBLISH" -eq 1 ]; then
  step "[publish] upload to $PUBLIC_BASE"
  publish_release "$dmg" "$version"
  python3 tools/updater-release.py publish --artifact "$ROOT/target/release/bundle/macos/TuraNotes.app.tar.gz" --version "$version" --host "$PUBLISH_HOST" --stage "$PUBLISH_STAGE" --app "$PUBLISH_APP" --base "$PUBLIC_BASE"
fi

step "done"
echo ""
echo "Tura Notes $version"
echo "  $dmg"
echo "  $(cat "$dmg.sha256" 2>/dev/null || echo '(no sha256 sidecar)')"
if [ "$SIGN_ENABLED" -eq 1 ]; then
  if xcrun stapler validate "$dmg" >/dev/null 2>&1; then
    echo "  signed + notarised + stapled — distributable."
  else
    echo "  signed, NOT notarised — opens with an approval prompt. Do not publish (ADR-024)."
  fi
else
  echo "  UNSIGNED — local verification only. Do not distribute (ADR-024)."
fi
# `if`, not `[ … ] && echo …`: this is the last statement before the summary, and
# an AND-list whose test is false exits non-zero. Here the false case is the
# normal one — a published build — so the script would report a failure it did
# not have. Spelling it as an `if` removes the question entirely.
if [ "$PUBLISH" -eq 0 ]; then
  echo "  (not published — add --publish to upload it)"
fi
_summary
