#!/usr/bin/env bash
# 0.1a acceptance: "Matar o processo durante 1000 saves em loop nunca deixa
# arquivo truncado ou vazio."
#
# Spawns `crash-writer`, kills it with SIGKILL at a random point, and checks
# that what is on disk is a *complete* payload — old or new, never a prefix.
# A temp file left behind is also a failure: it would show up in the user's tree.
#
#   tools/crash-save-loop.sh            1000 kills
#   ROUNDS=50 tools/crash-save-loop.sh  a quick local pass
#   CRASH_WRITER=/path/to/bin ...       another writer, for tools/tests/test_crash_loop.py
#
# THE LOOP HAS TO PROVE THE WRITER RAN (R6-30a). It used to discard the exit
# status and check whatever was on disk against its own header -- and the seed
# written below is a valid payload. A writer that exited 2 because
# `write_atomic` failed (ENOSPC, a read-only or noexec TMPDIR, a stale binary)
# or panicked with 101 left the seed in place, and 1000 rounds came back green
# without one atomic write having happened. Reproduced with a stub: 5/5 green.
# So every round must end by the SIGKILL this script sent (status 137), and at
# least one round must find something other than the seed on disk.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROUNDS="${ROUNDS:-1000}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -n "${CRASH_WRITER:-}" ]; then
  BIN="$CRASH_WRITER"
else
  echo "building crash-writer…" >&2
  cargo build --quiet -p notes-fs --bin crash-writer || exit 1
  BIN="$ROOT/target/debug/crash-writer"
fi
[ -x "$BIN" ] || { echo "crash-writer not built" >&2; exit 1; }

# Seed the note so the very first kill has a previous complete version to
# fall back to.
printf 'LEN=1\nx\nEND\n' > "$WORK/crash.md"

check() {
  local f="$WORK/crash.md" round="$1"
  [ -s "$f" ] || { echo "FAIL round $round: file is empty"; return 1; }
  local first last len body_len
  first="$(head -c 64 "$f" | head -n1)"
  last="$(tail -n1 "$f")"
  case "$first" in LEN=*) ;; *) echo "FAIL round $round: no LEN header (got '$first')"; return 1;; esac
  [ "$last" = "END" ] || { echo "FAIL round $round: truncated — last line '$last'"; return 1; }
  len="${first#LEN=}"
  # header + newline + body + newline + END + newline
  body_len=$(( ${#first} + 1 + len + 1 + 4 ))
  local actual; actual=$(wc -c < "$f")
  [ "$actual" -eq "$body_len" ] || { echo "FAIL round $round: size $actual, header says $body_len"; return 1; }
  return 0
}

fails=0
wrote=0
for i in $(seq 1 "$ROUNDS"); do
  "$BIN" "$WORK" crash.md >/dev/null 2>&1 &
  pid=$!
  # 1–40 ms: long enough to be mid-write, short enough for 1000 rounds.
  sleep "0.$(printf '%03d' $(( (RANDOM % 40) + 1 )))"
  kill -9 "$pid" 2>/dev/null
  wait "$pid" 2>/dev/null
  rc=$?
  # 137 is 128 + SIGKILL: the kill landed. Anything else means the writer
  # stopped on its own before it -- 2 is a failed write, 101 a panic -- and the
  # file on disk says nothing about crash safety.
  if [ "$rc" -ne 137 ]; then
    echo "FAIL round $i: the writer exited by itself with status $rc before the kill"
    fails=$((fails + 1))
  fi

  check "$i" || fails=$((fails + 1))
  [ "$(head -n1 "$WORK/crash.md")" = "LEN=1" ] || wrote=1

  # A kill between write and rename leaves the temporary file behind: no
  # process cleans up after SIGKILL. The guarantee is that it cannot
  # *accumulate* — the name is deterministic, so there is at most one per note
  # and the next save overwrites it.
  leftovers=$(find "$WORK" -name '.*.tmp' | wc -l)
  if [ "$leftovers" -gt 1 ]; then
    echo "FAIL round $i: $leftovers temp files — they are accumulating"
    fails=$((fails + 1))
  fi

  if [ $((i % 100)) -eq 0 ]; then echo "  $i/$ROUNDS rounds, $fails failures" >&2; fi
done

# The writer's first payload is LEN=100, so a run in which the file never left
# the LEN=1 seed never saw a write complete.
if [ "$wrote" -eq 0 ]; then
  echo "FAIL: in $ROUNDS rounds the note never left its seed; nothing was written"
  fails=$((fails + 1))
fi

if [ "$fails" -ne 0 ]; then
  echo "crash-save-loop: $fails/$ROUNDS FAILED"
  exit 1
fi
echo "crash-save-loop: $ROUNDS rounds, no truncated or empty note; temp files never exceeded one"
