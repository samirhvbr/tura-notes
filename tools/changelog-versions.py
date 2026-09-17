#!/usr/bin/env python3
"""Every version in the changelog exists, except the one being written now.

`CHANGELOG.md` is the handoff artefact: *"each `##` heading is literally the
commit subject"*. A heading whose commit was never made is a version somebody
looks for in `git log`, in the tags and on the Releases page, and does not find
in any of the three — and `tools/release.sh` cannot help, because it walks
`version.md` across history and a version that was never committed never
appeared there.

**That happened at `1.6.87`**: entry written, `version.md` bumped, gate green,
and then the next item started before the commit. The next bump overwrote the
file and the work shipped inside `1.6.88`, leaving a heading with nothing behind
it. The `pre-push` hook cannot catch this — it compares `version.md` against the
remote, and the second bump was a legitimate increment.

**It asks `version.md`, not the tags, and that is a correction to its own first
draft.** Tags were the obvious evidence and they are wrong twice over: a tag is
created by the release workflow *after* the push, so a gate run in the minutes
between fails on the version it just shipped — which is exactly what happened on
the first run — and fetching them would put the network inside a check that must
work on a train. `git log -p -- version.md` is local, is one call, and is the
same source of truth `tools/release.sh` walks.

**The version being written is exempt**, because it has not been committed yet
and so has never appeared in that file's history. Every other heading has had its
commit; a version that never did is precisely the defect.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HEADING = re.compile(r"^## (\d+\.\d+\.\d+) ", re.M)


SEMVER = re.compile(r"\b(\d+\.\d+\.\d+)\b")


def committed_versions() -> set[str]:
    """Every value `version.md` has ever held, from one `git log -p`.

    **This needs real history**, which a CI checkout does not have by default:
    `actions/checkout` is shallow, `git log` then sees one commit, and every
    heading but the newest reads as uncommitted. The `contracts` job asks for
    `fetch-depth: 0` for exactly this, and the shallow case is detected below
    rather than left to produce two hundred confident false failures.
    """
    out = subprocess.run(
        ["git", "-C", str(ROOT), "log", "-p", "--format=", "--", "version.md"],
        capture_output=True, text=True, check=True).stdout
    found = set()
    for line in out.splitlines():
        if line.startswith("+") and not line.startswith("+++"):
            m = SEMVER.search(line)
            if m:
                found.add(m.group(1))
    return found


def shallow() -> bool:
    return subprocess.run(
        ["git", "-C", str(ROOT), "rev-parse", "--is-shallow-repository"],
        capture_output=True, text=True, check=True).stdout.strip() == "true"


def main() -> int:
    if shallow():
        print("changelog-versions: FAILED, not run — this is a shallow clone, "
              "and the check reads `git log -- version.md`. Use "
              "`fetch-depth: 0` in CI, or `git fetch --unshallow` locally.",
              file=sys.stderr)
        return 1

    current = (ROOT / "version.md").read_text().split()[0]
    headings = list(dict.fromkeys(HEADING.findall((ROOT / "CHANGELOG.md").read_text())))
    committed = committed_versions()

    missing = [h for h in headings if h != current and h not in committed]
    if missing:
        print(f"changelog-versions: {len(missing)} heading(s) no commit ever carried",
              file=sys.stderr)
        for v in missing:
            print(f"  {v} — `version.md` never held this in any commit, so it has"
                  f" no tag and no Release", file=sys.stderr)
        print("\nFold the entry into the version that actually shipped its work."
              "\nIf the work did ship under this number, the commit is missing,"
              "\nnot the entry.", file=sys.stderr)
        return 1

    print(f"changelog-versions: {len(headings)} versions, {len(headings) - 1} "
          f"committed and {current} in flight")
    return 0


if __name__ == "__main__":
    sys.exit(main())
