#!/usr/bin/env bash
# Native Linux packaging; invoked by build-local.sh and deploy.sh.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
# The clock both halves print. Sourcing it starts it; `step` names a phase and
# `_summary` prints the table. This side ran without one until 1.6.7, so the
# only durations a Linux release reported were Vite's and cargo's, each of them
# one stage inside one step of the run. See tools/build-clock.sh.
. "$ROOT/tools/build-clock.sh"
bundles=deb,appimage
skip_npm=0; skip_pull=0; publish=0; force=0
host="${TURA_PUBLISH_HOST:-b3sys@100.64.100.125}"
stage="${TURA_PUBLISH_STAGE:-/tmp}"
app="${TURA_PUBLISH_APP:-/srv/www/samirhv.com.br/samirhv}"
slug="${TURA_PUBLISH_SLUG:-tura-notes}"
base="${TURA_PUBLIC_BASE:-https://samirhv.com.br}"
usage() {
  cat <<'HELP'
Usage: ./build-local.sh [--bundles deb,appimage] [--skip-npm-ci]
                       [--skip-git-pull] [--publish] [--dest user@host]
Linux builds .deb and .AppImage by default. Optional targets: deb,appimage,rpm.
Existing builds are reused after version, source and checksum verification.
--force rebuilds even when reusable packages exist.
--no-sign is accepted for local builds, but cannot be combined with --publish.
--base-url URL changes the download-page URL printed after publication.
Requires Node 22.22.2+, 24.15+ or 26+, Rust, Python 3 and the Tauri Linux dependencies.
Debian/Ubuntu: build-essential pkg-config libwebkit2gtk-4.1-dev libssl-dev
  libayatana-appindicator3-dev librsvg2-dev patchelf file xdg-utils
Arch: base-devel pkgconf webkit2gtk-4.1 openssl libayatana-appindicator
  librsvg patchelf file xdg-utils
Install these with your distribution's package manager before building.
HELP
}
no_sign=0
while [ $# -gt 0 ]; do
  case "$1" in
    --bundles|--dest|--base-url)
      option="$1"; shift
      [ $# -gt 0 ] && [ -n "$1" ] || { echo "Missing value for $option" >&2; exit 2; }
      case "$option" in --bundles) bundles="$1";; --dest) host="$1";; --base-url) base="$1";; esac ;;
    --skip-npm-ci) skip_npm=1;;
    --skip-git-pull) skip_pull=1;;
    --publish) publish=1;;
    --no-sign) no_sign=1;;
    --force|-f) force=1;;
    --help|-h) usage; exit 0;;
    *) echo "Unknown option: $1" >&2; exit 2;;
  esac
  shift
done
[ "$(uname -s)" = Linux ] || { echo 'Linux builds must run on Linux.' >&2; exit 1; }
[ "$publish:$no_sign" != 1:1 ] || { echo 'Cannot publish a --no-sign test build.' >&2; exit 2; }
IFS=, read -r -a targets <<< "$bundles"
[[ "$bundles" != ,* && "$bundles" != *, && "$bundles" != *,,* ]] || exit 2
for target in "${targets[@]}"; do
  case "$target" in deb|appimage|rpm) :;; *) echo "Unsupported Linux bundle: $target" >&2; exit 2;; esac
done
if [ -n "${CARGO_BUILD_TARGET:-}" ]; then
  echo 'Native Linux builds require CARGO_BUILD_TARGET to be unset.' >&2; exit 2
fi
# One EXIT trap, set once and here rather than around the compile, doing both
# things it has to do and reading `$?` FIRST. It restores the committed
# placeholder — `tools/check.sh` rejects a stamped tree, so an interrupted build
# used to break the next commit as well as itself — and it prints how long the
# run lasted before it died. Installed after the option parsing, like the macOS
# half: a usage error is not a build that aborted, and should not be timed as
# one. `$backup` is empty until there is something to restore, which is what
# makes the same trap correct before the stamp and after it.
config=apps/notes-app/src-tauri/tauri.conf.json
backup=""
_on_exit() {
  local code=$?
  if [ -n "$backup" ] && [ -f "$backup" ]; then cp "$backup" "$config"; rm -f "$backup"; backup=""; fi
  [ "$code" -eq 0 ] || _clock_abort "$code"
  exit "$code"
}
trap _on_exit EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# The same sync build-local.sh does, for the reason written in its header: a
# build that refuses to run because the network is down is worse than a build
# that tells you it used the local tree. Linux was the half that did not comply
# — under `set -e`, one `git pull --ff-only` turned an offline machine, a
# detached HEAD or a diverged branch into an aborted build. --ff-only still
# never creates a merge, and --skip-git-pull still skips the step outright.
git_sync() {
  if [ "$skip_pull" -eq 1 ]; then
    echo 'Skipping the pull: --skip-git-pull.'
    return 0
  fi
  if ! git rev-parse --git-dir >/dev/null 2>&1; then
    echo 'Not a git checkout; building what is here.'
    return 0
  fi
  if git pull --ff-only; then
    return 0
  fi
  echo 'Could not fast-forward; building the local checkout as it is.' >&2
  return 0
}
step "[git] sync with the remote (git pull --ff-only)"
git_sync
if ! command -v cargo >/dev/null && [ -x "$HOME/.cargo/bin/cargo" ]; then export PATH="$HOME/.cargo/bin:$PATH"; fi
if [ "$publish" -eq 1 ]; then
  step "[publish] check the download service on the server"
  command -v scp >/dev/null; command -v ssh >/dev/null
  [[ "$stage" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'Use an absolute publish staging path without spaces or shell characters' >&2; exit 2; }
  [[ "$app" =~ ^/[a-zA-Z0-9_./-]+$ ]] || { echo 'Use an absolute publish application path without spaces or shell characters' >&2; exit 2; }
  [[ "$host" != -* && "$host" =~ ^[a-zA-Z0-9_.@-]+$ ]] || { echo 'Invalid publish host' >&2; exit 2; }
  # Ask the destination whether it is the destination, before compiling anything.
  # The app path is a written-down guess and nothing checked it: a wrong one used
  # to survive the whole build and upload and then report `cd: no such file`,
  # which is true and does not name the fix. The regexes above are what makes
  # plain single quotes safe here; `quote` needs python3, checked further down.
  probe=0; ssh "$host" "test -f '$app/artisan'" || probe=$?
  if [ "$probe" -ne 0 ]; then
    if [ "$probe" -eq 255 ]; then
      echo "Could not reach $host over ssh; check the address and that the key is installed." >&2
    else
      echo "No download service at $app on $host (no artisan), so files:add cannot run." >&2
      echo "Find it and set the path:  ssh $host 'ls -d /srv/www/*/ /var/www/*/ 2>/dev/null'" >&2
    fi
    exit 2
  fi
fi
# Check completed packages before requiring the compilation toolchain. These
# three tools are what answering the reuse question costs; the build toolchain
# is checked below, and only if something has to be built.
step "[reuse] is there a build of this version on disk?"
for tool in python3 rustc sha256sum; do
  command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool" >&2; exit 1; }
done
version="$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' version.md | head -1)"
host_triple="$(rustc -vV | sed -n 's/^host: //p')"
[ -n "$version" ] && [ -n "$host_triple" ] || exit 1
output="$ROOT/target/local-linux/$host_triple"
export CARGO_TARGET_DIR="$output"
source_hash="$(python3 tools/build-cache.py fingerprint)"
artifacts=(); pending=()
for target in "${targets[@]}"; do
  directory="$output/release/bundle/$target"
  listing="$(mktemp)"
  if [ "$force" -eq 0 ] && python3 tools/build-cache.py check "$directory" "$version" "$host_triple" "$source_hash" "$no_sign" > "$listing"; then
    while IFS= read -r -d '' artifact; do artifacts+=("$artifact"); done < "$listing"
    echo "Reusing $target for $version: sources and SHA-256 verified."
  else
    pending+=("$target")
  fi
  rm -f "$listing"
done
if [ "${#pending[@]}" -gt 0 ]; then
  step "[prerequisites] check the toolchain (Node, Rust, Tauri libraries)"
  for tool in node npm cargo rustc python3 pkg-config cc file patchelf sha256sum; do
    command -v "$tool" >/dev/null || { echo "Missing prerequisite: $tool (see --help)" >&2; exit 1; }
  done
  node -e 'const [m,n,p]=process.versions.node.split(".").map(Number);if(!((m===22&&(n>22||(n===22&&p>=2)))||(m===24&&n>=15)||m>=26)){console.error("Use Node 22.22.2+, 24.15+ or 26+");process.exit(1)}'
  pkg-config --exists gtk+-3.0 webkit2gtk-4.1 openssl librsvg-2.0 || {
    echo 'Missing Tauri development libraries. See --help for distribution packages.' >&2; exit 1;
  }

  backup="$(mktemp)"
  cp "$config" "$backup"
  for target in "${pending[@]}"; do
    directory="$output/release/bundle/$target"
    mkdir -p "$directory"
    rm -f "$directory/.build.json"
    find "$directory" -maxdepth 1 -type f \( -name '*.deb' -o -name '*.AppImage' -o -name '*.rpm' -o -name '*.sha256' \) -delete
  done
  step "[1/4] frontend dependencies (npm ci)"
  if [ "$skip_npm" -eq 0 ]; then (cd apps/notes-app && npm ci); else echo '    (skipped: --skip-npm-ci)'; fi

  step "[2/4] updater signing preflight and version stamp"
  if [ "$no_sign" -eq 0 ]; then python3 tools/updater-release.py preflight; fi
  tools/stamp-version.sh >/dev/null
  echo "    tauri.conf.json → $version (0.0.0 restored on exit)"

  export APPIMAGE_EXTRACT_AND_RUN=1
  pending_bundles="$(IFS=,; echo "${pending[*]}")"
  step "[3/4] tauri build (compile and bundle: $pending_bundles)"
  (cd apps/notes-app && npm run tauri build -- --bundles "$pending_bundles")

  # Same rename as the macOS side, before anything hashes or signs the name.
  step "[4/4] canonical names, checksums and updater signatures"
  for target in "${pending[@]}"; do tools/name-bundles.sh "$output/release/bundle/$target"; done
  cp "$backup" "$config"; rm -f "$backup"; backup=""
  [ "$(python3 tools/build-cache.py fingerprint)" = "$source_hash" ] || {
    echo 'Sources changed during the build; retry before publishing.' >&2; exit 1;
  }
  for target in "${pending[@]}"; do
    directory="$output/release/bundle/$target"
    extension="$target"; [ "$target" != appimage ] || extension=AppImage
    built=()
    while IFS= read -r -d '' artifact; do
      built+=("$artifact")
      (cd "$(dirname "$artifact")" && sha256sum "$(basename "$artifact")" > "$(basename "$artifact").sha256")
    done < <(find "$directory" -maxdepth 1 -type f -name "*.$extension" -print0)
    [ "${#built[@]}" -gt 0 ] || { echo "Build produced no $target package" >&2; exit 1; }
    if [ "$no_sign" -eq 0 ]; then
      for artifact in "${built[@]}"; do
        python3 tools/updater-release.py prepare --artifact "$artifact" --version "$version" --platform "linux-${host_triple%%-*}-$target"
      done
    fi
    python3 tools/build-cache.py record "$directory" "$version" "$host_triple" "$source_hash" "$no_sign" "${built[@]}"
    artifacts+=("${built[@]}")
  done
else
  echo 'Build already complete; skipping npm ci and compilation.'
fi
# Quote each remote argument for the POSIX shell used by ssh.
quote() { python3 -c 'import shlex,sys; print(shlex.quote(sys.argv[1]))' "$1"; }
if [ "$publish" -eq 1 ]; then step "[publish] upload, verify and ingest on $host"; fi
for artifact in "${artifacts[@]}"; do
  echo "Tura Notes $version: $artifact"
  if [ "$publish" -eq 1 ]; then
    name="$(basename "$artifact")"
    remote_file="$stage/$name"
    scp "$artifact" "$artifact.sha256" "$host:$stage/"
    expected="$(sha256sum "$artifact" | awk '{print $1}')"
    actual="$(ssh "$host" "sha256sum -- $(quote "$remote_file")" | awk '{print $1}')"
    [ "$actual" = "$expected" ] || { echo 'Upload checksum mismatch; not ingested.' >&2; exit 1; }
    # -t: ssh allocates no terminal by default, so sudo cannot prompt and dies
    # with "a terminal is required to read the password". See build-local.sh.
    ssh -t "$host" "cd $(quote "$app") && sudo -u www-data php artisan files:add $(quote "$remote_file") --project=$(quote "$slug") --version=$(quote "$version") --label=$(quote "Tura Notes $version — Linux ($(uname -m))")"
    ssh "$host" "rm -f -- $(quote "$remote_file") $(quote "$remote_file.sha256")"
    python3 tools/updater-release.py publish --artifact "$artifact" --version "$version" --host "$host" --stage "$stage" --app "$app" --base "$base"
  fi
done
if [ "$publish" -eq 1 ]; then echo "Published: $base/p/$slug"; fi
_summary
