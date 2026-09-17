#!/usr/bin/env bash
# Everything that must be green before a commit, in the order that fails fastest.
#
# The cross-target step is the one worth explaining: `cargo clippy` on Linux
# cannot see code behind `#[cfg(windows)]`, and cannot see that a helper used
# only under `#[cfg(unix)]` becomes dead on Windows — where `-D warnings` turns
# it into a build failure. Two CI rounds were spent on exactly that.
#
# **It runs by default, and installs the target if it is missing.** Skipping it
# when `rustup target add x86_64-pc-windows-gnu` had never been run made the one
# step that would have caught both compile failures the one step nobody had —
# a check that silently opts out is not a check. The target type-checks without
# linking. Bundled SQLite additionally needs a MinGW C compiler
# (mingw-w64 on Homebrew / gcc-mingw-w64-x86-64 on Debian). The target install is a one-off of a
# few seconds. `NOTES_NO_WINDOWS_CHECK=1` opts out deliberately; a machine
# missing rustup, the target or that C compiler degrades to a warning rather
# than a failure, because refusing to run the rest of the gate over a
# cross-check helps nobody.
#
# **The compiler is checked, and before the target is installed.** Checking only
# rustup and the target was the same mistake the paragraph above describes, one
# level down: the guard passed, cargo reached `libsqlite3-sys`, and cc-rs died
# with sixty lines that never name the missing package. A gate that is red for a
# reason which is not the code is a gate that gets ignored, and that costs more
# than the check it was protecting.
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

fail=0
step() {
  printf '\n== %s\n' "$1"; shift
  if "$@"; then echo "   ok"; else echo "   FAILED"; fail=1; fi
}

step "cargo fmt"            cargo fmt --all --check
step "clippy (native)"      cargo clippy --all-targets -- -D warnings
windows_target_ready() {
  [ -z "${NOTES_NO_WINDOWS_CHECK:-}" ] || { echo "opted out by NOTES_NO_WINDOWS_CHECK"; return 1; }
  command -v rustup >/dev/null 2>&1 || { echo "no rustup on this machine"; return 1; }
  command -v x86_64-w64-mingw32-gcc >/dev/null 2>&1 || {
    echo "no MinGW C compiler (gcc-mingw-w64-x86-64 on Debian, mingw-w64 on Homebrew)"; return 1; }
  rustup target list --installed 2>/dev/null | grep -q '^x86_64-pc-windows-gnu$' && return 0
  echo "   installing the x86_64-pc-windows-gnu target (one-off)…" >&2
  rustup target add x86_64-pc-windows-gnu >/dev/null 2>&1 || { echo "could not install the target"; return 1; }
}

if why=$(windows_target_ready); then
  step "clippy (windows)"   cargo clippy --target x86_64-pc-windows-gnu \
                              -p notes-model -p notes-fs -p notes-core -p notes-markdown -p notes-index -p notes-mcp -p notes-server -p notes-sync -p notes-sync-client \
                              --all-targets -- -D warnings
else
  printf '\n== clippy (windows)\n   WARNING, not run — %s\n' "${why:-unknown}"
fi
step "cargo test"           cargo test --workspace
# Dependabot opens pull requests for new versions; it does not say whether the
# version pinned right now has a known vulnerability, and `security.md` §10 names
# dependency maintenance as a control. Both degrade to a warning when the tool is
# not installed — refusing to run the rest of the gate over a missing checker
# helps nobody, and the message names the one command that fixes it.
if command -v cargo-audit >/dev/null 2>&1; then
  step "rust advisories"    cargo audit --deny warnings
else
  printf '\n== rust advisories\n   WARNING, not run — install it once: cargo install cargo-audit --locked\n'
fi
# `--audit-level=high`, not `low`: a moderate advisory in a build-time dependency
# of a desktop application that opens no port is a queue item, and a gate that is
# red for one of those is a gate people learn to override.
step "frontend advisories" bash -c 'cd apps/notes-app && npm audit --audit-level=high'
step "transport binaries"  cargo build -p notes-server -p notes-sync-client --locked
step "server TCP smoke"    python3 server/tests/smoke.py
step "co-tenant server"    python3 server/tests/cotenant.py
step "byte preservation"    tools/byte-preservation.sh
step "full disk (ENOSPC)"   tools/enospc.sh
step "generated types"      bash -c '
  rm -rf apps/notes-app/src/ipc/generated
  cargo test -p notes-model -p notes-core -p notes-markdown -p notes-sync-client --lib --quiet >/dev/null 2>&1
  # Two questions, because one command answers only half of it: `git diff` sees
  # a changed file, and a type added by a new crate arrives *untracked*, which a
  # diff does not see at all.
  git diff --quiet --exit-code -- apps/notes-app/src/ipc/generated &&
  [ -z "$(git ls-files --others --exclude-standard -- apps/notes-app/src/ipc/generated)" ]'
step "no fs capability"     bash -c '
  ! grep -rqE "\"fs:[a-z-]+\"" apps/notes-app/src-tauri/capabilities/'
step "serde/ts pairing"    python3 tools/ts-serde.py
# The bundle version is stamped from version.md at build time (ADR-035). What
# is committed is the placeholder; a real number here is a second copy of the
# version, and it is the copy that goes stale.
step "version placeholder"  bash -c '
  grep -q '"'"'"version": "0.0.0"'"'"' apps/notes-app/src-tauri/tauri.conf.json'
# Every text colour against every surface it can land on, and the three dark
# levels far enough apart to survive a bad panel (`ACCEPTANCE-0.1d.md`).
step "contrast"            tools/contrast.sh
step "no blocking dialogs" tools/no-blocking-dialogs.sh
step "document status"     tools/doc-status.sh
# Two rule blocks for the same selector is not a style question — the later one
# wins on what it sets and the earlier survives on what it does not, so the
# rendered result is a mix nobody designed. `.menu` was that for a while: a dead
# block's padding and radius beat the live one's by specificity.
step "one .menu rule block"  bash -c '
  [ "$(grep -c "^\.menu {" apps/notes-app/src/styles.css)" -eq 1 ]'
# A menu whose labels can be text-selected is a menu that paints every item at
# once the moment anything selects. Native chrome does not select.
step "chrome is not selectable" bash -c '
  grep -q "^\.menu, \.menu-item, \.rail, \.tabbar, \.statusbar, \.row-wrap {" apps/notes-app/src/styles.css'
# Parity was checked here and resolution was not, so a key used by the code and
# defined in neither language passed: `t()` returns the key, and the dialog
# renders it as body text.
step "i18n keys resolve"   python3 tools/i18n-keys.py
step "Linux packaging orchestration" python3 tools/tests/test_build_linux.py
step "updater publication" python3 tools/tests/test_updater_release.py
step "macOS build script" python3 tools/tests/test_build_local.py
step "self-hosting guide"  python3 tools/tests/test_selfhosting_doc.py
step "hand-written IPC shape" python3 tools/tests/test_env_report.py
step "development version" node --test tools/tauri.test.mjs
step "frontend tests"       bash -c 'cd apps/notes-app && npm test -- --run >/dev/null'
step "frontend"             bash -c 'cd apps/notes-app && npm run build >/dev/null'

echo
if [ "$fail" -ne 0 ]; then echo "FAILED"; exit 1; fi
echo "all green"
