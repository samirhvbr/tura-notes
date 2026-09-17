#!/usr/bin/env python3
"""A range that claims every row — `C1–C15` — names the number of rows there are.

The acceptance documents number their walks by letter, and other pages cite them
as a range: `.continue/0.1d-interface.md` tells the owner to walk `I1–I16`,
`docs/README.md` advertises a count, `ACCEPTANCE-0.1d.md` §3 says which flows it
carries. Adding one row therefore means editing three or four files that do not
contain the row, and the ones nobody edits are the ones that quietly undercount.

That has happened twice and cost differently each time. At `1.6.41` the queue
asked for `I1–I10` where there were sixteen — and a queue item that undercounts
is worse than one that overcounts, because the walk stops at ten, the item gets
ticked, and the six rows added since are never walked by anybody. At `1.6.74`
adding `C15` meant four edits in four files for one row.

**Only ranges that start at 1 are checked.** `I11–I13` is a deliberate reference
to a subset — three rows that need no phone — and is nobody's claim about how
many rows exist. A range starting at 1 is exactly that claim, which is what makes
it checkable and what makes it worth checking.

The rows themselves live in `docs/*.md`, so that is where the maximum comes from;
the citation may be anywhere, including `.continue/` and the root `README.md`.

**`CHANGELOG.md` and `.loop/` are excluded, for one reason rather than two.**
Both are records of what happened, and a record of a corrected mistake has to be
able to contain the mistake: the entry explaining that the queue said `I1–I10`
where there were sixteen is *quoting*, not claiming. Forbidding a wrong number in
the file whose job is to remember wrong numbers would make the check fail on its
own history — which it did, on the first run, against this very sentence.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROW = re.compile(r"^\|\s*([A-Z])(\d+)\s*\|")
# `C1–C15` or `C1-C15`; the second letter is optional (`C1–15` reads the same).
RANGE = re.compile(r"\b([A-Z])1[–-]\1?(\d+)\b")


def main() -> int:
    docs = sorted((ROOT / "docs").glob("*.md"))
    highest: dict[str, int] = {}
    for p in docs:
        for line in p.read_text(errors="replace").splitlines():
            m = ROW.match(line)
            if m:
                letter, n = m.group(1), int(m.group(2))
                if n > highest.get(letter, 0):
                    highest[letter] = n

    out = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z", "*.md"],
        capture_output=True, text=True, check=True).stdout
    files = [f for f in out.split("\0")
             if f and "fixtures/" not in f and "docs/history/" not in f
             and not f.startswith(".loop/") and f != "CHANGELOG.md"]

    problems = []
    checked = 0
    for rel in files:
        for n_line, line in enumerate((ROOT / rel).read_text(errors="replace").splitlines(), 1):
            for m in RANGE.finditer(line):
                letter, claimed = m.group(1), int(m.group(2))
                actual = highest.get(letter)
                if actual is None:
                    continue
                checked += 1
                if claimed != actual:
                    problems.append(
                        f"{rel}:{n_line}: {m.group(0)} — there are {actual} "
                        f"{letter} rows in docs/, not {claimed}")

    if problems:
        print(f"doc-ranges: {len(problems)} stale range(s)", file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        print("\nA range that undercounts is the expensive direction: the walk"
              "\nstops early and the rows added since are never walked.",
              file=sys.stderr)
        return 1
    print(f"doc-ranges: {checked} full ranges, each matching its rows "
          f"({', '.join(f'{k}={v}' for k, v in sorted(highest.items()))})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
