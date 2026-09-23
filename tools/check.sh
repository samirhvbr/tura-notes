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
# few seconds. `NOTES_NO_WINDOWS_CHECK=1` opts out deliberately, and that
# variable is now the ONLY way this step does not run: a machine missing rustup
# or that C compiler **fails**. It used to warn and let the run go green, which
# is the same "silently opts out" this paragraph refuses one line up — the
# difference between a check that was skipped and a check that passed has to
# survive into the exit code, or the two become the same thing to whoever reads
# it. An escape hatch somebody chose is a skip; a tool nobody noticed was
# missing is a failure.
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

# THE GATE MEASURES ITSELF, for the reason `tools/build-clock.sh` exists one
# directory over: *"which phase should I optimise"* and *"is this machine slower
# than the other one"* are questions nothing could answer about the build until
# it was measured, and nothing could answer about the gate until now. This file
# went from 26 steps to 32 in one day; without a clock the only honest answer to
# "what did that cost" is a shrug.
#
# It is not `source tools/build-clock.sh`, and that is deliberate rather than
# duplication. The two `step` functions have opposite contracts: the build's
# aborts on the first failure, because a bundle built from a failed compile is
# worse than no bundle, while this one **keeps going and reports every failure**,
# because the answer to "what else is broken" should not cost another run. A
# shared helper would have to serve both, and the difference is the whole point
# of each.
#
# The table prints on success and on failure. A run that went red is exactly
# when somebody wants to know which step ate the four minutes before it.
_names=(); _times=()
step() {
  printf '\n== %s\n' "$1"
  local name="$1" start elapsed; shift
  start=$SECONDS
  if "$@"; then echo "   ok"; else echo "   FAILED"; fail=1; fi
  elapsed=$((SECONDS - start))
  _names+=("$name"); _times+=("$elapsed")
  [ "$elapsed" -ge 5 ] && printf '   %ds\n' "$elapsed"
  return 0
}

# The slowest first: the table is read to find what to attack, not to audit the
# order things ran in — that is what the run above already prints. Anything
# under a second is summed into one line rather than listed, because thirty
# names at `0s` bury the three that matter.
_summary() {
  local total=$((SECONDS - _gate_start)) i fast=0 fast_n=0
  echo
  printf 'gate: %d steps in %dm%02ds\n' "${#_names[@]}" $((total / 60)) $((total % 60))
  for i in "${!_names[@]}"; do
    if [ "${_times[$i]}" -lt 1 ]; then fast=$((fast + _times[i])); fast_n=$((fast_n + 1)); fi
  done
  for i in $(for j in "${!_times[@]}"; do printf '%s %s\n' "${_times[$j]}" "$j"; done | sort -rn | awk '{print $2}'); do
    [ "${_times[$i]}" -lt 1 ] && continue
    printf '  %4ds  %s\n' "${_times[$i]}" "${_names[$i]}"
  done
  [ "$fast_n" -gt 0 ] && printf '  %4ds  (%d steps under a second)\n' "$fast" "$fast_n"
  return 0
}
_gate_start=$SECONDS

# A MISSING TOOL IS A FAILURE, NOT A WARNING.
#
# Both checks below used to print `WARNING, not run` and let the gate go green.
# The reasoning was that refusing to run the rest of the gate over a missing
# checker helps nobody, and it is wrong in the way that costs most: it makes the
# local gate and CI disagree about what green means, and CI is the one that
# gates. `cargo-audit` was not installed on the owner's machine, so `rust
# advisories` had never actually run here — while CI was red on it, and a real
# `rustls` TLS 1.3 flaw sat inside that red for two versions (1.4.4).
#
# So: install it if that is possible unattended, and fail if it is not. The
# message names the one command that fixes it, which is what the warning was
# for; what it does not do any more is let the run claim to have checked
# something it skipped.
require_tool() {                      # require_tool NAME INSTALL_CMD…
  local name="$1"; shift
  command -v "$name" >/dev/null 2>&1 && return 0
  [ "$#" -gt 0 ] || return 1
  printf '   %s is missing; installing it once…\n' "$name" >&2
  "$@" >/dev/null 2>&1 || return 1
  command -v "$name" >/dev/null 2>&1
}
missing() {                           # missing NAME HOW-TO-FIX
  printf '\n== %s\n   FAILED, not run — %s\n' "$1" "$2"; fail=1
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
elif [ -n "${NOTES_NO_WINDOWS_CHECK:-}" ]; then
  # The declared escape hatch is the one way this is not a failure: somebody
  # chose it, in writing, in the environment.
  printf '\n== clippy (windows)\n   skipped — %s\n' "$why"
else
  # The target installs itself; a C cross-compiler does not, and that is where
  # this stops rather than passes.
  missing "clippy (windows)" "$why — install it, or set NOTES_NO_WINDOWS_CHECK=1 to opt out deliberately"
fi
step "cargo test"           cargo test --workspace
# Dependabot opens pull requests for new versions; it does not say whether the
# version pinned right now has a known vulnerability, and `security.md` §10 names
# dependency maintenance as a control. `cargo-audit` is installed on demand
# because it can be; a run that cannot get it stops rather than reporting green.
if require_tool cargo-audit cargo install cargo-audit --locked; then
  step "rust advisories"    cargo audit --deny warnings
else
  missing "rust advisories" "cargo install cargo-audit --locked failed; run it by hand and read why"
fi
# `--audit-level=high`, not `low`: a moderate advisory in a build-time dependency
# of a desktop application that opens no port is a queue item, and a gate that is
# red for one of those is a gate people learn to override.
step "frontend advisories" bash -c 'cd apps/notes-app && npm audit --audit-level=high'
step "transport binaries"  cargo build -p notes-server -p notes-sync-client --locked
step "server TCP smoke"    python3 server/tests/smoke.py
step "co-tenant server"    python3 server/tests/cotenant.py
# Its own process, so its own rate buckets: appended to smoke.py these calls
# would be what pushes that suite past the 120/min per-IP ceiling.
step "remote MCP"          python3 server/tests/mcp.py
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
# The CSP the webview runs under, and the page that prints it (ADR-089).
step "desktop CSP"         python3 tools/csp.py
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
step "documentation links" python3 tools/doc-links.py
step "ADR status words"    python3 tools/adr-status.py
step "documentation index" python3 tools/doc-index.py
step "gate and CI agree"   python3 tools/ci-parity.py
step "acceptance ranges"   python3 tools/doc-ranges.py
step "changelog versions" python3 tools/changelog-versions.py
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
# The drawer breakpoint lives in two files by necessity - CSS cannot read a TS
# constant - so this is what keeps them one number. A stylesheet that overlays at
# one width while the store closes the sidebar at another is a layout nobody can
# reason about, and the symptom is a note opening behind the drawer that opened
# it.
step "one drawer breakpoint" bash -c '
  q="$(grep -oE "\\(max-width: [0-9]+px\\)" apps/notes-app/src/stores/ui.ts | head -1)"
  [ -n "$q" ] && grep -q "@media $q" apps/notes-app/src/styles.css'
step "i18n keys resolve"   python3 tools/i18n-keys.py
step "Linux packaging orchestration" python3 tools/tests/test_build_linux.py
step "updater publication" python3 tools/tests/test_updater_release.py
step "macOS build script" python3 tools/tests/test_build_local.py
step "self-hosting guide"  python3 tools/tests/test_selfhosting_doc.py
step "hand-written IPC shape" python3 tools/tests/test_env_report.py
step "development version" node --test tools/tauri.test.mjs
# A fresh worktree has no `node_modules` — it is gitignored, and `git worktree
# add` copies none of it. Both steps below then die on `vitest: not found`, which
# is the shell's error leaking through a gate that knows perfectly well what is
# missing. Three worktrees in one session hit it. `missing` is the same helper
# the Windows cross-check uses, so a prerequisite reads the same way wherever it
# is absent.
if [ -x apps/notes-app/node_modules/.bin/vitest ]; then
  step "frontend tests"     bash -c 'cd apps/notes-app && npm test -- --run >/dev/null'
  step "frontend"           bash -c 'cd apps/notes-app && npm run build >/dev/null'
else
  missing "frontend tests" "no node_modules in this checkout — run: (cd apps/notes-app && npm ci)"
  missing "frontend"       "no node_modules in this checkout — run: (cd apps/notes-app && npm ci)"
fi

_summary
echo
if [ "$fail" -ne 0 ]; then echo "FAILED"; exit 1; fi
echo "all green"
