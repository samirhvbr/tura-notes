#!/usr/bin/env python3
"""Every script the local gate runs is also run by a workflow.

`tools/check.sh` and `.github/workflows/` are two lists of the same contracts,
and the comment inside `ci.yml` already says what happens next: *"lists drift:
every check below existed in `check.sh` and in no workflow, so a pull request
that broke one was merged green"*.

It drifted again within hours of that comment being true. Four scripts were in
the gate and in no workflow: the three documentation checkers added at `1.6.43`,
`1.6.49` and `1.6.50`, and — older and worse — `server/tests/mcp.py`, milestone
0.7's only end-to-end proof, which meant a pull request breaking
`POST /v1/mcp` merged green.

So the list is no longer maintained by remembering. This reads every
`tools/…` and `server/tests/…` script out of `check.sh` and asserts each one
appears somewhere under `.github/workflows/`. It does not check *how* a
workflow runs it, or in which job — placing a check is judgement (a toolchain,
a container, a build on disk) and only the presence is mechanical.

A script that genuinely must not run in CI goes in `EXCLUDED` with its reason,
which is the point: the exclusion becomes a sentence somebody wrote rather than
a line nobody noticed was missing.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GATE = ROOT / "tools" / "check.sh"
WORKFLOWS = ROOT / ".github" / "workflows"

SCRIPT = re.compile(r"\b((?:tools|server)/[A-Za-z0-9._/-]+\.(?:py|sh|mjs))\b")
COMMENT = re.compile(r"^\s*#")

EXCLUDED = {
    "tools/check.sh": "the gate itself",
    "tools/ci-parity.py": "this file — a workflow running it is what it checks for",
}


def main() -> int:
    # Comment lines are dropped first, and that is a correctness fix rather than
    # tidiness: this checker claims to list the scripts the gate *runs*, and a
    # comment naming another script is not one. It caught itself on exactly that
    # — a comment in `check.sh` explaining why the gate's clock is not
    # `tools/build-clock.sh` was read as the gate running it, and demanded a
    # workflow for a file the gate never executes. A guard that has to be given
    # an exemption for its own imprecision has stopped measuring what it says.
    gate = "\n".join(
        line for line in GATE.read_text().splitlines() if not COMMENT.match(line)
    )
    wanted = {m for m in SCRIPT.findall(gate)} - set(EXCLUDED)

    workflow_text = "\n".join(
        p.read_text() for p in sorted(WORKFLOWS.glob("*.yml"))
    )

    missing = sorted(s for s in wanted if s not in workflow_text)
    if missing:
        print(f"ci-parity: {len(missing)} script(s) the gate runs and no workflow does",
              file=sys.stderr)
        for s in missing:
            print("  " + s, file=sys.stderr)
        print("\nA check that only runs when somebody remembers to run it is a"
              "\nconvention, not a gate. Add it to a workflow, or add it to"
              "\nEXCLUDED with the reason it must not run there.", file=sys.stderr)
        return 1

    print(f"ci-parity: {len(wanted)} scripts in the gate, every one also in a workflow")
    return 0


if __name__ == "__main__":
    sys.exit(main())
