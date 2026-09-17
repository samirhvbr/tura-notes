#!/usr/bin/env python3
"""Every page at the top of `docs/` is linked from `docs/README.md`.

`docs/README.md` is the index — the page somebody opens to find out what has
been written down. A document that is not in it is found only by somebody who
already knows its filename, which for a record whose whole purpose is to be
found is close to not having written it.

Three had slipped when this check was written: `OWNER-ACTS.md`, `MOBILE-0.4.md`
and `brand.md` — and `OWNER-ACTS.md` was added to the repository four days after
the index it belonged in, by the same hand, in a pass that was otherwise careful
about the same-pass rule. That is the argument for a check rather than a habit.

**`docs/history/` is deliberately out of scope.** The index links that directory
as a whole and says why: superseded planning drafts, kept for provenance, never
implementation authority. Listing each one individually would put three dead
pages beside thirty live ones in the place a reader browses.
"""
import re
import sys
from pathlib import Path

DOCS = Path(__file__).resolve().parent.parent / "docs"
INDEX = DOCS / "README.md"
LINK = re.compile(r"\(\.?/?([A-Za-z0-9._-]+\.md)[^)]*\)")


def main() -> int:
    if not INDEX.exists():
        print("doc-index: docs/README.md is missing", file=sys.stderr)
        return 1

    linked = set(LINK.findall(INDEX.read_text()))
    pages = sorted(p.name for p in DOCS.glob("*.md") if p.name != "README.md")
    missing = [p for p in pages if p not in linked]

    if missing:
        print(f"doc-index: {len(missing)} page(s) not linked from docs/README.md",
              file=sys.stderr)
        for name in missing:
            print("  docs/" + name, file=sys.stderr)
        print("\nA document nobody can find by browsing is a document nobody"
              "\nreads. Add it to the index in the same commit that adds it.",
              file=sys.stderr)
        return 1

    print(f"doc-index: {len(pages)} pages, every one linked from docs/README.md")
    return 0


if __name__ == "__main__":
    sys.exit(main())
