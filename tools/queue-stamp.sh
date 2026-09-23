#!/usr/bin/env bash
# `.continue/README.md` is read first by every session, and its status line says
# every row was checked at a named version. That line stood still for 44
# versions while rows underneath went stale, turning old rows into certified
# ones (R6-34). So an edit to the file must restamp it: when the file changes,
# the version it names is the one in `version.md`.
#
# Locally the change is the working tree against HEAD; in CI it is the commit
# being tested against its parent.
set -euo pipefail
cd "$(dirname "$0")/.."
file=.continue/README.md
if ! git diff --quiet HEAD -- "$file" 2>/dev/null; then
  version=$(grep -oE '[0-9]+\.[0-9]+\.[0-9]+' version.md | head -1)
  stamp=$(sed -n '1,6p' "$file" | grep -oE 'repository at `[0-9]+\.[0-9]+\.[0-9]+`' | grep -oE '[0-9.]+[0-9]')
elif git rev-parse --verify --quiet HEAD~1 >/dev/null && ! git diff --quiet HEAD~1 HEAD -- "$file"; then
  version=$(git show HEAD:version.md | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
  stamp=$(git show "HEAD:$file" | sed -n '1,6p' | grep -oE 'repository at `[0-9]+\.[0-9]+\.[0-9]+`' | grep -oE '[0-9.]+[0-9]')
else
  echo "queue index unchanged"; exit 0
fi
if [ "${stamp:-}" != "$version" ]; then
  echo "$file changed but its status line says repository at ${stamp:-nothing}, not $version: review the rows and restamp" >&2
  exit 1
fi
echo "queue index restamped at $version"
