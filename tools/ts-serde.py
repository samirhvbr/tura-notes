#!/usr/bin/env python3
"""A serde wrapper that crosses the IPC boundary must tell ts-rs its wire shape.

`ts-rs` cannot read `#[serde(transparent)]`, `try_from` or `into`. It says so —
ten `warning: failed to parse serde attribute` lines on every `cargo clippy` —
and then generates TypeScript for the Rust shape rather than the wire shape. A
`#[serde(transparent)]` newtype without an override is described to the frontend
as `{0: T}` while the wire carries a bare `T`, and nothing fails: the types
compile, the IPC works at runtime, and the declaration is quietly wrong.

Today every such type carries an explicit `#[ts(type = "…")]`, so the generated
TypeScript is right. **The problem is the next one.** The warning that would
announce it arrives in the middle of ten identical ones everybody has learned to
scroll past, which is what a warning nobody can act on costs: it spends the
attention of the one that matters.

So the pairing is asserted here and the warnings can stay noise. Failing this
check is the signal; the warning is not.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OPAQUE = re.compile(r'#\[serde\(.*\b(transparent|try_from|into)\b')
ITEM = re.compile(r'\b(struct|enum)\s+(\w+)')

problems = []
for file in sorted(ROOT.glob('crates/**/*.rs')):
    lines = file.read_text().splitlines()
    block: list[str] = []
    for number, raw in enumerate(lines, 1):
        line = raw.strip()
        if line.startswith('#['):
            block.append(line)
            continue
        if not block:
            continue
        # The attribute block ends at the item it decorates. Anything else —
        # a doc comment, a blank line inside a derive — keeps it open.
        match = ITEM.search(line)
        if not match and (line.startswith('///') or line.startswith('#') or not line):
            continue
        if match:
            joined = ' '.join(block)
            derives_ts = re.search(r'#\[derive\([^)]*\bTS\b', joined) or 'TS,' in joined or 'TS)' in joined
            if any(OPAQUE.search(a) for a in block) and derives_ts:
                if not re.search(r'#\[ts\([^)]*type\s*=', joined):
                    problems.append(
                        f'{file.relative_to(ROOT)}:{number}: {match.group(2)} '
                        f'has an opaque serde representation and no #[ts(type = "…")], '
                        f'so the generated TypeScript describes the Rust shape'
                    )
        block = []

for problem in problems:
    print(problem, file=sys.stderr)
sys.exit(1 if problems else 0)
