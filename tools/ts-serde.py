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

**An attribute is accumulated until its brackets balance, and that is the whole
correction this file has had.** The first version read one line at a time and
treated any line that was not an attribute as the end of the block — so

    #[derive(
        Debug, Clone, Copy, …, Serialize, Deserialize, TS,
    )]

ended the block at its own second line. That is how `notes-model/src/ids.rs`
writes `uuid_newtype!`, and `WorkspaceId` and `NoteId` are the two identifiers
every IPC payload carries: removing their `#[ts(type = "string")]` left this
check green. A check with a blind spot over the types that cross most often is
worse than no check, because the green is read as coverage.

`SELF_TEST` is what makes that statement checkable. The blind spot was invisible
precisely because nothing ever asserted a failure, so the run now proves it can
fail — on a multi-line derive among the cases — before it reports that the tree
does not.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# The three spellings ts-rs cannot parse. Each replaces the serialized shape
# with one the derived TypeScript does not reproduce.
OPAQUE = re.compile(r'#\[serde\(.*\b(transparent|try_from|into)\b')
# `#[ts(export, type = "string")]` — the override, wherever `type` lands in it.
OVERRIDE = re.compile(r'#\[ts\([^\]]*\btype\s*=')
DERIVES_TS = re.compile(r'#\[derive\([^\]]*\bTS\b')
# `$name` is a name too: `notes-model/src/ids.rs` declares both uuid newtypes
# from inside `macro_rules!`, and a pattern requiring `\w` after the keyword
# skipped the item line and with it the two types every payload carries.
ITEM = re.compile(r'\b(struct|enum)\s+(\$?\w+)')
# Brackets inside a string — `#[ts(type = "Foo[]")]` — are text, not structure.
STRING = re.compile(r'"(?:[^"\\]|\\.)*"')


def offenders(source):
    """(line, name) for every TS item with an opaque serde shape and no override."""
    found, block, depth, buffer = [], [], 0, ''
    for number, raw in enumerate(source.splitlines(), 1):
        line = raw.strip()
        if depth > 0:
            buffer += ' ' + line
        elif line.startswith('#['):
            buffer = line
        else:
            match = ITEM.search(line)
            if match and block:
                joined = ' '.join(block)
                if DERIVES_TS.search(joined) and OPAQUE.search(joined):
                    if not OVERRIDE.search(joined):
                        found.append((number, match.group(2)))
                block = []
            # A doc comment or a blank line between attributes keeps the block
            # open; anything else is code, and ends it.
            elif line and not line.startswith('//'):
                block = []
            continue
        bare = STRING.sub('', buffer)
        depth = bare.count('[') + bare.count('(') - bare.count(']') - bare.count(')')
        if depth <= 0:
            block.append(buffer)
            depth, buffer = 0, ''
    return found


SELF_TEST = [
    # No override: the generated TypeScript would say `{0: string}`.
    ('#[derive(Serialize, TS)]\n#[serde(transparent)]\npub struct Bad(String);', True),
    # The same type, overridden.
    ('#[derive(Serialize, TS)]\n#[serde(transparent)]\n#[ts(export, type = "string")]\npub struct Good(String);', False),
    # The case the first version of this file could not see.
    ('#[derive(\n    Serialize, Deserialize, TS,\n)]\n#[serde(transparent)]\npub struct Split(Uuid);', True),
    # …and the same shape when it is correct, so the parser is not merely
    # failing everything it cannot read.
    ('#[derive(\n    Serialize, Deserialize, TS,\n)]\n#[serde(transparent)]\n#[ts(export, type = "string")]\npub struct SplitOk(Uuid);', False),
    # Declared from inside `macro_rules!`, which is how `ids.rs` writes both
    # uuid newtypes: the item names a metavariable, not an identifier.
    ('#[derive(\n    Serialize, TS,\n)]\n#[serde(transparent)]\npub struct $name(Uuid);', True),
    ('#[derive(\n    Serialize, TS,\n)]\n#[serde(transparent)]\n#[ts(export, type = "string")]\npub struct $name(Uuid);', False),
    # try_from/into, the other spelling.
    ('#[derive(Serialize, TS)]\n#[serde(try_from = "String", into = "String")]\npub struct Rel(String);', True),
    # A doc comment between the attributes does not end the block.
    ('#[derive(Serialize, TS)]\n#[serde(transparent)]\n/// what it is\npub struct Documented(String);', True),
    # No TS derive: ts-rs generates nothing, so there is nothing to disagree with.
    ('#[derive(Serialize)]\n#[serde(transparent)]\npub struct NotExported(String);', False),
]


def main():
    for source, should_fail in SELF_TEST:
        if bool(offenders(source)) != should_fail:
            print('ts-serde: this check can no longer tell a violation from a', file=sys.stderr)
            print('compliant type, so its silence means nothing. Fix it first.', file=sys.stderr)
            return 1

    problems = []
    for file in sorted(ROOT.glob('crates/**/*.rs')):
        for number, name in offenders(file.read_text()):
            problems.append(
                f'{file.relative_to(ROOT)}:{number}: {name} has an opaque serde '
                f'representation and no #[ts(type = "…")], so the generated '
                f'TypeScript describes the Rust shape'
            )
    for problem in problems:
        print(problem, file=sys.stderr)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
