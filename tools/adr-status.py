#!/usr/bin/env python3
"""Every ADR declares a status, from the four words an ADR may carry.

`docs/decisions.md` is the file the whole "do not re-litigate a decided
direction" rule points at, and the status line is how a reader knows whether
they are looking at a decision in force, one that was replaced, or one that was
never taken. A second word for one of those states is a word the reader has to
interpret rather than look up — which is the argument `tools/doc-status.sh`
already makes about the *document* vocabulary, and the same failure one file
along.

It had already happened: `ADR-043` through `ADR-068`, one contiguous block of
twenty-six, said `ACTIVE`, while every ADR on either side said `ACCEPTED`.
Normalized at `1.6.49`.

**The ADR words are deliberately not the document words.** A document is
`ACTIVE` because a reader is deciding whether to build against it now; an ADR is
`ACCEPTED` because a decision was taken then, and it stays taken after something
replaces it. `ACTIVE` on an ADR reads as a claim that the decision is still in
force — which is a claim about the code, not about the record.
"""
import re
import sys
from pathlib import Path

ADRS = Path(__file__).resolve().parent.parent / "docs" / "decisions.md"
WORDS = ("PROPOSED", "ACCEPTED", "SUPERSEDED", "REVERSED")

HEADING = re.compile(r"^##\s+(ADR-\d+)\b")
STATUS = re.compile(r"^\*\*Status:\*\*\s+`([A-Z]+)`")
ANY_STATUS = re.compile(r"^\*\*Status:\*\*\s*(.*)$")


def main() -> int:
    lines = ADRS.read_text().splitlines()
    problems = []
    seen = 0
    current = None
    status_line = None

    def close(adr, line):
        nonlocal seen
        if adr is None:
            return
        seen += 1
        if line is None:
            problems.append(f"{adr}: no **Status:** line")
            return
        m = STATUS.match(line)
        if not m:
            problems.append(
                f"{adr}: status is not a backticked word — {line.strip()[:60]}")
        elif m.group(1) not in WORDS:
            problems.append(
                f"{adr}: `{m.group(1)}` is not one of {', '.join(WORDS)}")

    for line in lines:
        h = HEADING.match(line)
        if h:
            close(current, status_line)
            current, status_line = h.group(1), None
            continue
        if current and status_line is None and ANY_STATUS.match(line):
            status_line = line
    close(current, status_line)

    if problems:
        print(f"adr-status: {len(problems)} problem(s) in {ADRS.name}",
              file=sys.stderr)
        for p in problems:
            print("  " + p, file=sys.stderr)
        print("\nAn ADR is ACCEPTED because a decision was taken, not ACTIVE"
              "\nbecause a page is current. The two vocabularies are separate"
              "\non purpose.", file=sys.stderr)
        return 1
    print(f"adr-status: {seen} ADRs, every status is one of "
          f"{', '.join(WORDS)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
