#!/usr/bin/env bash
# Every document under docs/ declares one of the five statuses, in its first
# lines, using one of the five words.
#
# The rule (CLAUDE.md, golden rule 3) exists for one sentence in it: *a document
# with no declaration is read as ACTIVE, which is exactly the failure mode*. A
# planning draft nobody has built, read as the thing that was built, is worse
# than a missing document — it has the authority of being written down.
#
# The **vocabulary** is checked and not just the presence, because a sixth word
# is the same failure one step along. `architecture-v1.md` declared `SUPERSEDED`
# for a while: unambiguous to a human, and a word the reader has to interpret
# rather than look up. It says `HISTORICAL` now, which means the same thing and
# is one of the five.
#
# First eight lines only. A status further down is a status nobody reads before
# they have started believing the document.
set -uo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

WORDS='ACTIVE|HISTORICAL|PROPOSED|DEPRECATED|NOT ADOPTED'
missing=0
while IFS= read -r file; do
    if ! head -8 "$file" | grep -qE "\*\*Status:?\*?\*?:? *\`?($WORDS)\`?"; then
        echo "no status in the first lines of $file" >&2
        missing=1
    fi
done < <(find docs -name '*.md' | sort)
[ "$missing" -eq 0 ]
