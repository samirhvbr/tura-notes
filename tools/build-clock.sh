#!/usr/bin/env bash
# The build clock — total wall time and time per step — for both platform halves.
#
# SOURCED, NEVER EXECUTED: `source tools/build-clock.sh` is what starts it.
#
# WHY IT IS A FILE AND NOT A BLOCK INSIDE EACH SCRIPT. `build-local.sh` carried
# this and `tools/build-linux.sh` did not, so a Linux release printed no step
# banner and no table: the only durations it ever gave you were Vite's "built in
# 324ms" and cargo's "Finished `release` profile in 17.37s", each of which is one
# stage inside one step of a six-minute run. "Which phase should I optimise" and
# "is this machine slower than the other one" were therefore questions only the
# Mac could answer. That is the same asymmetry as the publish ordering (1.1.14)
# and the unstamp ordering before the fingerprint, and it is fixed the same way:
# one implementation that both sides call, so a change to the table cannot reach
# one platform and miss the other.
#
# WHAT IT MEASURES: the script, end to end and step by step — sync, reuse check,
# dependencies, stamp, compile, bundle, names and checksums, publish. Not the
# compiler's own accounting, which is what the tools already print.
#
# A step name is printed TWICE, on purpose. Once as a banner when the step
# opens, carrying the clock at that moment, so a build that is four minutes into
# a cargo compile says so on screen rather than looking hung; once in the table
# at the end, which is the artefact you compare between runs.
#
# The table is printed on the way out of a run that finished. A run that aborts
# gets `_clock_abort` from the EXIT trap instead — one line with the elapsed
# time and the exit code, because a table of steps for a build that produced
# nothing invites reading it as if it had.
#
# API:
#   step "name"       close the open step, open this one, print the banner
#   _summary          close the open step, print the table
#   _clock_abort N    the line an EXIT trap prints when the build aborts
#
# Norm: docs/runbook.md §4

SECONDS=0

# `if`, not `[ … ] && …`. This file is sourced into scripts that run under
# `set -e`, and a top-level AND-list whose test is false is a non-zero status:
# written the short way, the clock would abort every build that is not macOS,
# which is every build this file was added for. build-local.sh carries the same
# note over its last statement, learned the same way.
_BUILD_OS="$(uname -s)"
if [ "$_BUILD_OS" = Darwin ]; then _BUILD_OS=macOS; fi

_PH_NAMES=(); _PH_TIMES=(); _PH_CUR=""; _PH_START=0

_fmt() {  # $1 = seconds -> "1h 02m 03s" / "4m 05s" / "37s"
  local t=$1
  if   [ "$t" -ge 3600 ]; then printf '%dh %02dm %02ds' $((t/3600)) $(((t%3600)/60)) $((t%60))
  elif [ "$t" -ge 60 ];   then printf '%dm %02ds' $((t/60)) $((t%60))
  else                         printf '%ds' "$t"; fi
}

step() {  # close the previous step, open a new one, show the running clock
  local now=$SECONDS
  if [ -n "$_PH_CUR" ]; then
    _PH_NAMES+=("$_PH_CUR"); _PH_TIMES+=($((now - _PH_START)))
  elif [ "$now" -gt 0 ]; then
    # Whatever ran before the first `step` is still time the build spent, and
    # dropping it would make the rows add up to less than the total.
    _PH_NAMES+=("preparation"); _PH_TIMES+=("$now")
  fi
  _PH_CUR="$1"; _PH_START=$now
  echo "==> [$(_fmt "$now")] $1"
}

_summary() {  # the table: every step, then the total
  if [ -n "$_PH_CUR" ]; then
    _PH_NAMES+=("$_PH_CUR"); _PH_TIMES+=($((SECONDS - _PH_START))); _PH_CUR=""
  fi
  echo ""
  echo "⏱  time per step ($_BUILD_OS):"
  local i
  for i in "${!_PH_NAMES[@]}"; do
    printf '     %8s  %s\n' "$(_fmt "${_PH_TIMES[$i]}")" "${_PH_NAMES[$i]}"
  done
  echo "     ────────"
  printf '     %8s  TOTAL\n' "$(_fmt "$SECONDS")"
}

_clock_abort() {  # $1 = exit code
  echo "" >&2
  echo "❌ build aborted after $(_fmt "$SECONDS")  ($_BUILD_OS, exit $1)" >&2
}
