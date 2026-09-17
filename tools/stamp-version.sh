#!/usr/bin/env bash
# Write `version.md`'s version into the places a build reads it from.
#
# WHY: `version.md` is the single source of the version (docs/versioning.md,
# ADR-011), and it is what `tools/release.sh` names the git tag and the GitHub
# Release after. A `.deb` attached to Release `0.11.1` that calls itself `0.1.0`
# is a package nobody can match to the code that produced it, and
# `tauri.conf.json` holds a second copy of the number precisely where that is
# easiest to get wrong.
#
# So the number is not maintained in two places: it is stamped, in CI, from the
# one file that has it. **What is committed is `0.0.0`**, which is valid semver
# and unmistakably not a release — a stale real number in the tree is the thing
# that misleads. `tools/check.sh` fails if the committed value is anything else,
# so a stamped tree cannot be committed by accident.
#
#   tools/stamp-version.sh            # stamp version.md's version
#   tools/stamp-version.sh 1.2.3      # stamp an explicit one
#
# Norm: docs/versioning.md · docs/decisions.md ADR-035
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONF="$ROOT/apps/notes-app/src-tauri/tauri.conf.json"

# REFUSE A TREE THAT IS ALREADY STAMPED, and this is the whole of a bug that
# cost a morning. Both build scripts do the same thing around this call: copy the
# config aside, stamp, build, copy the copy back. That is correct alone and
# unsafe together — a second build starting while the first holds its stamp
# copies aside a file that is *already stamped*, and its restore writes that back
# for good. Neither script is wrong; the pattern simply does not compose, and the
# tree is left carrying a real version where `0.0.0` belongs, which fails the
# next `tools/check.sh` for a reason that has nothing to do with the change
# being tested. Reproduced on 17/09 with two cycles holding the stamp for the
# length of a build.
#
# Refusing here turns a silent corruption into a loud stop at the moment it
# would be set up, and costs nothing in the normal case, where the committed
# `0.0.0` is what this reads.
current="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$CONF")"
if [ "$current" != "0.0.0" ]; then
  echo "stamp-version.sh: $CONF already says $current, not the committed 0.0.0." >&2
  echo "  A build is either running against this tree right now, or one ended without" >&2
  echo "  restoring it. Stamping now would let that build's restore make it permanent." >&2
  echo "  Fix: wait for it, or 'git checkout -- $CONF' if nothing is running." >&2
  exit 1
fi

version="${1:-}"
if [ -z "$version" ]; then
  # The first semver in version.md, which is the rule release.sh already applies
  # to the two shapes that live in this fleet.
  version="$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' "$ROOT/version.md" | head -1)"
fi
[ -n "$version" ] || { echo "stamp-version.sh: no version found" >&2; exit 1; }

python3 - "$CONF" "$version" <<'PY'
# `ensure_ascii=False`, and it is not cosmetic. Without it `json.dump` rewrites
# every non-ASCII character as an escape, so stamping turned the copyright's
# © into an escape on top of changing the version. JSON parses both to the
# same string, so nothing shipped wrong — but the stamp stopped being a
# one-line diff, and a stamp left behind by a build that did not restore its
# backup then looked like two unrelated edits. That is how one leak here cost
# an afternoon of looking for a second writer that did not exist.
import json, sys
path, version = sys.argv[1], sys.argv[2]
with open(path, encoding="utf-8") as f:
    conf = json.load(f)
conf["version"] = version
with open(path, "w", encoding="utf-8") as f:
    json.dump(conf, f, indent=2, ensure_ascii=False)
    f.write("\n")
PY

echo "$version"
