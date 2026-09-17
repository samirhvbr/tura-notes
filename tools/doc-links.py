#!/usr/bin/env python3
"""Every relative link in the documentation resolves — the file and the anchor.

This repository leans on links harder than most: `CLAUDE.md` and `AGENTS.md`
cite ADRs by anchor a hundred times over, every acceptance page points at the
contract it accepts, and the whole "do not re-litigate a decided direction, link
the ADR" rule is a link away from being useless. A broken one is invisible until
somebody clicks it, and by then they are reading the wrong page or none.

**Anchors are the half that actually rots.** A file rename is loud; an ADR
heading reworded by one word silently orphans every `#adr-0xx--…` pointing at
it, and GitHub answers a missing anchor by showing the top of the page — which
looks like a working link.

Three things are deliberately not checked, each for a reason:

- **`fixtures/`** is test data whose links are broken on purpose: `javascript:`
  URLs, `file:///etc/passwd`, `../../../../etc/passwd`, notes pointing at
  neighbours that do not exist. That is the XSS and link-resolution corpus, and
  a checker that "fixes" it destroys the test.
- **One line of `CHANGELOG.md`**, and not the file. The file is never rewritten,
  so a broken link in a published entry cannot be repaired — but skipping the
  whole file also skips the entry being written right now, which is the only one
  a broken link can still be kept out of. `EXEMPT_LINES` pins the historical
  one by line and reason.
- **Code.** A fenced block or an inline span showing `[text](path/to.md)` as
  *syntax* is documentation of a format, not a link. `product.md` and `SCOPE.md`
  both do it, and both are right to.

External links are not fetched. A checker that hits the network is a checker
that fails on a train, and then gets skipped.
"""
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SKIP_DIRS = ("fixtures/", "node_modules/", "target/", "dist/")
SKIP_FILES: set[str] = set()

# `CHANGELOG.md` is checked, with three published entries exempted rather than
# the whole file.
#
# The file is never rewritten — its own header says so — so a broken link inside
# a published entry has no legal repair, and skipping the file entirely was the
# first answer. That answer also skips the entry being written *right now*,
# which is the only one a broken link can still be kept out of.
#
# **The exemption is keyed by the version heading, not by line number.** Line
# numbers were the first attempt and they are wrong by construction here: this
# file grows at the top, so every new entry shifts every historical line down
# and silently un-exempts them. Keyed by version, an entry carries its exemption
# wherever it ends up, and a broken link in a *new* entry is never covered by
# one.
EXEMPT_ENTRIES = {
    ("CHANGELOG.md", "0.3.2"): (
        "Cites ADR-009 and ADR-010 with no anchor. Published history, and the "
        "rule requiring the anchor only arrived at 1.6.44."
    ),
    ("CHANGELOG.md", "0.2.0"): (
        "Links `docs/architecture.md`, later renamed to `ARCHITECTURE.md`. "
        "Published history; the file it describes is one capitalisation away."
    ),
}
ENTRY_HEADING = re.compile(r"^##\s+(\d+\.\d+\.\d+)\b")

# A path that does not exist yet *by design*, with where it comes from. The
# alternative is a page that cannot say where a file will appear.
EXPECTED_MISSING = {
    "server/cotenant/notes-server.pub": "created by OWNER-ACTS.md §1, the owner's signing act",
}

FENCE = re.compile(r"^\s*(```|~~~)")
INLINE_CODE = re.compile(r"`[^`]*`")
LINK = re.compile(r"(?<!!)\[([^\]]*)\]\(([^)\s]+)\)")
HEADING = re.compile(r"^(#{1,6})\s+(.*)$")

# `[ADR-071](decisions.md)` resolves, and is still the wrong link: it lands the
# reader at the top of a file with eighty-odd decisions in it. The rule this
# repository runs on is *"do not re-litigate a decided direction — link the
# ADR"*, and a citation that makes someone search for the ADR they were pointed
# at is a citation that gets skipped, after which the direction gets
# re-litigated. Twenty-three of these existed when the check was written.
ADR_CITATION = re.compile(r"^ADR-\d+$")


def slug(text: str) -> str:
    """GitHub's heading slug: lowercase, drop punctuation, each space a hyphen.

    The "each space" is the part worth stating. `ADR-001 — Markdown files` has a
    space, an em dash and a space, and the dash leaves while the two spaces both
    become hyphens — which is why every ADR anchor in this repository carries a
    double hyphen. Collapsing whitespace runs produces a single one and reports
    every correct anchor as broken.
    """
    text = text.strip().rstrip("#").strip()
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text, flags=re.UNICODE)
    return text.replace(" ", "-")


def strip_code(lines):
    """Yield (lineno, text) with fenced blocks dropped and inline spans blanked."""
    in_fence = False
    for n, line in enumerate(lines, 1):
        if FENCE.match(line):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        yield n, INLINE_CODE.sub("``", line)


def tracked_markdown():
    # `-z` and NUL splitting, not `.split()`: without it git quotes any path
    # with a non-ASCII byte, and `fixtures/edge-cases/` exists precisely to hold
    # those — the checker would then try to open a filename with literal quotes
    # and backslash escapes in it.
    out = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "-z", "*.md"],
        capture_output=True, text=True, check=True).stdout
    for rel in filter(None, out.split("\0")):
        if any(rel.startswith(d) or f"/{d}" in rel for d in SKIP_DIRS):
            continue
        if rel in SKIP_FILES:
            continue
        yield rel


def main() -> int:
    files = sorted(tracked_markdown())
    anchors: dict[Path, set[str]] = {}
    for rel in files:
        p = ROOT / rel
        found = set()
        in_fence = False
        for line in p.read_text(errors="replace").splitlines():
            if FENCE.match(line):
                in_fence = not in_fence
                continue
            if in_fence:
                continue
            m = HEADING.match(line)
            if m:
                found.add(slug(m.group(2)))
        anchors[p.resolve()] = found

    problems = []
    for rel in files:
        p = ROOT / rel
        entry = None
        for lineno, line in strip_code(p.read_text(errors="replace").splitlines()):
            heading = ENTRY_HEADING.match(line)
            if heading:
                entry = heading.group(1)
            if entry is not None and (rel, entry) in EXEMPT_ENTRIES:
                continue
            for m in LINK.finditer(line):
                text, target = m.group(1), m.group(2)
                if target.startswith(("http://", "https://", "mailto:", "tel:")):
                    continue
                if (ADR_CITATION.match(text.strip())
                        and target.split("#")[0].endswith("decisions.md")
                        and "#" not in target):
                    problems.append(
                        f"{rel}:{lineno}: [{text}]({target}) — cites an ADR but "
                        f"links the whole file; add the #anchor")
                    continue
                frag = ""
                if target.startswith("#"):
                    frag, dest = target[1:], p.resolve()
                else:
                    if "#" in target:
                        target, frag = target.split("#", 1)
                    if not target:
                        continue
                    dest = (p.parent / target).resolve()
                    try:
                        as_rel = dest.relative_to(ROOT).as_posix()
                    except ValueError:
                        as_rel = ""
                    if as_rel in EXPECTED_MISSING:
                        continue
                    if not dest.exists():
                        problems.append(
                            f"{rel}:{lineno}: {target} — no such file")
                        continue
                if frag and dest.suffix == ".md":
                    if frag not in anchors.get(dest, set()):
                        problems.append(
                            f"{rel}:{lineno}: [{text}]({m.group(2)}) — no such heading")

    if problems:
        print(f"doc-links: {len(problems)} broken link(s)", file=sys.stderr)
        for line in problems:
            print("  " + line, file=sys.stderr)
        print("\nA missing anchor renders as the top of the page, which reads as"
              "\na working link. Fix the anchor, not the reader.", file=sys.stderr)
        return 1
    print(f"doc-links: {len(files)} documents, every relative link resolves")
    return 0


if __name__ == "__main__":
    sys.exit(main())
