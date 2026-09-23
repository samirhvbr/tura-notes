#!/usr/bin/env python3
"""A third-party action in a workflow that can write to the repository is pinned
to a commit (R6-32).

`@stable` is a branch and `@v2` a tag: whoever can move one runs code in the job
that compiles, checksums and uploads what gets signed and installed. GitHub's own
`actions/*` and local `./` workflows are exempt; everything else in a file that
grants `contents: write` anywhere must be `owner/repo@<40 hex>`.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
USES = re.compile(r"^\s*-?\s*uses:\s*([^\s#]+)", re.M)
PINNED = re.compile(r"@[0-9a-f]{40}$")

problems = []
for wf in sorted((ROOT / ".github/workflows").glob("*.yml")):
    text = wf.read_text()
    if not re.search(r"contents:\s*write", text):
        continue
    for ref in USES.findall(text):
        if ref.startswith(("actions/", "./")):
            continue
        if not PINNED.search(ref):
            problems.append(f"{wf.name}: {ref} is not pinned to a commit")

for p in problems:
    print(p, file=sys.stderr)
sys.exit(1 if problems else 0)
