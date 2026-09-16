#!/usr/bin/env python3
"""Every `t("…")` in the application resolves, in both languages.

`t` returns the KEY when it does not resolve, so a missing entry renders as
`tree.newNote.prompt` in the middle of a dialog — visible to anyone who opens
it, invisible to a passing build, and impossible to notice in a locale you do
not read. That is exactly how `tree.newNote.prompt` and `tree.newFolder.prompt`
shipped and stayed.

Only literal keys are checked. A key built from a variable cannot be resolved
here, and pretending otherwise would mean either false alarms or a checker
nobody trusts.
"""
import json
import re
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1] / 'apps/notes-app/src'
locales = {name: json.loads((root / 'i18n' / f'{name}.json').read_text())
           for name in ('en', 'pt-BR')}

# The lookbehind matters: without it `closest("a")` and `keepDraft("conflict")`
# match, and the checker reports keys the application never asks for.
CALL = re.compile(r'(?<![A-Za-z0-9_$.])t\(\s*"([A-Za-z0-9_.]+)"')

problems = []
for file in sorted(root.rglob('*.ts*')):
    if '.test.' in file.name or file.parent.name == 'i18n':
        continue
    for key in sorted(set(CALL.findall(file.read_text()))):
        for name, table in locales.items():
            if key not in table:
                problems.append(f'{file.relative_to(root)}: t("{key}") missing from {name}')

extra = sorted(set(locales['en']) ^ set(locales['pt-BR']))
problems += [f'defined in only one language: {key}' for key in extra]

for problem in problems:
    print(problem, file=sys.stderr)
sys.exit(1 if problems else 0)
