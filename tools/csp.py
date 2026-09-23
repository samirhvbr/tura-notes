#!/usr/bin/env python3
"""The desktop CSP is exactly the one `ARCHITECTURE.md` §10 prints, and its
image sources are exactly the four ADR-089 allows.

Two failures, one check. The first is a widening nobody decided: `img-src`
opened to `https:` in 1.8.8 because raw HTML and Markdown images both obey the
per-workspace opt-in first (ADR-089). `http:` or `*` is a different decision —
a plain-text request carrying a note's reader to anyone on the path — and it
must arrive as an ADR, not as a string edit that looks like the one already
made. The second is the page drifting from the file: §10 had printed a CSP
without `base-uri 'none'` or `http://ipc.localhost` for several versions, and a
security page that describes a policy that is not in force is worse than no
page, because it is the one people read.
"""

import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
CONF = ROOT / "apps/notes-app/src-tauri/tauri.conf.json"
DOC = ROOT / "docs/ARCHITECTURE.md"

IMG_SRC = {"'self'", "notes-asset:", "data:", "https:"}
SCRIPT_SRC = {"'self'"}


def directives(csp: str) -> dict[str, list[str]]:
    out = {}
    for part in csp.split(";"):
        words = part.split()
        if words:
            out[words[0]] = words[1:]
    return out


def main() -> int:
    csp = json.loads(CONF.read_text())["app"]["security"]["csp"]
    d = directives(csp)
    errors = []
    if set(d.get("img-src", [])) != IMG_SRC:
        errors.append(f"img-src is {d.get('img-src')}, ADR-089 allows exactly {sorted(IMG_SRC)}")
    if set(d.get("script-src", [])) != SCRIPT_SRC:
        errors.append(f"script-src is {d.get('script-src')}, it stays 'self'")

    text = DOC.read_text()
    block = re.search(r"CSP \(`tauri.conf.json`\):\n\n```\n(.*?)```", text, re.S)
    if not block:
        errors.append("ARCHITECTURE.md no longer prints the CSP under 'CSP (`tauri.conf.json`):'")
    elif directives(block.group(1)) != d:
        errors.append("ARCHITECTURE.md §10 prints a CSP that is not the one in tauri.conf.json")

    for e in errors:
        print(e, file=sys.stderr)
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
