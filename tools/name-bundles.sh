#!/usr/bin/env bash
# Take the spaces out of the filenames the Tauri bundler just produced.
#
# `Tura Notes_1.1.19_aarch64.dmg` becomes `TuraNotes_1.1.19_aarch64.dmg`, and
# the same for .deb, .AppImage and .rpm. The bundler names artefacts after
# `productName`, which has a space in it, and a space in a released filename is
# `%20` in every URL that points at it and a word boundary in every script that
# has not been written carefully. ADR-071 exists because one of those scripts
# was not: the Arch job split a path on whitespace and asserted against somebody
# else's file.
#
# WHAT THIS DOES NOT RENAME, AND MUST NOT. The application is `Tura Notes.app`,
# the Debian package is whatever its control file says, the bundle identifier is
# `br.com.samirhv.notes` and the desktop entry is `Tura Notes.desktop`. Those are
# installed identities: renaming one turns the next release into a SECOND
# installation beside the first rather than an upgrade of it, which is precisely
# what ADR-069 froze. Only regular files are touched, so `Tura Notes.app` — a
# directory — is out of reach by construction rather than by care.
#
# Idempotent: a name with no space is left alone, so a re-run costs nothing.
#
#   tools/name-bundles.sh target/release/bundle/dmg target/release/bundle/deb
set -euo pipefail

renamed=0
for directory in "$@"; do
    [ -d "$directory" ] || continue
    while IFS= read -r -d '' file; do
        name="$(basename "$file")"
        clean="${name// /}"
        [ "$clean" != "$name" ] || continue
        # -f, and deliberately: the file that has just been built replaces a
        # rename left by an earlier run of the same version. The alternative is
        # publishing whichever one happened to be there first.
        mv -f -- "$file" "$(dirname "$file")/$clean"
        echo "    $name -> $clean"
        renamed=$((renamed + 1))
    done < <(find "$directory" -maxdepth 1 -type f -name '* *' -print0)
done
[ "$renamed" -eq 0 ] || echo "    ($renamed renamed)"
